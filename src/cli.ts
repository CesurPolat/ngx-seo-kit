#!/usr/bin/env node

import confirm from '@inquirer/confirm';
import input from '@inquirer/input';
import select from '@inquirer/select';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { register as registerCommonJs } from 'tsx/cjs/api';
import { register } from 'tsx/esm/api';
import { generateSitemap, writeSitemap } from './sitemap-generation/index.js';
import { discoverAngularRoutes, discoverRoutes } from './sitemap-generation/route-discovery.js';
import { writeRobotsTxt } from './sitemap-generation/robots.js';
import { normalizeSiteUrl, SiteUrlError, withDefaultProtocol } from './site-url.js';
import type { NgxSeoConfig } from './types.js';
import process from 'node:process';
import { installGoogleTag, normalizeGoogleTagId } from './analytics/google-tag.js';
import { installSocialMetadata } from './metadata/social-metadata.js';

const DEFAULT_CONFIG_FILES = [
  'seo.config.ts',
  'seo.config.mts',
  'seo.config.mjs',
  'seo.config.js',
  'seo.config.cjs',
] as const;

interface CliOptions {
  command?: 'generate' | 'init' | 'analytics' | 'metadata' | 'version';
  config?: string;
  output?: string;
  tagId?: string;
  index?: string;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  locale?: string;
  help: boolean;
}

type MenuAction =
  | 'generate'
  | 'analytics'
  | 'metadata'
  | 'route-export-test'
  | 'help'
  | 'exit';

