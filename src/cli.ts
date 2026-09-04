#!/usr/bin/env node

import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select from '@inquirer/select';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tsImport } from 'tsx/esm/api';
import { generateSitemap, writeSitemap } from './sitemap.js';
import { discoverAngularRoutes, discoverRoutes } from './route-discovery.js';
import { normalizeSiteUrl, SiteUrlError, withDefaultProtocol } from './site-url.js';
import type { NgxSeoConfig } from './types.js';
import process from 'node:process';

const DEFAULT_CONFIG_FILES = [
  'seo.config.ts',
  'seo.config.mts',
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

  await offerLocalInstallation();

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

  const routes = config.sitemap.routes;

  if (routes.length === 0) {
    if (configCreated) {
      console.log(
        '\nNo Angular routes were discovered. Config was created; add sitemap.routes before generating the sitemap.',
      );
      return;
    }

    throw new Error(
      'No routes were configured. Add discoverRoutes(), routesToPaths(), or explicit URLs to sitemap.routes.',
    );
  }

  const output = options.output ?? config.sitemap.output ?? 'public/sitemap.xml';
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
    `\n✓ Sitemap generated: ${result.output} (${result.urlCount} URLs)`,
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

async function offerLocalInstallation(): Promise<void> {
  if (
    !isInteractiveTerminal() ||
    !(await fileExists(resolve('package.json'))) ||
    isPackageAvailableFromProject()
  ) {
    return;
  }

  const shouldInstall = await confirm({
    message: 'ngx-seo-kit is not installed in this project. Install it as a dev dependency?',
    default: true,
  });

  if (!shouldInstall) {
    return;
  }

  const version = await readPackageVersion();
  console.log(`\nInstalling ngx-seo-kit@${version} as a dev dependency...\n`);
  await installDevDependency(`ngx-seo-kit@${version}`);
  console.log('\n✓ ngx-seo-kit was added to devDependencies.');
}

function isPackageAvailableFromProject(): boolean {
  try {
    const projectRequire = createRequire(resolve('package.json'));
    projectRequire.resolve('ngx-seo-kit');
    return true;
  } catch {
    return false;
  }
}

async function readPackageVersion(): Promise<string> {
  const packageJsonPath = new URL('../../package.json', import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as {
    version?: unknown;
  };

  if (
    typeof packageJson.version !== 'string' ||
    !/^[0-9A-Za-z.+-]+$/.test(packageJson.version)
  ) {
    throw new Error('Could not determine the current ngx-seo-kit version.');
  }

  return packageJson.version;
}

async function installDevDependency(specifier: string): Promise<void> {
  const npmCliPath = process.env.npm_execpath;
  const executable = npmCliPath
    ? process.execPath
    : process.platform === 'win32'
      ? process.env.ComSpec ?? 'cmd.exe'
      : 'npm';
  const args = npmCliPath
    ? [npmCliPath, 'install', '--save-dev', specifier]
    : process.platform === 'win32'
      ? ['/d', '/s', '/c', `npm install --save-dev ${specifier}`]
      : ['install', '--save-dev', specifier];

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal
            ? `npm install was terminated by signal ${signal}.`
            : `npm install failed with exit code ${code ?? 'unknown'}.`,
        ),
      );
    });
  });
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
    ' _ __   __ _ __  __     ___  ___  ___        _  ___ _',
    "| '_ \\ / _` |\\ \\/ /    / __|/ _ \\/ _ \\      | |/ (_) |_",
    '| | | | (_| | >  <     \\__ \\  __/ (_) |     |   <| |  _|',
    '|_| |_|\\__, |/_/\\_\\    |___/\\___|\\___/      |_|\\_\\_|\\__|',
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
    default: requestedOutput ?? 'public/sitemap.xml',
    validate: (value) => value.trim().length > 0 || 'Output path cannot be empty.',
  });
  const excludeInput = await input({
    message: 'Excluded routes (comma separated)',
  });

  const exclude = parseList(excludeInput);
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
  await writeFile(
    configPath,
    serializeConfig(config, configPath, hasDefaultRouteFile ? `./${defaultRouteFile}` : undefined),
    {
      encoding: 'utf8',
      flag: 'wx',
    },
  );
  console.log(`\n✓ Config created: ${configPath}`);
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
      if (error.code === 'query-or-hash') {
        return 'Site URL cannot contain a query string or hash.';
      }
    }

    return 'Enter a valid absolute URL, for example https://example.com.';
  }
}

function serializeConfig(config: NgxSeoConfig, path: string, routeFile?: string): string {
  const extension = extname(path);
  const isTypeScript = extension === '.ts' || extension === '.mts';
  const useResolver = routeFile !== undefined && extension !== '.cjs';
  const marker = '__NGX_SEO_KIT_DISCOVER_ROUTES__';
  const serializable = useResolver
    ? { ...config, sitemap: { ...config.sitemap, routes: [marker] } }
    : config;
  let value = JSON.stringify(serializable, null, 2);
  if (useResolver) {
    value = value.replace(
      JSON.stringify(marker),
      `...await discoverRoutes(${JSON.stringify(routeFile)})`,
    );
  }
  const annotation = `/** @type {import('ngx-seo-kit').NgxSeoConfig} */`;

  if (extension === '.cjs') {
    return `${annotation}\nmodule.exports = ${value};\n`;
  }

  if (isTypeScript) {
    const imports = useResolver
      ? "import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';"
      : "import { defineSeoConfig } from 'ngx-seo-kit';";
    return `${imports}\n\nexport default defineSeoConfig(${value});\n`;
  }

  return `${useResolver ? "import { discoverRoutes } from 'ngx-seo-kit';\n\n" : ''}${annotation}\nexport default ${value};\n`;
}

async function loadConfig(path: string): Promise<unknown> {
  try {
    const extension = extname(path);
    const url = pathToFileURL(path).href;
    const module = (extension === '.ts' || extension === '.mts' || extension === '.cts'
      ? await tsImport(url, import.meta.url)
      : await import(url)) as { default?: unknown };
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

  if (!Array.isArray(config.sitemap.routes)) {
    throw new Error('sitemap.routes must be an array.');
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
  -c, --config <path>  Config file (default: seo.config.ts)
  -o, --output <path>  Override the sitemap output path
  -h, --help           Show this help

Examples:
  npx ngx-seo-kit
  npx ngx-seo-kit init
  npx ngx-seo-kit generate
  npx ngx-seo-kit generate --config config/seo.production.ts
  npx ngx-seo-kit generate --output public/sitemap.xml
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
