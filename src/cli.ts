#!/usr/bin/env node

import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeSitemap } from './sitemap.js';
import type { NgxSeoConfig } from './types.js';

const DEFAULT_CONFIG_FILES = [
  'seo.config.mjs',
  'seo.config.js',
  'seo.config.cjs',
] as const;

interface CliOptions {
  config?: string;
  output?: string;
  help: boolean;
}

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const configPath = options.config
    ? resolve(options.config)
    : await findConfig(process.cwd());
  const config = await loadConfig(configPath);
  validateConfig(config, configPath);

  const output = options.output ?? config.sitemap.output ?? 'dist/browser/sitemap.xml';
  const result = await writeSitemap({
    siteUrl: config.siteUrl,
    routes: config.sitemap.routes,
    ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
    output,
  });

  console.log(`✓ Sitemap generated: ${result.output} (${result.urlCount} URLs)`);
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { help: false };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    if (argument === '--config' || argument === '-c') {
      options.config = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--output' || argument === '-o') {
      options.output = readOptionValue(args, ++index, argument);
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];

  if (!value || value.startsWith('-')) {
    throw new Error(`${option} requires a value.`);
  }

  return value;
}

async function findConfig(directory: string): Promise<string> {
  for (const filename of DEFAULT_CONFIG_FILES) {
    const candidate = resolve(directory, filename);

    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported filename.
    }
  }

  throw new Error(
    `Config file not found. Create ${DEFAULT_CONFIG_FILES[0]} or pass --config <path>.`,
  );
}

async function loadConfig(path: string): Promise<unknown> {
  try {
    const module = (await import(pathToFileURL(path).href)) as { default?: unknown };
    return module.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load config at "${path}": ${message}`);
  }
}

function validateConfig(value: unknown, path: string): asserts value is NgxSeoConfig {
  if (!value || typeof value !== 'object') {
    throw new Error(`Config at "${path}" must have a default object export.`);
  }

  const config = value as Partial<NgxSeoConfig>;

  if (typeof config.siteUrl !== 'string' || !config.siteUrl.trim()) {
    throw new Error('Config must contain a non-empty siteUrl.');
  }

  if (!config.sitemap || !Array.isArray(config.sitemap.routes)) {
    throw new Error('Config must contain a sitemap.routes array.');
  }
}

function printHelp(): void {
  console.log(`ngx-seo-kit sitemap generator

Usage:
  ngx-seo-kit [options]

Options:
  -c, --config <path>  Config file (default: seo.config.mjs)
  -o, --output <path>  Override the sitemap output path
  -h, --help           Show this help
`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ ${message}`);
  process.exitCode = 1;
});
