import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  discoverAngularRoutes,
  discoverRoutes,
  generateRobotsTxt,
  generateSitemap,
  generateSitemapStylesheet,
  routesToPaths,
  routesToPathsAsync,
  writeRobotsTxt,
  writeSitemap,
} from '../src/index.js';
import { normalizeSiteUrl, withDefaultProtocol } from '../src/site-url.js';

test('package can be loaded from CommonJS configs', () => {
  const packageExports = createRequire(import.meta.url)('ngx-seo-kit') as {
    defineSeoConfig?: unknown;
    generateRobotsTxt?: unknown;
    routesToPaths?: unknown;
  };

  assert.equal(typeof packageExports.defineSeoConfig, 'function');
  assert.equal(typeof packageExports.generateRobotsTxt, 'function');
  assert.equal(typeof packageExports.routesToPaths, 'function');
});

test('normalizes site URLs through shared URL helpers', () => {
  assert.equal(withDefaultProtocol(' example.com '), 'https://example.com');
  assert.equal(normalizeSiteUrl('https://example.com/'), 'https://example.com');
  assert.throws(() => normalizeSiteUrl('ftp://example.com'), /http or https/);
  assert.throws(() => normalizeSiteUrl('https://example.com?draft=1'), /query string or hash/);
});

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

test('generates robots.txt with an absolute sitemap reference', () => {
  assert.equal(
    generateRobotsTxt({ siteUrl: 'https://example.com' }),
    [
      'User-agent: *',
      'Allow: /',
      '',
      'Sitemap: https://example.com/sitemap.xml',
      '',
    ].join('\n'),
  );
});

test('generates custom robots.txt groups and sitemap references', () => {
  const robots = generateRobotsTxt({
    siteUrl: 'https://example.com',
    groups: [
      {
        userAgent: ['Googlebot', 'Bingbot'],
        allow: ['/'],
        disallow: ['/admin', '/preview'],
        crawlDelay: 2,
      },
    ],
    sitemap: ['/sitemap-news.xml', 'https://cdn.example.com/sitemap.xml'],
  });

  assert.match(robots, /User-agent: Googlebot\nUser-agent: Bingbot/);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Crawl-delay: 2/);
  assert.match(robots, /Sitemap: https:\/\/example\.com\/sitemap-news\.xml/);
  assert.match(robots, /Sitemap: https:\/\/cdn\.example\.com\/sitemap\.xml/);
});

test('writes robots.txt and creates missing output directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-robots-'));
  const output = join(directory, 'public', 'robots.txt');

  const result = await writeRobotsTxt({
    siteUrl: 'https://example.com',
    sitemap: ['/sitemap.xml', '/sitemap-images.xml'],
    output,
  });

  assert.equal(result.output, resolve(output));
  assert.equal(result.sitemapCount, 2);
  assert.match(await readFile(output, 'utf8'), /User-agent: \*/);
});

