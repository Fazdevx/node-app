import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import 'dotenv/config';
import { createClient } from '@libsql/client';

const ejecutar = promisify(execFile);
const { TURSO_DATABASE_URL, TURSO_AUTH_TOKEN } = process.env;

if (!TURSO_DATABASE_URL || !TURSO_AUTH_TOKEN) {
    console.log('push-turso: sin TURSO_DATABASE_URL/TURSO_AUTH_TOKEN, se omite (BD local).');
    process.exit(0);
}

const cliente = createClient({ url: TURSO_DATABASE_URL, authToken: TURSO_AUTH_TOKEN });

const existe = await cliente.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
const yaMigrado = existe.rows.length > 0;

if (yaMigrado) {
    console.log('push-turso: el esquema ya esta aplicado, nada que hacer.');
    await cliente.close();
    process.exit(0);
}

console.log('push-turso: generando SQL del esquema...');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const { stdout } = await ejecutar(
    npx,
    ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
    { cwd: process.cwd(), maxBuffer: 10 * 1024 * 1024 },
);

if (!stdout.trim()) {
    console.log('push-turso: nada que aplicar.');
    await cliente.close();
    process.exit(0);
}

const resultado = await cliente.batch(stdout);
console.log(`push-turso: esquema aplicado (${resultado.results?.length ?? 0} operaciones).`);
await cliente.close();