async function main(): Promise<void> {
  const options = parseArguments(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.command === 'version') {
    console.log(await readPackageVersion());
    return;
  }

  await offerLocalInstallation();
  await notifyPackageUpdate();

  const requestedConfigPath = options.config ? resolve(options.config) : undefined;

  if (options.command) {
    await runCommand(options.command, options, requestedConfigPath);
    return;
  }

  if (!isInteractiveTerminal()) {
    await runCommand('generate', options, requestedConfigPath);
    return;
  }

  while (true) {
    const action = await runMainMenu();

    if (action === 'exit') {
      console.log('Goodbye!');
      return;
    }

    try {
      if (action === 'route-export-test') {
        await runRouteExportTest();
        continue;
      }

      await runCommand(action, options, requestedConfigPath);
    } catch (error) {
      if (
        error instanceof SetupCancelledError ||
        (error instanceof Error && error.name === 'ExitPromptError')
      ) {
        console.log('\nSetup cancelled.');
        continue;
      }

      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${message}`);
    }
  }
}

async function runCommand(
  command: Exclude<NonNullable<CliOptions['command']>, 'version'>,
  options: CliOptions,
  requestedConfigPath?: string,
): Promise<void> {
  if (command === 'analytics') {
    await runAnalyticsSetup(options);
    return;
  }

  if (command === 'metadata') {
    await runMetadataSetup(options);
    return;
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
      configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILES[0]);
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

  if (config.robots !== false) {
    const robots = config.robots ?? {};
    const robotsResult = await writeRobotsTxt({
      siteUrl: config.siteUrl,
      output: robots.output ?? join(dirname(output), 'robots.txt'),
      ...(robots.groups ? { groups: robots.groups } : {}),
      ...(robots.sitemap !== undefined
        ? { sitemap: robots.sitemap }
        : { sitemap: `/${basename(output)}` }),
    });
    console.log(`✓ Robots.txt generated: ${robotsResult.output}`);
  }
}

function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { help: false };
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (
      argument === 'generate' ||
      argument === 'init' ||
      argument === 'analytics' ||
      argument === 'metadata' ||
      argument === 'version'
    ) {
      if (commandSeen) {
        throw new Error('Only one command can be specified.');
      }

      options.command = argument;
      commandSeen = true;
      continue;
    }

    if (argument === '--version' || argument === '-v') {
      if (commandSeen) {
        throw new Error('Only one command can be specified.');
      }

      options.command = 'version';
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

    if (argument === '--tag-id') {
      options.tagId = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--index') {
      options.index = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--title') {
      options.title = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--description') {
      options.description = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--url') {
      options.url = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--image') {
      options.image = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--site-name') {
      options.siteName = readOptionValue(args, ++index, argument);
      continue;
    }

    if (argument === '--locale') {
      options.locale = readOptionValue(args, ++index, argument);
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

async function notifyPackageUpdate(): Promise<void> {
  if (!shouldCheckForUpdates()) return;

  try {
    const currentVersion = await readPackageVersion();
    const response = await fetch('https://registry.npmjs.org/ngx-seo-kit/latest', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1_500),
    });

    if (!response.ok) return;

    const latest = (await response.json()) as { version?: unknown };
    if (typeof latest.version === 'string' && isNewerVersion(latest.version, currentVersion)) {
      console.warn(
        `\nUpdate available: ngx-seo-kit ${currentVersion} → ${latest.version}\n` +
          'Run: npm install -D ngx-seo-kit@latest\n',
      );
    }
  } catch {
    // A version check must never block sitemap generation.
  }
}

function shouldCheckForUpdates(): boolean {
  return (
    isInteractiveTerminal() &&
    process.env.NO_UPDATE_NOTIFIER !== '1' &&
    process.env.NGX_SEO_KIT_DISABLE_UPDATE_CHECK !== '1'
  );
}

function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return false;

  for (const index of [0, 1, 2] as const) {
    const difference = candidateParts.core[index] - currentParts.core[index];
    if (difference !== 0) return difference > 0;
  }

  if (candidateParts.prerelease.length === 0 || currentParts.prerelease.length === 0) {
    return candidateParts.prerelease.length === 0 && currentParts.prerelease.length > 0;
  }

  const length = Math.max(candidateParts.prerelease.length, currentParts.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const candidateIdentifier = candidateParts.prerelease[index];
    const currentIdentifier = currentParts.prerelease[index];
    if (candidateIdentifier === undefined) return false;
    if (currentIdentifier === undefined) return true;
    if (candidateIdentifier === currentIdentifier) continue;

    const candidateNumber = Number(candidateIdentifier);
    const currentNumber = Number(currentIdentifier);
    if (Number.isInteger(candidateNumber) && Number.isInteger(currentNumber)) {
      return candidateNumber > currentNumber;
    }
    if (Number.isInteger(candidateNumber)) return false;
    if (Number.isInteger(currentNumber)) return true;
    return candidateIdentifier > currentIdentifier;
  }

  return false;
}

function parseVersion(
  version: string,
): { core: [number, number, number]; prerelease: string[] } | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(
    version,
  );
  if (!match) return undefined;

  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4]?.split('.') ?? [],
  };
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

async function runMainMenu(): Promise<Exclude<MenuAction, 'help'>> {
  printBrand();

  while (true) {
    const action = await select<MenuAction>({
      message: 'What would you like to do?',
      choices: [
        {
          name: 'Generate SEO files (sitemap.xml, robots.txt, etc.)',
          value: 'generate',
          description:
            'Create search-engine files from your config. Direct command: npx ngx-seo-kit generate',
        },
        {
          name: 'Set up Google Analytics',
          value: 'analytics',
          description:
            'Install a Google tag in the Angular app. Direct command: npx ngx-seo-kit analytics',
        },
        {
          name: 'Set up Open Graph & Schema',
          value: 'metadata',
          description:
            'Install global social and structured metadata. Direct command: npx ngx-seo-kit metadata',
        },
        {
          name: 'Run runtime route export test',
          value: 'route-export-test',
          description:
            'Run the Router.config test once and print its discovered paths.',
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

/** Runs the Angular test that reads the route configuration from Router.config. */
async function runRouteExportTest(): Promise<void> {
  await ensureRouteExportTestFiles();

  const ngArgs = ['test', '--include=**/route-export.service.spec.ts', '--watch=false'];
  const executable = process.platform === 'win32'
    ? process.env.ComSpec ?? 'cmd.exe'
    : 'ng';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `ng ${ngArgs.join(' ')}`]
    : ngArgs;

  console.log(`\nRunning: ng ${ngArgs.join(' ')}\n`);

  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    child.once('error', (error) => {
      const notFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
      reject(
        notFound
          ? new Error(
              'Angular CLI was not found. Run this option from an Angular project with @angular/cli installed.',
            )
          : error,
      );
    });
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(
        new Error(
          signal
            ? `Route export test was terminated by signal ${signal}.`
            : `Route export test failed with exit code ${code ?? 'unknown'}.`,
        ),
      );
    });
  });
}

/** Creates the Angular service/spec once, using the app's exported route array. */
async function ensureRouteExportTestFiles(): Promise<void> {
  const appDirectory = resolve('src', 'app');
  const routeFile = join(appDirectory, 'app.routes.ts');
  const serviceFile = join(appDirectory, 'route-export.service.ts');
  const specFile = join(appDirectory, 'route-export.service.spec.ts');

  if (await fileExists(specFile)) {
    await migrateRouteExportService(serviceFile);
    return;
  }

  if (!(await fileExists(routeFile))) {
    throw new Error(
      'Route export test could not be created because src/app/app.routes.ts was not found. Create that file or add route-export.service.spec.ts manually.',
    );
  }

  const routeSource = await readFile(routeFile, 'utf8');
  const setup = exportedRouteImport(routeSource) ?? await exportedAppConfigImport(appDirectory);
  if (!setup) {
    throw new Error(
      'Could not find an exported route array in src/app/app.routes.ts or an exported application config in src/app/app.config.ts. Export one of them and run this option again.',
    );
  }

  await mkdir(appDirectory, { recursive: true });
  if (!(await fileExists(serviceFile))) {
    await writeFile(serviceFile, routeExportServiceSource(), { encoding: 'utf8', flag: 'wx' });
    console.log(`Created: ${serviceFile}`);
  }
  await writeFile(specFile, routeExportSpecSource(setup), {
    encoding: 'utf8',
    flag: 'wx',
  });
  console.log(`Created: ${specFile}`);
}

/** Finds a conventional named or default export of an Angular route array. */
interface RouteTestSetup {
  importStatement: string;
  providersExpression: string;
}

function exportedRouteImport(source: string): RouteTestSetup | undefined {
  const namedRoutes = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*routes[\w$]*)\b/i.exec(
    source,
  );
  if (namedRoutes?.[1]) {
    return {
      importStatement: `import { ${namedRoutes[1]} as applicationRoutes } from './app.routes';`,
      providersExpression: 'provideRouter(applicationRoutes)',
    };
  }

  return /export\s+default\b/.test(source)
    ? {
        importStatement: "import applicationRoutes from './app.routes';",
        providersExpression: 'provideRouter(applicationRoutes)',
      }
    : undefined;
}

/** Uses the app's ApplicationConfig when its route array is intentionally private. */
async function exportedAppConfigImport(appDirectory: string): Promise<RouteTestSetup | undefined> {
  const configFile = join(appDirectory, 'app.config.ts');
  if (!(await fileExists(configFile))) return undefined;

  const source = await readFile(configFile, 'utf8');
  const namedConfig = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*config[\w$]*)\b/i.exec(
    source,
  );
  if (namedConfig?.[1]) {
    return {
      importStatement: `import { ${namedConfig[1]} as applicationConfig } from './app.config';`,
      providersExpression: 'applicationConfig.providers',
    };
  }

  return /export\s+default\b/.test(source)
    ? {
        importStatement: "import applicationConfig from './app.config';",
        providersExpression: 'applicationConfig.providers',
      }
    : undefined;
}

function routeExportServiceSource(): string {
  return `import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { routesToPaths } from 'ngx-seo-kit';

@Injectable({ providedIn: 'root' })
export class RouteExportService {
  constructor(private readonly router: Router) {}

  sitemapPaths(): string[] {
    return routesToPaths(this.router.config);
  }
}
`;
}

/** Updates only the obsolete service template generated by an earlier CLI version. */
async function migrateRouteExportService(serviceFile: string): Promise<void> {
  if (!(await fileExists(serviceFile))) return;

  const source = await readFile(serviceFile, 'utf8');
  if (!source.includes("import { routesToPathsAsync } from 'ngx-seo-kit';")) return;

  await writeFile(serviceFile, routeExportServiceSource(), { encoding: 'utf8' });
  console.log(`Updated: ${serviceFile}`);
}

function routeExportSpecSource(setup: RouteTestSetup): string {
  return `import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
${setup.importStatement}
import { RouteExportService } from './route-export.service';

describe('RouteExportService', () => {
  it('reads paths from Angular Router.config', async () => {
    TestBed.configureTestingModule({
      providers: [${setup.providersExpression}],
    });

    const service = TestBed.inject(RouteExportService);
    const paths = await service.sitemapPaths();

    console.info('[ngx-seo-kit] Runtime router paths:', paths);
    expect(paths.length).toBeGreaterThan(0);
  });
});
`;
}

async function runAnalyticsSetup(options: CliOptions): Promise<void> {
  let tagId = options.tagId;

  if (!tagId) {
    assertInteractiveAnalyticsTerminal();
    tagId = await input({
      message: 'Google Analytics measurement ID',
      validate: (value) => {
        try {
          normalizeGoogleTagId(value);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Enter a valid measurement ID.';
        }
      },
    });
  }

  const result = await installGoogleTag({
    tagId,
    ...(options.index ? { index: options.index } : {}),
  });
  const labels = {
    added: 'installed',
    updated: 'updated',
    unchanged: 'already configured',
  } as const;

  console.log(`\n✓ Google Analytics ${labels[result.action]}: ${result.tagId}`);
  console.log(`  Index: ${result.index}`);
}

async function runMetadataSetup(options: CliOptions): Promise<void> {
  const interactive = isInteractiveTerminal();
  if (
    !interactive &&
    (!options.title || !options.description || !options.url || !options.image)
  ) {
    throw new Error(
      'Open Graph setup requires --title, --description, --url, and --image in CI and non-interactive terminals.',
    );
  }

  const url = options.url ?? await input({
    message: 'Canonical site URL',
    default: 'https://example.com',
    validate: validateAbsoluteHttpUrl,
  });
  const title = options.title ?? await input({
    message: 'Open Graph title',
    validate: validateRequiredText,
  });
  const description = options.description ?? await input({
    message: 'Open Graph description',
    validate: validateRequiredText,
  });
  const image = options.image ?? await input({
    message: 'Social image URL',
    default: new URL('/og-image.png', url).toString(),
    validate: validateAbsoluteHttpUrl,
  });
  const siteName = options.siteName ?? (interactive
    ? await input({
        message: 'Site name',
        default: title,
        validate: validateRequiredText,
      })
    : title);
  const locale = options.locale ?? (interactive
    ? await input({
        message: 'Open Graph locale',
        default: 'en_US',
        validate: (value) =>
          /^[a-z]{2}_[A-Z]{2}$/.test(value.trim()) || 'Use a locale like en_US or tr_TR.',
      })
    : 'en_US');

  const result = await installSocialMetadata({
    title,
    description,
    url,
    image,
    siteName,
    locale,
    ...(options.index ? { index: options.index } : {}),
  });
  const labels = {
    added: 'installed',
    updated: 'updated',
    unchanged: 'already configured',
  } as const;

  console.log(`\n✓ Open Graph & Schema ${labels[result.action]}`);
  console.log(`  Index: ${result.index}`);
}

function validateRequiredText(value: string): true | string {
  return value.trim().length > 0 || 'This value cannot be empty.';
}

function validateAbsoluteHttpUrl(value: string): true | string {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? true
      : 'URL must use http or https.';
  } catch {
    return 'Enter a valid absolute URL.';
  }
}

function assertInteractiveAnalyticsTerminal(): void {
  if (!isInteractiveTerminal()) {
    throw new Error(
      'Google Analytics setup requires --tag-id in CI and non-interactive terminals.',
    );
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
  console.log('  Robots:   Enabled');
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
    let module: { default?: unknown };

    if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
      // tsx scopes imports by appending a namespace query to every loaded
      // module. Some Windows Node versions can treat that query as part of a
      // CommonJS package entry's filename. A `.ts` config in a CommonJS
      // project also cannot use top-level await. The fallback retries either
      // case as an ESM config.
      const unregister = register();
      const unregisterCommonJs = registerCommonJs();
      try {
        try {
          module = (await import(url)) as { default?: unknown };
        } catch (error) {
          if (!shouldRetryTypeScriptConfigAsModule(error) || extension !== '.ts') {
            throw error;
          }

          module = await importTypeScriptConfigAsModule(path);
        }
      } finally {
        unregisterCommonJs();
        await unregister();
      }
    } else {
      module = (await import(url)) as { default?: unknown };
    }

    const defaultExport = module.default;
    if (
      defaultExport &&
      typeof defaultExport === 'object' &&
      '__esModule' in defaultExport &&
      'default' in defaultExport
    ) {
      return (defaultExport as { default: unknown }).default;
    }

    return defaultExport;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not load config at "${path}": ${message}`);
  }
}

