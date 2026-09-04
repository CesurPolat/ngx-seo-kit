import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  discoverAngularRoutes,
  generateSitemap,
  generateSitemapStylesheet,
  writeSitemap,
} from '../src/index.js';

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
       { path: 'account', loadChildren: () => import('./account/account.routes').then(m => m.ACCOUNT_ROUTES) },
       { path: 'legacy', redirectTo: 'about' },
       { path: 'users/:id', component: UserPage },
       { path: '**', component: NotFoundPage }
     ];
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
  ]);
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

test('CLI exposes init and generate commands in help', () => {
  const cli = resolve('dist/src/cli.js');
  const result = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /\(none\)\s+Open the interactive main menu/);
  assert.match(result.stdout, /ngx-seo-kit init/);
  assert.match(result.stdout, /generate\s+Generate sitemap/);
});

test('CLI does not open setup prompts in non-interactive environments', async () => {
  const cli = resolve('dist/src/cli.js');
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-cli-'));
  const result = spawnSync(process.execPath, [cli, 'generate'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /ngx-seo-kit init/);
});

test('CLI generates a sitemap from discovered routes without configured routes', async () => {
  const cli = resolve('dist/src/cli.js');
  const directory = await mkdtemp(join(tmpdir(), 'ngx-seo-kit-cli-routes-'));
  await mkdir(join(directory, 'src', 'app'), { recursive: true });
  await writeFile(
    join(directory, 'src', 'app', 'app.routes.ts'),
    `export const routes = [{ path: '', component: Home }, { path: 'about', component: About }];
     provideRouter(routes);`,
  );
  await writeFile(
    join(directory, 'seo.config.mjs'),
    `export default { siteUrl: 'https://example.com', sitemap: { output: 'dist/sitemap.xml', stylesheet: true } };`,
  );

  const result = spawnSync(process.execPath, [cli, 'generate'], {
    cwd: directory,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /2 URLs, 2 discovered/);
  assert.match(await readFile(join(directory, 'dist', 'sitemap.xml'), 'utf8'), /\/about/);
  assert.match(result.stdout, /Sitemap stylesheet generated/);
  assert.match(await readFile(join(directory, 'dist', 'sitemap.xsl'), 'utf8'), /<table>/);
});