test('rejects invalid robots.txt directives', () => {
  assert.throws(
    () =>
      generateRobotsTxt({
        siteUrl: 'https://example.com',
        groups: [{ userAgent: 'bot\nDisallow: /' }],
      }),
    /Invalid robots\.txt user-agent/,
  );
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

test('adds an XSL instruction and writes a browser-friendly stylesheet', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-xsl-'));
  const output = join(directory, 'public', 'sitemap.xml');

  const result = await writeSitemap({
    siteUrl: 'https://example.com',
    routes: [{ path: '/', lastmod: '2026-09-04', priority: 1 }],
    output,
    stylesheet: { href: '/sitemap.xsl', title: 'Example Sitemap' },
  });

  assert.equal(result.stylesheetOutput, join(directory, 'public', 'sitemap.xsl'));
  assert.match(
    await readFile(output, 'utf8'),
    /<\?xml-stylesheet type="text\/xsl" href="\/sitemap\.xsl"\?>/,
  );
  const stylesheet = await readFile(result.stylesheetOutput, 'utf8');
  assert.match(stylesheet, /<title>Example Sitemap<\/title>/);
  assert.match(stylesheet, /select="sm:urlset\/sm:url"/);
  assert.match(stylesheet, /<th>Last modified<\/th>/);
});

test('escapes stylesheet titles and URLs', () => {
  assert.match(generateSitemapStylesheet('A & B'), /<title>A &amp; B<\/title>/);
  assert.match(
    generateSitemap({
      siteUrl: 'https://example.com',
      routes: ['/'],
      stylesheet: '/sitemap.xsl?theme=dark&compact=true',
    }),
    /theme=dark&amp;compact=true/,
  );
});

test('discovers standalone, nested and lazy Angular routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-routes-'));
  const app = join(directory, 'src', 'app');
  await mkdir(join(app, 'account'), { recursive: true });
  await writeFile(
    join(app, 'app.routes.ts'),
    `import { Routes } from '@angular/router';
     export const routes: Routes = [
       { path: '', loadComponent: () => import('./home') },
       { path: 'about', component: AboutPage },
       ...sharedRoutes,
       { path: 'account', loadChildren: () => import('./account/account.routes').then(m => m.ACCOUNT_ROUTES) },
       { path: 'legacy', redirectTo: 'about' },
       { path: 'users/:id', component: UserPage },
       { path: '**', component: NotFoundPage }
     ];
     const sharedRoutes = [{ path: 'contact', component: ContactPage }];
     provideRouter(routes);`,
  );
  await writeFile(
    join(app, 'account', 'account.routes.ts'),
    `export const ACCOUNT_ROUTES = [
       { path: '', component: AccountPage },
       { path: 'settings', component: SettingsPage },
       { path: 'team', children: [{ path: '', component: TeamPage }, { path: 'new', component: NewTeamPage }] }
     ];`,
  );

  assert.deepEqual(await discoverAngularRoutes(directory), [
    '/',
    '/about',
    '/account',
    '/account/settings',
    '/account/team',
    '/account/team/new',
    '/contact',
  ]);
  assert.deepEqual(await discoverRoutes('src/app/app.routes.ts', directory), [
    '/',
    '/about',
    '/account',
    '/account/settings',
    '/account/team',
    '/account/team/new',
    '/contact',
  ]);
});

test('converts an in-memory Angular routes array to sitemap paths', () => {
  const routes = [
    { path: '', loadComponent: () => undefined },
    { path: 'about', component: {} },
    {
      path: 'account',
      children: [
        { path: '', component: {} },
        { path: 'settings', component: {} },
      ],
    },
    { path: 'legacy', redirectTo: 'about' },
    { path: 'users/:id', component: {} },
    { path: '**', component: {} },
  ];

  assert.deepEqual(routesToPaths(routes), [
    '/',
    '/about',
    '/account',
    '/account/settings',
  ]);
});

test('resolves lazy in-memory route arrays to sitemap paths', async () => {
  const routes = [
    { path: '', component: {} },
    {
      path: 'account',
      loadChildren: async () => ({
        routes: [
          { path: 'settings', component: {} },
          { path: 'users/:id', component: {} },
        ],
      }),
    },
    {
      path: 'shop',
      loadChildren: async () => ({ default: [{ path: '', component: {} }] }),
    },
  ];

  assert.deepEqual(await routesToPathsAsync(routes), ['/', '/account/settings', '/shop']);
});

test('discovers routes imported by the standard Angular app config', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-app-config-routes-'));
  const app = join(directory, 'src', 'app');
  await mkdir(app, { recursive: true });
  await writeFile(
    join(app, 'app.routes.ts'),
    `import { Routes } from '@angular/router';
     export const routes: Routes = [
       { path: '', component: HomePage },
       { path: 'about', component: AboutPage }
     ];`,
  );
  await writeFile(
    join(app, 'app.config.ts'),
    `import { ApplicationConfig } from '@angular/core';
     import { provideRouter } from '@angular/router';
     import { routes as appRoutes } from './app.routes';
     export const appConfig: ApplicationConfig = {
       providers: [provideRouter(appRoutes)]
     };`,
  );

  assert.deepEqual(await discoverAngularRoutes(directory), ['/', '/about']);
});

test('CLI exposes init, generate and version commands in help', () => {
  const cli = resolve('dist/src/cli.js');
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\(none\)\s+Open the interactive main menu/);
  assert.match(result.stdout, /ngx-seo-kit init/);
  assert.match(result.stdout, /generate\s+Generate SEO files/);
  assert.match(result.stdout, /analytics\s+Install Google Analytics/);
  assert.match(result.stdout, /version\s+Print the installed ngx-seo-kit version/);
});

test('analytics CLI installs a tag without requiring an SEO config', async () => {
  const cli = resolve('dist/src/cli.js');
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-analytics-cli-'));
  await mkdir(join(directory, 'src'), { recursive: true });
  await writeFile(join(directory, 'src', 'index.html'), '<html><head></head><body></body></html>');
  const result = spawnSync(
    process.execPath,
    [cli, 'analytics', '--tag-id', 'G-ABC123XYZ'],
    { cwd: directory, encoding: 'utf8', env: { ...process.env, CI: '1' } },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Google Analytics installed: G-ABC123XYZ/);
  assert.match(
    await readFile(join(directory, 'src', 'index.html'), 'utf8'),
    /gtag\('config', 'G-ABC123XYZ'\)/,
  );
});

