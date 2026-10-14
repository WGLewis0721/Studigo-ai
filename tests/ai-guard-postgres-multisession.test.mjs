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



// ---- Cross-session atomicity and role enforcement on a real PostgreSQL server ----
const owner2 = "00000000-0000-4000-8000-000000000002";
const BIG = { um: 100000, im: 100000, gm: 100000, uc: 1000, ic: 1000, gc: 1000, ud: 1e12, gd: 1e12 };
const decideSql = (n, { owner: who = owner, ip = "f".repeat(64), key = "k-" + n, cost = 100, limits }) =>
  `select public.admit_studigo_ai_resource('${uuid(n)}'::uuid,'${who}'::uuid,'${ip}'::text,'chat'::text,'${key}'::text,${cost}::bigint,` +
  `${limits.um}::integer,${limits.im}::integer,${limits.gm}::integer,${limits.uc}::integer,${limits.ic}::integer,${limits.gc}::integer,` +
  `${limits.ud}::bigint,${limits.gd}::bigint)`;
const parse = out => JSON.parse(out.split("\n").find(line => line.startsWith("{")));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function decide(n, spec) {
  // 'busy' is the designed fail-closed answer to lock contention; a real client retries.
  for (let attempt = 0; attempt < 400; attempt++) {
    const reply = parse(await sql(`begin; ${auth} ${decideSql(n, spec)}; commit;`));
    if (reply.reason !== "busy") return reply;
    await sleep(3 + Math.floor(Math.random() * 20));
  }
  throw new Error("admission stayed busy");
}
async function cleanSlate() {
  await sql(`insert into auth.users(id) values('${owner2}') on conflict do nothing;
    delete from public.studigo_ai_guard_leases; delete from public.studigo_ai_guard_receipts;
    delete from public.studigo_ai_guard_windows; update public.studigo_ai_guard_state set paused=false where id=true`);
  // Per-minute windows would split across a boundary; wait it out so the cap is exact.
  const into = Date.now() % 60_000;
  if (into > 48_000) await sleep(60_000 - into + 500);
}
const tally = replies => replies.reduce((m, r) => (m[r.allowed ? "allowed" : r.reason] = (m[r.allowed ? "allowed" : r.reason] ?? 0) + 1, m), {});

test("24 truly parallel sessions cannot exceed the global concurrency cap", { skip: !TEST_DATABASE_URL }, async () => {
  await cleanSlate();
  const limits = { ...BIG, gc: 5 };
  const replies = await Promise.all(Array.from({ length: 24 }, (_, i) =>
    decide(200 + i, { owner: i % 2 ? owner : owner2, ip: String(i % 4).repeat(64), limits })));
  assert.deepEqual(tally(replies), { allowed: 5, concurrent: 19 });
  assert.equal(Number(await sql("select count(*) from public.studigo_ai_guard_leases where completed_at is null")), 5);
});

test("parallel sessions cannot exceed per-user and per-IP concurrency", { skip: !TEST_DATABASE_URL }, async () => {
  await cleanSlate();
  const user = await Promise.all(Array.from({ length: 16 }, (_, i) =>
    decide(300 + i, { owner, ip: String(i % 8).repeat(64), limits: { ...BIG, uc: 3 } })));
  assert.deepEqual(tally(user), { allowed: 3, concurrent: 13 });
  await cleanSlate();
  const ip = await Promise.all(Array.from({ length: 16 }, (_, i) =>
    decide(320 + i, { owner: i % 2 ? owner : owner2, ip: "9".repeat(64), limits: { ...BIG, ic: 4 } })));
  assert.deepEqual(tally(ip), { allowed: 4, concurrent: 12 });
});