function shouldRetryTypeScriptConfigAsModule(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  return (
    (/(?:\?|%3F)namespace(?:=|%3D)/i.test(error.message) &&
      /Cannot find module/i.test(error.message)) ||
    /Top-level await is currently not supported with the "cjs" output format/i.test(
      error.message,
    )
  );
}

async function importTypeScriptConfigAsModule(path: string): Promise<{ default?: unknown }> {
  const temporaryPath = resolve(
    dirname(path),
    `.${basename(path)}.ngx-seo-kit-${randomUUID()}.mts`,
  );

  await writeFile(temporaryPath, await readFile(path, 'utf8'));
  try {
    return (await import(pathToFileURL(temporaryPath).href)) as { default?: unknown };
  } finally {
    await rm(temporaryPath, { force: true });
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

  const robots = config.robots;
  if (
    robots !== undefined &&
    robots !== false &&
    (typeof robots !== 'object' || robots === null)
  ) {
    throw new Error('robots must be false or an options object.');
  }

  if (typeof robots === 'object' && robots !== null) {
    if (
      robots.output !== undefined &&
      (typeof robots.output !== 'string' || !robots.output.trim())
    ) {
      throw new Error('robots.output must be a non-empty string.');
    }
    if (robots.groups !== undefined && !Array.isArray(robots.groups)) {
      throw new Error('robots.groups must be an array.');
    }
    if (
      robots.sitemap !== undefined &&
      robots.sitemap !== false &&
      typeof robots.sitemap !== 'string' &&
      !Array.isArray(robots.sitemap)
    ) {
      throw new Error('robots.sitemap must be a string, array, or false.');
    }
  }
}

function printHelp(): void {
  console.log(`ngx-seo-kit Angular SEO toolkit

Usage:
  npx ngx-seo-kit [options]
  npx ngx-seo-kit generate [options]
  npx ngx-seo-kit init [options]
  npx ngx-seo-kit analytics [options]
  npx ngx-seo-kit metadata [options]
  npx ngx-seo-kit version

Commands:
  (none)               Open the interactive main menu.
  generate             Generate SEO files (sitemap.xml, robots.txt, etc.).
  init                 Create a config through the guided setup.
  analytics            Install Google Analytics in an Angular index file.
  metadata             Install Open Graph and Schema.org metadata.
  version              Print the installed ngx-seo-kit version.

Options:
  -c, --config <path>  Config file (default: seo.config.ts)
  -o, --output <path>  Override the sitemap output path
  --tag-id <id>        Google Analytics measurement ID (for example G-XXXXXXXXXX)
  --index <path>       Angular index file for analytics or metadata
  --title <text>       Open Graph title used by metadata
  --description <text> Open Graph description used by metadata
  --url <url>          Canonical absolute URL used by metadata
  --image <url>        Absolute social image URL used by metadata
  --site-name <text>   Optional Open Graph site name
  --locale <locale>    Open Graph locale (default: en_US)
  -h, --help           Show this help
  -v, --version        Print the installed ngx-seo-kit version

Examples:
  npx ngx-seo-kit
  npx ngx-seo-kit init
  npx ngx-seo-kit version
  npx ngx-seo-kit generate
  npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX
  npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX --index projects/app/src/index.html
  npx ngx-seo-kit metadata --title "Example" --description "Example site" --url https://example.com --image https://example.com/og-image.png
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
