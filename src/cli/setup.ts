import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { generateSitemap } from '../sitemap-generation/index.js';
import { discoverAngularRoutes, discoverRoutes } from '../route-discovery/index.js';
import { normalizeSiteUrl, SiteUrlError, withDefaultProtocol } from '../site-url.js';
import type { NgxSeoConfig } from '../types.js';
import { fileExists, serializeConfig, validateConfig } from './config.js';

export async function runSetupMenu(
  configPath: string,
  requestedOutput?: string,
): Promise<NgxSeoConfig> {
  console.log('\nCreate SEO configuration\n');
  const siteUrl = await input({
    message: 'Site URL',
    default: 'https://example.com',
    validate: validateSiteUrl,
  });
  const output = await input({
    message: 'Sitemap output path',
    default: requestedOutput ?? 'public/sitemap.xml',
    validate: (value) => value.trim().length > 0 || 'Output path cannot be empty.',
  });
  const exclude = parseList(await input({ message: 'Excluded routes (comma separated)' }));
  const defaultRouteFile = 'src/app/app.routes.ts';
  const hasDefaultRouteFile = await fileExists(resolve(defaultRouteFile));
  const discoveredRoutes = hasDefaultRouteFile
    ? await discoverRoutes(defaultRouteFile)
    : await discoverAngularRoutes(process.cwd());
  const config: NgxSeoConfig = {
    siteUrl: normalizeSiteUrl(withDefaultProtocol(siteUrl)),
    sitemap: {
      output: output.trim(),
      stylesheet: true,
      routes: discoveredRoutes,
      ...(exclude.length > 0 ? { exclude } : {}),
    },
  };

  validateConfig(config, configPath);
  if (discoveredRoutes.length > 0) {
    generateSitemap({ siteUrl: config.siteUrl, routes: discoveredRoutes });
  }

  console.log('\nConfiguration summary');
  console.log(`  Site URL: ${config.siteUrl}`);
  console.log(`  Output:   ${config.sitemap.output}`);
  console.log('  Robots:   Enabled');
  console.log(`  Routes:   ${discoveredRoutes.length} discovered automatically`);
  console.log('  Browser:  Styled HTML table');
  console.log(`  Excluded: ${exclude.length}`);
  if (discoveredRoutes.length === 0) {
    console.log('  Note:     Add public paths to sitemap.routes before generation');
  }

  const shouldCreate = await confirm({
    message: discoveredRoutes.length > 0
      ? 'Create configuration and generate the sitemap?'
      : 'Create configuration without generating the sitemap?',
    default: true,
  });
  if (!shouldCreate) throw new SetupCancelledError();

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    serializeConfig(config, configPath, hasDefaultRouteFile ? `./${defaultRouteFile}` : undefined),
    { encoding: 'utf8', flag: 'wx' },
  );
  console.log(`\nâœ“ Config created: ${configPath}`);
  return config;
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function validateSiteUrl(value: string): true | string {
  try {
    normalizeSiteUrl(withDefaultProtocol(value));
    return true;
  } catch (error) {
    if (error instanceof SiteUrlError) {
      if (error.code === 'unsupported-protocol') return 'Site URL must use http or https.';
      if (error.code === 'query-or-hash') return 'Site URL cannot contain a query string or hash.';
    }
    return 'Enter a valid absolute URL, for example https://example.com.';
  }
}

export class SetupCancelledError extends Error {}
