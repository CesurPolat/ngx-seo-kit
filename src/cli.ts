#!/usr/bin/env node

import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { pathToFileURL } from 'node:url';
import { generateSitemap, writeSitemap } from './sitemap.js';
import type { NgxSeoConfig } from './types.js';

const DEFAULT_CONFIG_FILES = [
  'seo.config.mjs',
  'seo.config.js',
  'seo.config.cjs',
] as const;

interface CliOptions {
  command: 'generate' | 'init';
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

  const requestedConfigPath = options.config ? resolve(options.config) : undefined;
  let configPath: string;
  let config: unknown;

  if (options.command === 'init') {
    configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILES[0]);

    if (await fileExists(configPath)) {
      throw new Error(
        `Config already exists at "${configPath}". Remove it before running init again.`,
      );
    }

    assertInteractiveTerminal();
    config = await runSetupMenu(configPath, options.output);
  } else {
    const existingConfigPath = requestedConfigPath
      ? await requireConfig(requestedConfigPath)
      : await findConfig(process.cwd());

    if (existingConfigPath) {
      configPath = existingConfigPath;
      config = await loadConfig(configPath);
    } else {
      assertInteractiveTerminal();
      configPath = resolve(DEFAULT_CONFIG_FILES[0]);
      console.log("No SEO config found. Let's create one.\n");
      config = await runSetupMenu(configPath, options.output);
    }
  }

  validateConfig(config, configPath);

  const output = options.output ?? config.sitemap.output ?? 'dist/browser/sitemap.xml';
  const result = await writeSitemap({
    siteUrl: config.siteUrl,
    routes: config.sitemap.routes,
    ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
    output,
  });

  console.log(`\n✓ Sitemap generated: ${result.output} (${result.urlCount} URLs)`);
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { command: 'generate', help: false };
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === 'generate' || argument === 'init') {
      if (commandSeen) {
        throw new Error('Only one command can be specified.');
      }

      options.command = argument;
      commandSeen = true;
      continue;
    }

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

async function findConfig(directory: string): Promise<string | undefined> {
  for (const filename of DEFAULT_CONFIG_FILES) {
    const candidate = resolve(directory, filename);

    if (await fileExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function requireConfig(path: string): Promise<string> {
  if (!(await fileExists(path))) {
    throw new Error(`Config file not found at "${path}".`);
  }

  return path;
}

function assertInteractiveTerminal(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY || process.env.CI) {
    throw new Error(
      'Config file not found. Run "ngx-seo-kit init" in an interactive terminal first.',
    );
  }
}

async function runSetupMenu(
  configPath: string,
  requestedOutput?: string,
): Promise<NgxSeoConfig> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout });

  console.log('🚀 ngx-seo-kit setup\n');

  try {
    const siteUrl = await askRequired(prompt, 'Site URL', 'https://example.com');
    const output = await askRequired(
      prompt,
      'Sitemap output path',
      requestedOutput ?? 'dist/browser/sitemap.xml',
    );
    const routesInput = await askRequired(prompt, 'Routes (comma separated)', '/');
    const excludeInput = await prompt.question(
      'Excluded routes (comma separated, optional): ',
    );

    const routes = parseList(routesInput);
    const exclude = parseList(excludeInput);
    const config: NgxSeoConfig = {
      siteUrl,
      sitemap: {
        output,
        routes,
        ...(exclude.length > 0 ? { exclude } : {}),
      },
    };

    validateConfig(config, configPath);
    generateSitemap({ siteUrl, routes, ...(exclude.length > 0 ? { exclude } : {}) });
    await writeFile(configPath, serializeConfig(config), { encoding: 'utf8', flag: 'wx' });
    console.log(`\n✓ Config created: ${configPath}`);
    return config;
  } finally {
    prompt.close();
  }
}

async function askRequired(
  prompt: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
): Promise<string> {
  const answer = (await prompt.question(`${label} (${defaultValue}): `)).trim();
  return answer || defaultValue;
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function serializeConfig(config: NgxSeoConfig): string {
  return `/** @type {import('ngx-seo-kit').NgxSeoConfig} */\nexport default ${JSON.stringify(config, null, 2)};\n`;
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
  ngx-seo-kit [generate] [options]
  ngx-seo-kit init [options]

Commands:
  generate             Generate sitemap (default)
  init                 Open setup menu and create a config

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
