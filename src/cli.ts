#!/usr/bin/env node

import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select from '@inquirer/select';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateSitemap, writeSitemap } from './sitemap.js';
import { discoverAngularRoutes } from './route-discovery.js';
import type { NgxSeoConfig } from './types.js';
import process from 'node:process';

const DEFAULT_CONFIG_FILES = [
  'seo.config.mjs',
  'seo.config.js',
  'seo.config.cjs',
] as const;

interface CliOptions {
  command?: 'generate' | 'init';
  config?: string;
  output?: string;
  help: boolean;
}

type MenuAction = 'generate' | 'init' | 'help' | 'exit';

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  const requestedConfigPath = options.config ? resolve(options.config) : undefined;
  let command = options.command;

  if (!command) {
    if (isInteractiveTerminal()) {
      const existingConfigPath = requestedConfigPath
        ? await optionalConfig(requestedConfigPath)
        : await findConfig(process.cwd());
      const action = await runMainMenu(Boolean(existingConfigPath));

      if (action === 'exit') {
        console.log('Goodbye!');
        return;
      }

      command = action;
    } else {
      command = 'generate';
    }
  }

  let configPath: string;
  let config: unknown;
  let configCreated = false;

  if (command === 'init') {
    configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILES[0]);

    if (await fileExists(configPath)) {
      throw new Error(
        `Config already exists at "${configPath}". Remove it before running init again.`,
      );
    }

    assertInteractiveTerminal();
    config = await runSetupMenu(configPath, options.output);
    configCreated = true;
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
      configCreated = true;
    }
  }

  validateConfig(config, configPath);

  const configuredRoutes = config.sitemap.routes ?? [];
  const discovery = config.sitemap.discoverRoutes;
  const discoveredRoutes =
    discovery === false
      ? []
      : await discoverAngularRoutes(
          process.cwd(),
          typeof discovery === 'object' ? discovery : {},
        );
  const routes = [...configuredRoutes, ...discoveredRoutes];

  if (routes.length === 0) {
    if (configCreated) {
      console.log(
        '\nNo Angular routes were discovered. Config was created; add sitemap.routes before generating the sitemap.',
      );
      return;
    }

    throw new Error(
      'No Angular routes were discovered. Add sitemap.routes to the config or check sitemap.discoverRoutes.root.',
    );
  }

  const output = options.output ?? config.sitemap.output ?? 'dist/browser/sitemap.xml';
  const result = await writeSitemap({
    siteUrl: config.siteUrl,
    routes,
    ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
    ...(config.sitemap.stylesheet !== undefined
      ? { stylesheet: config.sitemap.stylesheet }
      : {}),
    output,
  });

  console.log(
    `\n✓ Sitemap generated: ${result.output} (${result.urlCount} URLs, ${discoveredRoutes.length} discovered)`,
  );
  if (result.stylesheetOutput) {
    console.log(`✓ Sitemap stylesheet generated: ${result.stylesheetOutput}`);
  }
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { help: false };
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

async function optionalConfig(path: string): Promise<string | undefined> {
  return (await fileExists(path)) ? path : undefined;
}

function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

function assertInteractiveTerminal(): void {
  if (!isInteractiveTerminal()) {
    throw new Error(
      'Config file not found. Run "ngx-seo-kit init" in an interactive terminal first.',
    );
  }
}

async function runMainMenu(
  hasConfig: boolean,
): Promise<Exclude<MenuAction, 'help'>> {
  printBrand();

  while (true) {
    const action = await select<MenuAction>({
      message: 'What would you like to do?',
      choices: [
        {
          name: 'Generate sitemap',
          value: 'generate',
          description:
            'Create sitemap.xml from your config. Direct command: npx ngx-seo-kit generate',
        },
        {
          name: 'Create configuration',
          value: 'init',
          description:
            'Start the guided setup. Direct command: npx ngx-seo-kit init',
          ...(hasConfig ? { disabled: 'A configuration file already exists' } : {}),
        },
        {
          name: 'Help & command examples',
          value: 'help',
          description:
            'Show every command, option and example. Direct command: npx ngx-seo-kit --help',
        },
        {
          name: 'Exit',
          value: 'exit',
          description: 'Close ngx-seo-kit without making any changes.',
        },
      ],
    });

    if (action !== 'help') {
      return action;
    }

    printHelp();
  }
}

function printBrand(): void {
  const useColor = process.stdout.isTTY && !('NO_COLOR' in process.env);
  const colors = useColor
    ? [
        '\u001b[38;2;168;85;247m',
        '\u001b[38;2;217;70;239m',
        '\u001b[38;2;236;72;153m',
        '\u001b[38;2;34;211;238m',
        '\u001b[38;2;6;182;212m',
      ]
    : ['', '', '', '', ''];
  const accent = useColor ? '\u001b[38;2;250;204;21m' : '';
  const bold = useColor ? '\u001b[1m' : '';
  const reset = useColor ? '\u001b[0m' : '';
  const bannerLines = [
    ' _ __   __ _ __  __       ___  ___  ___       _  ___ _',
    "| '_ \\ / _` |\\ \\/ /_____ / __|/ _ \\/ _ \\_____| |/ (_) |_",
    '| | | | (_| | >  <_____\\__ \\  __/ (_) |_____|   <| |  _|',
    '|_| |_|\\__, |/_/\\_\\     |___/\\___|\\___/      |_|\\_\\_|\\__|',
    '       |___/',
  ];
  const banner = bannerLines
    .map((line, index) => `${colors[index]}${line}`)
    .join('\n');

  console.log(
    `\n${bold}${banner}${reset}\n` +
      `${accent}${bold}             Angular SEO tooling${reset}\n`,
  );
}

