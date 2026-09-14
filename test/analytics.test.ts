import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  generateGoogleTagSnippet,
  installGoogleTag,
  normalizeGoogleTagId,
} from '../src/analytics/google-tag.js';

test('validates Google Analytics measurement IDs and generates the official tag shape', () => {
  assert.equal(normalizeGoogleTagId(' g-abc123 '), 'G-ABC123');
  assert.throws(() => normalizeGoogleTagId('G-ABC<script>'), /Invalid Google Analytics/);
  assert.match(
    generateGoogleTagSnippet('G-ABC123'),
    /googletagmanager\.com\/gtag\/js\?id=G-ABC123/,
  );
});

test('installs, updates and deduplicates a Google tag in an Angular index file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-analytics-'));
  const index = join(directory, 'src', 'index.html');
  await mkdir(join(directory, 'src'), { recursive: true });
  await writeFile(index, '<!doctype html>\n<html><head>\n<title>App</title>\n</head></html>\n');

  assert.equal((await installGoogleTag({ tagId: 'G-FIRST123', index })).action, 'added');
  const installed = await readFile(index, 'utf8');
  assert.equal(installed.match(/ngx-seo-kit:google-tag:start/g)?.length, 1);
  assert.match(installed, /gtag\('config', 'G-FIRST123'\)/);

  assert.equal((await installGoogleTag({ tagId: 'G-FIRST123', index })).action, 'unchanged');
  assert.equal((await installGoogleTag({ tagId: 'G-SECOND456', index })).action, 'updated');
  const updated = await readFile(index, 'utf8');
  assert.doesNotMatch(updated, /G-FIRST123/);
  assert.equal(updated.match(/googletagmanager\.com\/gtag\/js/g)?.length, 1);
});

test('refuses to duplicate an unmanaged Google tag', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-existing-analytics-'));
  const index = join(directory, 'index.html');
  await writeFile(
    index,
    '<html><head><script async src="https://www.googletagmanager.com/gtag/js?id=G-EXISTING"></script></head></html>',
  );

  await assert.rejects(
    installGoogleTag({ tagId: 'G-NEW123', index }),
    /already exists.*duplicate analytics events/,
  );
});
