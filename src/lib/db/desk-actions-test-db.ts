import { execFileSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
export const homeTestEnabled = process.env.HOME_TEST_CONTAINER !== undefined;
function args() {
    if (process.env.HOME_TEST_CONTAINER !== 'meritus-home-test')
        throw new Error('Only meritus-home-test/home_dashboard_test is permitted');
    return ['exec', '-i', 'meritus-home-test', 'psql', '-U', 'home_test', '-d', 'home_dashboard_test', '-v', 'ON_ERROR_STOP=1', '-Atq'];
}
export function runSql(input: string): string { return execFileSync('docker', args(), { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim(); }
export function concurrentSql(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const child = spawn('docker', args());
        let out = '', err = '';
        child.stdout.on('data', d => out += String(d));
        child.stderr.on('data', d => err += String(d));
        child.on('error', reject);
        child.on('close', code => code ? reject(new Error(err)) : resolve(out.trim()));
        child.stdin.end(input);
    });
}
// Parameter interpolation exists only in this isolated synthetic psql adapter.
export function compileSql(statement: SQL): string {
    const query = new PgDialect().sqlToQuery(statement);
    return query.sql.replace(/\$(\d+)/g, (_, n: string) => {
        const v = query.params[Number(n) - 1];
        return v === null ? 'NULL' : `'${String(typeof v === 'object' ? JSON.stringify(v) : v).replaceAll("'", "''")}'`;
    });
}
export function migrateHomeTest() {
    args();
    execFileSync('docker', ['exec', 'meritus-home-test', 'pg_isready', '-U', 'home_test', '-d', 'home_dashboard_test']);
    runSql('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    const journal = JSON.parse(readFileSync('drizzle/meta/_journal.json', 'utf8')) as {
        entries: {
            tag: string;
        }[];
    };
    for (const entry of journal.entries)
        runSql(readFileSync(`drizzle/${entry.tag}.sql`, 'utf8').replaceAll('--> statement-breakpoint', ''));
}
