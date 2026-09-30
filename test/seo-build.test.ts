import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { runSeoBuild } from '../src/seo-build.js';

async function createConfig(directory: string, body: string): Promise<string> {
  const path = join(directory, 'seo.config.cjs');
  await writeFile(path, `module.exports = ${body};\n`);
  return path;
}

test('build generates and validates sitemap and robots files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-build-'));
  const config = await createConfig(directory, JSON.stringify({
    siteUrl: 'https://example.com',
    metadata: { title: 'Example', description: 'Example site', image: 'https://example.com/og.png' },
    sitemap: { routes: ['/', '/about'] },
  }));

  const report = await runSeoBuild({ cwd: directory, config });
  assert.equal(report.passed, true);
  assert.equal(report.routeCount, 2);
  assert.equal(report.errors.length, 0);
  assert.match(await readFile(join(directory, 'public', 'sitemap.xml'), 'utf8'), /<loc>https:\/\/example\.com\/about<\/loc>/);
  assert.match(await readFile(join(directory, 'public', 'robots.txt'), 'utf8'), /Sitemap:/);
});

test('build reports duplicate routes and strict metadata warnings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-build-errors-'));
  const config = await createConfig(directory, JSON.stringify({
    siteUrl: 'https://example.com',
    sitemap: { routes: ['/', '//'] },
  }));

  const normal = await runSeoBuild({ cwd: directory, config });
  assert.equal(normal.passed, false);
  assert.match(normal.errors.join('\n'), /Duplicate sitemap routes/);

  const strictConfig = await createConfig(directory, JSON.stringify({
    siteUrl: 'https://example.com',
    sitemap: { routes: ['/'] },
  }));
  const strict = await runSeoBuild({ cwd: directory, config: strictConfig, strict: true });
  assert.equal(strict.passed, false);
  assert.match(strict.errors.join('\n'), /Global metadata.*not configured/);
});

test('build fails cleanly when config is missing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-build-missing-'));
  const report = await runSeoBuild({ cwd: directory });
  assert.equal(report.passed, false);
  assert.match(report.errors[0] ?? '', /SEO config not found/);
});

test('CLI build prints a JSON report', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-build-cli-'));
  await createConfig(directory, JSON.stringify({
    siteUrl: 'https://example.com',
    metadata: { title: 'Example' },
    sitemap: { routes: ['/'] },
  }));
  const cli = resolve('dist/src/cli.js');
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [cli, 'build', '--json'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, NGX_SEO_KIT_DISABLE_UPDATE_CHECK: '1' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).passed, true);
});

