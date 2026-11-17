import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { readdirSync } from 'node:fs';

const source = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(source.hostname)) {
  throw new Error('Este comando aceita apenas PostgreSQL local.');
}
const database = `lifeguard_${randomBytes(6).toString('hex')}_test`;
const client = new pg.Client({ connectionString: source.toString() });
await client.connect();
await client.query(`CREATE DATABASE "${database}"`);
const destination = new URL(source);
destination.pathname = `/${database}`;
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: destination.toString(), JWT_SECRET: randomBytes(48).toString('hex'), SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '' };
try {
  for (const args of [['node_modules/prisma/build/index.js', 'migrate', 'deploy'], ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], ['--test', ...readdirSync('src/integration').filter((name) => name.endsWith('.test.ts')).map((name) => `dist/src/integration/${name.replace(/\.ts$/, '.js')}`)]]) {
    const run = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
    if (run.status !== 0) throw new Error('Falha na verificação de integração.');
  }
} finally {
  // The name is generated above; this never touches an existing application DB.
  await client.query(`DROP DATABASE "${database}" WITH (FORCE)`);
  await client.end();
}