test("parallel sessions cannot exceed per-minute rate limits for user, IP or globally", { skip: !TEST_DATABASE_URL }, async () => {
  for (const [name, limits, spec] of [
    ["user", { ...BIG, um: 7 }, i => ({ owner, ip: String(i % 8).repeat(64) })],
    ["ip", { ...BIG, im: 6 }, i => ({ owner: i % 2 ? owner : owner2, ip: "8".repeat(64) })],
    ["global", { ...BIG, gm: 5 }, i => ({ owner: i % 2 ? owner : owner2, ip: String(i % 8).repeat(64) })]
  ]) {
    await cleanSlate();
    const replies = await Promise.all(Array.from({ length: 18 }, (_, i) =>
      decide(400 + i, { ...spec(i), limits })));
    const t = tally(replies), cap = { user: 7, ip: 6, global: 5 }[name];
    assert.deepEqual(t, { allowed: cap, rate: 18 - cap }, name);
  }
});

test("parallel sessions cannot exceed the user or global daily reservation ceilings", { skip: !TEST_DATABASE_URL }, async () => {
  await cleanSlate();
  const user = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    decide(500 + i, { owner, ip: String(i % 8).repeat(64), cost: 100, limits: { ...BIG, ud: 1000 } })));
  assert.deepEqual(tally(user), { allowed: 10, user_budget: 10 });
  assert.equal(Number(await sql("select reserved_micro_usd from public.studigo_ai_guard_windows where scope='user_day'")), 1000);
  await cleanSlate();
  const global = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    decide(520 + i, { owner: i % 2 ? owner : owner2, ip: String(i % 8).repeat(64), cost: 100, limits: { ...BIG, gd: 700 } })));
  assert.deepEqual(tally(global), { allowed: 7, global_budget: 13 });
  assert.equal(Number(await sql("select reserved_micro_usd from public.studigo_ai_guard_windows where scope='global_day'")), 700);
});

test("ten parallel sessions racing one operation key create exactly one lease", { skip: !TEST_DATABASE_URL }, async () => {
  await cleanSlate();
  const replies = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    decide(600 + i, { owner, key: "same-key", limits: BIG })));
  assert.deepEqual(tally(replies), { allowed: 1, duplicate: 9 });
  assert.equal(Number(await sql("select count(*) from public.studigo_ai_guard_leases where request_key='same-key'")), 1);
});

test("a real server enforces the service-role boundary for every RPC and table", { skip: !TEST_DATABASE_URL }, async () => {
  await cleanSlate();
  const denied = /permission denied|service role required/;
  const calls = [
    decideSql(700, { limits: BIG }),
    `select public.claim_studigo_ai_receipt('${owner}'::uuid,'chat','r','${"a".repeat(64)}')`,
    `select public.start_studigo_ai_receipt('${owner}'::uuid,'chat','r')`,
    `select public.finish_studigo_ai_receipt('${owner}'::uuid,'chat','r',true)`,
    `select public.finish_studigo_ai_resource('${uuid(700)}'::uuid)`,
    `select public.renew_studigo_ai_resource('${uuid(700)}'::uuid)`
  ];
  for (const role of ["anon", "authenticated"]) {
    for (const call of calls) {
      // Even a forged service_role claim cannot help a role without EXECUTE.
      await assert.rejects(sql(`begin; set local role ${role}; set local request.jwt.claim.role='service_role'; ${call}; commit;`), denied, `${role}: ${call.slice(0, 60)}`);
    }
    for (const table of ["state", "windows", "leases", "receipts"]) {
      await assert.rejects(sql(`begin; set local role ${role}; select * from public.studigo_ai_guard_${table}; commit;`), denied, `${role} reads ${table}`);
    }
  }
  // service_role with the wrong or missing JWT role claim is still refused inside the function.
  for (const claim of ["authenticated", "anon", ""]) {
    await assert.rejects(sql(`begin; set local role service_role; set local request.jwt.claim.role='${claim}'; ${calls[0]}; commit;`), denied, `claim '${claim}'`);
  }
  assert.equal(Number(await sql("select count(*) from public.studigo_ai_guard_leases")), 0, "denied calls changed nothing");
  // And the legitimate path still works.
  assert.equal(parse(await sql(`begin; set local role service_role; ${auth} ${decideSql(701, { limits: BIG })}; commit;`)).allowed, true);
});
