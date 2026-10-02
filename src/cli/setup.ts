import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { normalizeSiteUrl, SiteUrlError, withDefaultProtocol } from '../site-url.js';
import type { NgxSeoConfig } from '../types.js';
import { serializeConfig, validateConfig } from './config.js';
import { printCompletion } from './terminal.js';

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
  const discoveredRoutes: string[] = [];
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
  console.log('\nConfiguration summary');
  console.log(`  Site URL: ${config.siteUrl}`);
  console.log(`  Output:   ${config.sitemap.output}`);
  console.log('  Robots:   Enabled');
  console.log(`  Routes:   ${discoveredRoutes.length} configured`);
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
    serializeConfig(config, configPath),
    { encoding: 'utf8', flag: 'wx' },
  );
  printCompletion('SEO configuration created', [configPath]);
  return config;
}

export async function runSetupFromAnswers(
  configPath: string,
  requestedOutput: string | undefined,
  answers: Record<string, unknown>,
): Promise<NgxSeoConfig> {
  const siteUrl = readAnswer(answers, 'siteUrl');
  const output = readAnswer(answers, 'output') || requestedOutput || 'public/sitemap.xml';
  const exclude = parseList(readAnswer(answers, 'exclude', false));
  const config: NgxSeoConfig = {
    siteUrl: normalizeSiteUrl(withDefaultProtocol(siteUrl)),
    sitemap: { output, stylesheet: true, routes: [], ...(exclude.length > 0 ? { exclude } : {}) },
  };
  validateConfig(config, configPath);
  if (answers.create === false) throw new SetupCancelledError();
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, serializeConfig(config, configPath), { encoding: 'utf8', flag: 'wx' });
  printCompletion('SEO configuration created', [configPath]);
  return config;
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

export function validateSiteUrl(value: string): true | string {
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

function readAnswer(answers: Record<string, unknown>, name: string, required = true): string {
  const value = answers[name];
  if (typeof value === 'string' && (!required || value.trim())) return value.trim();
  if (!required) return '';
  throw new Error(`Missing GUI answer: ${name}`);
}

export class SetupCancelledError extends Error {}
