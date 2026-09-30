import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBreadcrumbListJsonLd, createOrganizationJsonLd, createWebSiteJsonLd, resolveSeoMetadata } from '../src/index.js';

test('resolves route metadata over parent and global fallbacks', () => {
  const result = resolveSeoMetadata(
    { title: 'Global', description: 'Default', canonical: 'https://example.com/' },
    [
      { title: 'Products', description: 'Products page' },
      { title: 'Widget', image: 'https://example.com/widget.png', robots: ['index', 'follow'] },
    ],
    '/products/widget',
    'https://example.com',
  );

  assert.equal(result.title, 'Widget');
  assert.equal(result.description, 'Products page');
  assert.equal(result.canonical, 'https://example.com/products/widget');
  assert.equal(result.robots, 'index,follow');
});

test('normalizes robots strings and rejects invalid URLs', () => {
  assert.throws(
    () => resolveSeoMetadata({ title: 'Home' }, [], '/', 'javascript:alert(1)'),
    /absolute URL|http or https/,
  );
  assert.throws(
    () => resolveSeoMetadata({ title: 'Home' }, [{ robots: 'no index' }], '/', 'https://example.com'),
    /invalid directive/,
  );
});

test('creates typed JSON-LD blocks', () => {
  assert.deepEqual(createWebSiteJsonLd({ name: 'Example', url: 'https://example.com' }), {
    '@type': 'WebSite', name: 'Example', url: 'https://example.com',
  });
  assert.deepEqual(createOrganizationJsonLd({ name: 'Example Inc.' }), {
    '@type': 'Organization', name: 'Example Inc.',
  });
  assert.equal(createBreadcrumbListJsonLd({ itemListElement: [] })['@type'], 'BreadcrumbList');
});