async function runSetupMenu(
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
    default: requestedOutput ?? 'dist/browser/sitemap.xml',
    validate: (value) => value.trim().length > 0 || 'Output path cannot be empty.',
  });
  const excludeInput = await input({
    message: 'Excluded routes (comma separated)',
  });

  const exclude = parseList(excludeInput);
  const discoveredRoutes = await discoverAngularRoutes(process.cwd());
  const config: NgxSeoConfig = {
    siteUrl: siteUrl.trim(),
    sitemap: {
      output: output.trim(),
      stylesheet: true,
      ...(discoveredRoutes.length === 0 ? { routes: [] } : {}),
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
  console.log(`  Routes:   ${discoveredRoutes.length} discovered automatically`);
  console.log('  Browser:  Styled HTML table');
  console.log(`  Excluded: ${exclude.length}`);
  if (discoveredRoutes.length === 0) {
    console.log('  Note:     Add public paths to sitemap.routes before generation');
  }

  const shouldCreate = await confirm({
    message:
      discoveredRoutes.length > 0
        ? 'Create configuration and generate the sitemap?'
        : 'Create configuration without generating the sitemap?',
    default: true,
  });

  if (!shouldCreate) {
    throw new SetupCancelledError();
  }

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, serializeConfig(config, configPath), {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`\n✓ Config created: ${configPath}`);
  return config;
}

function parseList(value: string): string[] {
  return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];
}

function validateSiteUrl(value: string): true | string {
  try {
    const url = new URL(value.trim());

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return 'Site URL must use http or https.';
    }

    if (url.search || url.hash) {
      return 'Site URL cannot contain a query string or hash.';
    }

    return true;
  } catch {
    return 'Enter a valid absolute URL, for example https://example.com.';
  }
}

function serializeConfig(config: NgxSeoConfig, path: string): string {
  const value = JSON.stringify(config, null, 2);
  const annotation = `/** @type {import('ngx-seo-kit').NgxSeoConfig} */`;

  return extname(path) === '.cjs'
    ? `${annotation}\nmodule.exports = ${value};\n`
    : `${annotation}\nexport default ${value};\n`;
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

  if (!config.sitemap || typeof config.sitemap !== 'object') {
    throw new Error('Config must contain a sitemap object.');
  }

  if (config.sitemap.routes !== undefined && !Array.isArray(config.sitemap.routes)) {
    throw new Error('sitemap.routes must be an array when provided.');
  }

  const discovery = config.sitemap.discoverRoutes;
  if (
    discovery !== undefined &&
    typeof discovery !== 'boolean' &&
    (typeof discovery !== 'object' || discovery === null)
  ) {
    throw new Error('sitemap.discoverRoutes must be a boolean or options object.');
  }

  if (
    typeof discovery === 'object' &&
    discovery !== null &&
    discovery.root !== undefined &&
    typeof discovery.root !== 'string'
  ) {
    throw new Error('sitemap.discoverRoutes.root must be a string.');
  }

  const stylesheet = config.sitemap.stylesheet;
  if (
    stylesheet !== undefined &&
    typeof stylesheet !== 'boolean' &&
    (typeof stylesheet !== 'object' || stylesheet === null)
  ) {
    throw new Error('sitemap.stylesheet must be a boolean or options object.');
  }

  if (typeof stylesheet === 'object' && stylesheet !== null) {
    for (const key of ['href', 'output', 'title'] as const) {
      const value = stylesheet[key];
      if (value !== undefined && (typeof value !== 'string' || !value.trim())) {
        throw new Error(`sitemap.stylesheet.${key} must be a non-empty string.`);
      }
    }
  }
}

function printHelp(): void {
  console.log(`ngx-seo-kit sitemap generator

Usage:
  npx ngx-seo-kit [options]
  npx ngx-seo-kit generate [options]
  npx ngx-seo-kit init [options]

Commands:
  (none)               Open the interactive main menu.
  generate             Generate sitemap.xml using the current config.
  init                 Create a config through the guided setup.

Options:
  -c, --config <path>  Config file (default: seo.config.mjs)
  -o, --output <path>  Override the sitemap output path
  -h, --help           Show this help

Examples:
  npx ngx-seo-kit
  npx ngx-seo-kit init
  npx ngx-seo-kit generate
  npx ngx-seo-kit generate --config config/seo.production.mjs
  npx ngx-seo-kit generate --output dist/browser/sitemap.xml
`);
}

class SetupCancelledError extends Error {}

main().catch((error: unknown) => {
  if (
    error instanceof SetupCancelledError ||
    (error instanceof Error && error.name === 'ExitPromptError')
  ) {
    console.log('\nSetup cancelled.');
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`✗ ${message}`);
  process.exitCode = 1;
});
