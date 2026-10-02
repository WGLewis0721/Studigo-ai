import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const app = fileURLToPath(new URL('../apps/web/', import.meta.url));
const cli = fileURLToPath(new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url));
const port = process.env.STUDIGO_BETA_PORT ?? '3000';
if (!/^\d{4,5}$/.test(port) || Number(port) > 65535) throw new Error('Use a valid STUDIGO_BETA_PORT');
console.log('Studigo integrated local beta: http://localhost:' + port + '/api/local-beta/open');
console.log('Synthetic materials only. Local SQLite storage. No Supabase or OpenAI key required.');
const child = spawn(process.execPath, [cli, 'dev', '--hostname', '127.0.0.1', '--port', port], {
  cwd: app, stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development', STUDIGO_LOCAL_BETA: '1' }
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
