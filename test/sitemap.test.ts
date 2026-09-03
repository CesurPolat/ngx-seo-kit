import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { generateSitemap, writeSitemap } from '../src/index.js';

test('generates a valid sitemap with optional metadata', () => {
  const xml = generateSitemap({
    siteUrl: 'https://example.com/',
    routes: [
      '/',
      {
        path: '/projects/',
        lastmod: '2026-09-03',
        changefreq: 'monthly',
        priority: 0.8,
      },
    ],
  });

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/<\/loc>/);
  assert.match(xml, /<loc>https:\/\/example\.com\/projects<\/loc>/);
  assert.match(xml, /<lastmod>2026-09-03<\/lastmod>/);
  assert.match(xml, /<changefreq>monthly<\/changefreq>/);
  assert.match(xml, /<priority>0\.8<\/priority>/);
});

test('normalizes paths, removes duplicates and excludes configured routes', () => {
  const xml = generateSitemap({
    siteUrl: 'https://example.com',
    routes: ['projects/', '/projects', '//about//', '/private'],
    exclude: ['/private/'],
  });

  assert.equal(xml.match(/<url>/g)?.length, 2);
  assert.match(xml, /https:\/\/example\.com\/projects/);
  assert.match(xml, /https:\/\/example\.com\/about/);
  assert.doesNotMatch(xml, /private/);
});

test('escapes query parameters for XML', () => {
  const xml = generateSitemap({
    siteUrl: 'https://example.com',
    routes: ['/search?language=tr&sort=new'],
  });

  assert.match(xml, /language=tr&amp;sort=new/);
});

test('rejects invalid site URL and route metadata', () => {
  assert.throws(
    () => generateSitemap({ siteUrl: 'example.com', routes: ['/'] }),
    /Invalid siteUrl/,
  );
  assert.throws(
    () =>
      generateSitemap({
        siteUrl: 'https://example.com',
        routes: [{ path: '/', priority: 2 }],
      }),
    /between 0 and 1/,
  );
  assert.throws(
    () =>
      generateSitemap({
        siteUrl: 'https://example.com',
        routes: [{ path: '/', lastmod: '03.09.2026' }],
      }),
    /Invalid lastmod/,
  );
});

test('writes sitemap and creates missing output directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-'));
  const output = join(directory, 'nested', 'sitemap.xml');

  const result = await writeSitemap({
    siteUrl: 'https://example.com',
    routes: ['/', '/about'],
    output,
  });

  assert.equal(result.output, output);
  assert.equal(result.urlCount, 2);
  assert.match(await readFile(output, 'utf8'), /<urlset/);
});
