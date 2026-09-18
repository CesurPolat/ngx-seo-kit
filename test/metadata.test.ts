import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  generateSocialMetadataSnippet,
  installSocialMetadata,
} from '../src/metadata/social-metadata.js';

const metadata = {
  title: 'Example & Co',
  description: 'Angular <SEO> toolkit',
  url: 'https://example.com',
  image: 'https://example.com/social.png',
  siteName: 'Example',
  locale: 'tr_TR',
};

test('generates safe Open Graph and WebSite schema metadata', () => {
  const snippet = generateSocialMetadataSnippet(metadata);

  assert.match(snippet, /property="og:title" content="Example &amp; Co"/);
  assert.match(snippet, /property="og:description" content="Angular &lt;SEO&gt; toolkit"/);
  assert.match(snippet, /property="og:locale" content="tr_TR"/);
  assert.match(snippet, /"@type": "WebSite"/);
  assert.match(snippet, /"url": "https:\/\/example\.com\/"/);
});

test('installs, updates and deduplicates social metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-metadata-'));
  const index = join(directory, 'src', 'index.html');
  await mkdir(join(directory, 'src'), { recursive: true });
  await writeFile(index, '<html><head><title>App</title></head><body></body></html>');

  assert.equal((await installSocialMetadata({ ...metadata, index })).action, 'added');
  assert.equal((await installSocialMetadata({ ...metadata, index })).action, 'unchanged');
  assert.equal(
    (await installSocialMetadata({ ...metadata, title: 'Updated', index })).action,
    'updated',
  );

  const html = await readFile(index, 'utf8');
  assert.equal(html.match(/ngx-seo-kit:social-metadata:start/g)?.length, 1);
  assert.match(html, /property="og:title" content="Updated"/);
});

test('refuses to overwrite unmanaged Open Graph metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-existing-metadata-'));
  const index = join(directory, 'index.html');
  await writeFile(
    index,
    '<html><head><meta property="og:title" content="Existing"></head></html>',
  );

  await assert.rejects(
    installSocialMetadata({ ...metadata, index }),
    /already exists.*conflicting tags/,
  );
});

test('validates social metadata URLs and locale', () => {
  assert.throws(
    () => generateSocialMetadataSnippet({ ...metadata, image: '/social.png' }),
    /image must be an absolute URL/,
  );
  assert.throws(
    () => generateSocialMetadataSnippet({ ...metadata, locale: 'tr-tr' }),
    /locale must use/,
  );
});

test('metadata CLI installs Open Graph and Schema without an SEO config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-metadata-cli-'));
  const index = join(directory, 'src', 'index.html');
  await mkdir(join(directory, 'src'), { recursive: true });
  await writeFile(index, '<html><head></head><body></body></html>');

  const result = spawnSync(
    process.execPath,
    [
      resolve('dist/src/cli.js'),
      'metadata',
      '--title',
      'Example',
      '--description',
      'Example site',
      '--url',
      'https://example.com',
      '--image',
      'https://example.com/og-image.png',
      '--index',
      index,
    ],
    { cwd: directory, encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Open Graph & Schema installed/);
  const html = await readFile(index, 'utf8');
  assert.match(html, /property="og:title" content="Example"/);
  assert.match(html, /"@type": "WebSite"/);
});
