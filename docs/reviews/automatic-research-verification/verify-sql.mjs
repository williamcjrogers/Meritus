import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const directory = path.join(root, 'docs/reviews/automatic-research-verification');
const harness = path.join(directory, 'harness');
const container = 'qcs-research-test-automtxvfwau';
const suffix = Date.now();
const names = Object.fromEntries(['fresh', 'base', 'workflow', 'sources', 'intelligence', 'automatic']
  .map(kind => [kind, `research_final_${suffix}_${kind}_test`]));
const created = [];
const psql = (database, input) => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'research_test', '-d', database, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/DATABASE_URL|CLERK|OPENAI|AI_GATEWAY|RESEND|RESEARCH_.*TEST/.test(key)) delete env[key];
}
Object.assign(env, {
  RESEARCH_TEST_PG_CONTAINER: container,
  RESEARCH_TEST_PG_DATABASE: names.base,
  RESEARCH_TEST_WITH_WORKFLOW: '1',
  RESEARCH_TEST_WITH_WATCHLISTS: '1',
  RESEARCH_SOURCE_TEST_DATABASE: names.sources,
  RESEARCH_WORKFLOW_TEST_CONTAINER: container,
  RESEARCH_INTELLIGENCE_TEST_CONTAINER: container,
  RESEARCH_AUTOMATIC_TEST_CONTAINER: container,
});
mkdirSync(harness, { recursive: true });
const report = { container, network: '', names, migrationCount: 0, schema: '', integrationExitCode: null };
try {
  report.network = execFileSync('docker', ['inspect', container, '--format', '{{.HostConfig.NetworkMode}}'], { encoding: 'utf8' }).trim();
  if (report.network !== 'none') throw new Error('Isolated test container must have no network');
  const journal = JSON.parse(readFileSync(path.join(root, 'drizzle/meta/_journal.json'), 'utf8')).entries;
  if (journal.length !== 10 || journal.some((entry, index) => entry.idx !== index)) throw new Error('Expected exactly migrations 0000 through 0009');
  psql('research_test', `create database ${names.fresh};`);
  created.push(names.fresh);
  const migrations = journal.map(entry => readFileSync(path.join(root, 'drizzle', `${entry.tag}.sql`), 'utf8'));
  psql(names.fresh, 'begin;\n' + migrations.join('\n') + '\ncommit;');
  report.migrationCount = migrations.length;
  report.schema = psql(names.fresh, "select to_regclass('research_quick_questions'), position('research_quick_questions' in pg_get_functiondef('research_cancel_run(uuid)'::regprocedure)) > 0;").trim();
  if (report.schema !== 'research_quick_questions|t') throw new Error('Latest schema or cancellation function was not installed');
  console.log('Fresh installation: 10 migrations passed; latest cancellation function verified.');
  for (const [kind, database] of Object.entries(names)) {
    if (kind === 'fresh') continue;
    psql('research_test', `create database ${database} template ${names.fresh};`);
    created.push(database);
  }
  const files = [
    'research.integration.test.ts',
    'research-workflow.integration.test.ts',
    'research-entities.integration.test.ts',
    'research-case-law.test.ts',
    'research-intelligence.integration.test.ts',
    'research-quick.integration.test.ts',
  ];
  for (const file of files) {
    let source = readFileSync(path.join(root, 'src/lib/db', file), 'utf8');
    source = source.replace(/(['"])\.\/([^'"]+)\1/g, '$1@/lib/db/$2$1')
      .replaceAll('research_workflow_test', names.workflow)
      .replaceAll('research_sources_test', names.sources)
      .replaceAll('research_intelligence_test', names.intelligence)
      .replaceAll('research_automatic_test', names.automatic);
    if (file === 'research-intelligence.integration.test.ts') source = source.replace('e.idx <= 6', 'e.idx <= 9');
    writeFileSync(path.join(harness, file), source);
  }
  const config = path.join(harness, 'vitest.config.mts');
  writeFileSync(config, `import base from '../../../../vitest.config.mts';\nexport default { ...base, test: { ...base.test, include: ['docs/reviews/automatic-research-verification/harness/*.test.ts'], maxWorkers: 2 } };\n`);
  try {
    const output = execFileSync('corepack', ['pnpm', 'exec', 'vitest', 'run', 'docs/reviews/automatic-research-verification/harness', '--config', config], { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    writeFileSync(path.join(directory, 'sql-integration.log'), output);
    report.integrationExitCode = 0;
    console.log(output);
  } catch (error) {
    const output = String(error.stdout ?? '') + '\n' + String(error.stderr ?? '');
    writeFileSync(path.join(directory, 'sql-integration.log'), output);
    report.integrationExitCode = error.status ?? 1;
    console.log(output);
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error.message);
  if (error.stderr) console.error(String(error.stderr));
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  for (const database of created.reverse()) {
    try { psql('research_test', `drop database ${database};`); } catch (error) { console.error(`Could not remove disposable database ${database}: ${error.message}`); }
  }
  rmSync(harness, { recursive: true, force: true });
  writeFileSync(path.join(directory, 'sql-verification.json'), JSON.stringify(report, null, 2) + '\n');
}
