import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  ensureRouteExportFiles,
  generateRouteExportFiles,
  writeRouteExportFiles,
} from '../src/cli/route-export.js';

test('generates the runtime route export service and test templates', () => {
  const files = generateRouteExportFiles();

  assert.match(files.service, /class RouteExportService/);
  assert.match(files.service, /routesToPaths\(this\.router\.config\)/);
  assert.match(files.test, /provideRouter\(routes\)/);
  assert.match(files.test, /\[ngx-seo-kit:routes\]/);
});

test('writes route export files without overwriting existing files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-route-export-'));
  const appDirectory = join(directory, 'src', 'app');

  const result = await writeRouteExportFiles({ projectDirectory: directory });
  assert.deepEqual(result.created, [result.service, result.test]);
  assert.match(await readFile(result.service, 'utf8'), /@Injectable/);
  assert.match(await readFile(result.test, 'utf8'), /RouteExportService/);

  await assert.rejects(
    () => writeRouteExportFiles({ projectDirectory: directory }),
    /already exist/,
  );

  await writeFile(join(appDirectory, 'app.routes.ts'), 'export const routes = [];\n');
});

test('ensures existing route export files are left untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-route-export-existing-'));
  const first = await writeRouteExportFiles({ projectDirectory: directory });
  const result = await ensureRouteExportFiles({ projectDirectory: directory });

  assert.equal(result, undefined);
  assert.match(await readFile(first.service, 'utf8'), /RouteExportService/);
});

test('ensures only the missing route export file is created', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-route-export-partial-'));
  const appDirectory = join(directory, 'src', 'app');
  const service = join(appDirectory, 'route-export.service.ts');

  await mkdir(appDirectory, { recursive: true });
  await writeFile(service, 'custom service file\n', { encoding: 'utf8', flag: 'w' });
  const result = await ensureRouteExportFiles({ projectDirectory: directory });

  assert.deepEqual(result?.created, [join(appDirectory, 'route-export.service.spec.ts')]);
  assert.equal(await readFile(service, 'utf8'), 'custom service file\n');
  assert.match(await readFile(join(appDirectory, 'route-export.service.spec.ts'), 'utf8'), /\[ngx-seo-kit:routes\]/);
});
