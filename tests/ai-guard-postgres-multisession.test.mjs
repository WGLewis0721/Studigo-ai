import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";

const TEST_DATABASE_URL = process.env.STUDIGO_TEST_POSTGRES_URL;
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = spawn("psql", ["-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", TEST_DATABASE_URL, "-c", query], {
      env: process.env, stdio: ["ignore", "pipe", "pipe"]
    });
    let out = "", err = "";
    child.stdout.on("data", b => out += b);
    child.stderr.on("data", b => err += b);
    child.on("error", reject);
    child.on("close", code => code === 0 ? resolve(out.trim()) : reject(new Error(err || "psql failed: " + code)));
  });
}
const owner = "00000000-0000-4000-8000-000000000001";
const doc = "00000000-0000-4000-8000-000000000011";
const uuid = n => "10000000-0000-4000-8000-" + String(n).padStart(12,"0");
const claim = `select public.claim_forced_studigo_reindex('${doc}', '${owner}', 900)`;
const admit = (n) => `select public.admit_studigo_ai_resource('${uuid(n)}'::uuid,'${owner}'::uuid,'${"f".repeat(64)}'::text,'chat'::text,'parallel-${n}'::text,100::bigint,10::integer,10::integer,10::integer,1::integer,3::integer,3::integer,10000::bigint,20000::bigint)`;
const auth = "set local request.jwt.claim.role = 'service_role';";

test("two actual PostgreSQL sessions cannot force-claim the same document twice", { skip: !TEST_DATABASE_URL }, async () => {
  await sql(`
    create role service_role bypassrls;
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.role() returns text language sql as $FN$ select current_setting('request.jwt.claim.role',true) $FN$;
    insert into auth.users(id) values('${owner}');
    create table public.documents(
      id uuid primary key, owner_id uuid not null, source_type text not null,
      status text not null, attempts integer not null default 0,
      processing_started_at timestamptz, processed_at timestamptz,
      error_message text, last_forced_reindex_at timestamptz
    );
    insert into documents(id,owner_id,source_type,status) values('${doc}','${owner}','study_guide','ready');
  `);
  const migration = await readFile(new URL("../supabase/migrations/20261008100000_ai_resource_admission.sql", import.meta.url), "utf8");
  await sql(migration);
  const first = sql(`begin; ${auth} ${claim}; select pg_sleep(2); commit;`);
  await new Promise(resolve => setTimeout(resolve, 250));
  const second = sql(`begin; ${auth} ${claim}; commit;`);
  const [a,b] = await Promise.all([first,second]);
  assert.match(a, /"claimed": true/);
  assert.match(b, /"reason": "processing"/);
  assert.match(await sql(`select count(*) from documents where id='${doc}' and attempts=1 and status='processing'`), /1/);
  await sql(`update documents set status='ready' where id='${doc}'`);
  assert.match(await sql(`begin; ${auth} ${claim}; commit;`), /"reason": "cooldown"/);
});

test("global admission contention fails closed quickly and still preserves the cap", { skip: !TEST_DATABASE_URL }, async () => {
  const first = sql(`begin; ${auth} ${admit(101)}; select pg_sleep(2); commit;`);
  await new Promise(resolve => setTimeout(resolve, 250));
  const started = Date.now();
  const second = sql(`begin; ${auth} ${admit(102)}; commit;`);
  const b = await second;
  assert.match(b, /"reason": "busy"/);
  assert.ok(Date.now() - started < 1000, "contended admission did not wait behind the global lock");
  const a = await first;
  assert.match(a, /"allowed": true/);
  assert.match(await sql(`begin; ${auth} ${admit(103)}; commit;`), /"reason": "concurrent"/);
});