test('CLI prints its version without loading a config', async () => {
  const cli = resolve('dist/src/cli.js');
  const result = spawnSync(process.execPath, [cli, 'version'], { encoding: 'utf8' });
  const packageJson = JSON.parse(await readFile(resolve('package.json'), 'utf8')) as {
    version: string;
  };

  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), packageJson.version);
});

test('CLI generate does not create a missing configuration', async () => {
  const cli = resolve('dist/src/cli.js');
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-cli-'));
  const result = spawnSync(process.execPath, [cli, 'generate'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ngx-seo-kit init/);
  await assert.rejects(readFile(join(directory, 'seo.config.ts'), 'utf8'));
});

test('CLI generates a sitemap from routes discovered in the config', async () => {
  const cli = resolve('dist/src/cli.js');
  const packageEntry = pathToFileURL(resolve('dist/src/index.js')).href;
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-cli-routes-'));
  await mkdir(join(directory, 'src', 'app'), { recursive: true });
  await writeFile(
    join(directory, 'src', 'app', 'app.routes.ts'),
    `export const routes = [{ path: '', component: Home }, { path: 'about', component: About }];
     provideRouter(routes);`,
  );
  await writeFile(
    join(directory, 'seo.config.mjs'),
    `import { discoverRoutes } from ${JSON.stringify(packageEntry)};
     export default {
       siteUrl: 'https://example.com',
       sitemap: {
         routes: [...await discoverRoutes('./src/app/app.routes.ts')],
         stylesheet: true
       }
     };`,
  );

  const result = spawnSync(process.execPath, [cli, 'generate'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 URLs/);
  assert.match(await readFile(join(directory, 'public', 'sitemap.xml'), 'utf8'), /\/about/);
  assert.match(result.stdout, /Sitemap stylesheet generated/);
  assert.match(await readFile(join(directory, 'public', 'sitemap.xsl'), 'utf8'), /<table>/);
  assert.match(result.stdout, /Robots\.txt generated/);
  assert.match(
    await readFile(join(directory, 'public', 'robots.txt'), 'utf8'),
    /Sitemap: https:\/\/example\.com\/sitemap\.xml/,
  );
});

test('CLI loads a TypeScript config with an imported routes variable', async () => {
  const cli = resolve('dist/src/cli.js');
  const packageEntry = pathToFileURL(resolve('dist/src/index.js')).href;
  const testTempRoot = resolve('test', '.tmp');
  await mkdir(testTempRoot, { recursive: true });
  const directory = await mkdtemp(join(testTempRoot, 'cli-ts-config-'));
  await writeFile(join(directory, 'package.json'), JSON.stringify({ type: 'commonjs' }));
  await mkdir(join(directory, 'src', 'app', 'data'), { recursive: true });
  await writeFile(
    join(directory, 'src', 'app', 'data', 'projects.ts'),
    `export const projects = [];`,
  );
  await writeFile(
    join(directory, 'src', 'app', 'app.routes.ts'),
    `import { projects } from './data/projects';
     void projects;
     export const routes = [
       { path: '', component: {} },
       { path: 'about', component: {} },
       { path: 'users/:id', component: {} }
     ];`,
  );
  await writeFile(
    join(directory, 'seo.config.ts'),
    `import { defineSeoConfig, routesToPathsAsync } from ${JSON.stringify(packageEntry)};
     import { routes } from './src/app/app.routes.ts';
     export default defineSeoConfig({
       siteUrl: 'https://example.com',
       sitemap: {
         routes: await routesToPathsAsync(routes),
         output: 'public/sitemap.xml'
       },
       robots: false
     });`,
  );

  const result = spawnSync(process.execPath, [cli, 'generate'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });

  try {
    assert.equal(result.status, 0, result.stderr);
    const sitemap = await readFile(join(directory, 'public', 'sitemap.xml'), 'utf8');
    assert.match(sitemap, /<loc>https:\/\/example\.com\/<\/loc>/);
    assert.match(sitemap, /<loc>https:\/\/example\.com\/about<\/loc>/);
    assert.doesNotMatch(sitemap, /users/);
    await assert.rejects(readFile(join(directory, 'public', 'robots.txt'), 'utf8'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
