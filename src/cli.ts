#!/usr/bin/env node

import { basename, dirname, join, resolve } from 'node:path';
import process from 'node:process';
import {
  fileExists,
  findConfig,
  loadConfig,
  requireConfig,
  validateConfig,
} from './cli/config.js';
import { runAnalyticsSetup, runMetadataSetup } from './cli/feature-setup.js';
import { runAnalyticsSetupFromAnswers, runMetadataSetupFromAnswers } from './cli/feature-setup.js';
import { formatError } from './cli/errors.js';
import { runGuiFlow } from './cli/gui.js';
import { runMainMenu } from './cli/menu.js';
import { parseArguments, printHelp, type CliOptions } from './cli/options.js';
import {
  findPackageUpdate,
  offerLocalInstallation,
  printPackageUpdateNotice,
  readPackageVersion,
  updatePackage,
} from './cli/package-manager.js';
import { runSetupFromAnswers, runSetupMenu, SetupCancelledError } from './cli/setup.js';
import {
  assertInteractiveTerminal,
  clearTerminal,
  isInteractiveTerminal,
  printCompletion,
  waitForKeypress,
} from './cli/terminal.js';
import { writeSitemap } from './sitemap-generation/index.js';
import { writeRobotsTxt } from './sitemap-generation/robots.js';
import { getProjectStatus } from './project-status/index.js';
import { runSeoBuild } from './seo-build.js';

const DEFAULT_CONFIG_FILE = 'seo.config.ts';

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
  if (options.command === 'update') {
    await updatePackage(undefined, true);
    return;
  }

  await offerLocalInstallation();
  const packageUpdate = await findPackageUpdate();
  const requestedConfigPath = options.config ? resolve(options.config) : undefined;

  if (options.command) {
    printPackageUpdateNotice(packageUpdate);
    await runCommand(options.command, options, requestedConfigPath);
    return;
  }
  if (options.gui) {
    try {
      await runGuiFlow(options, packageUpdate, async (command, answers) => {
        if (command === 'update') {
          await updatePackage(packageUpdate);
          return;
        }
        if (command === 'version') {
          console.log(await readPackageVersion());
          return;
        }
        await runCommand(command, { ...options, guiAnswers: answers }, requestedConfigPath);
      }, requestedConfigPath);
    } catch (error) {
      if (!isInteractiveTerminal()) throw error;
      console.error(`[error] ${formatError(error)}`);
      console.log('Returning to the terminal menu...');
      await runInteractiveMenu(packageUpdate, options, requestedConfigPath);
    }
    return;
  }
  if (!isInteractiveTerminal()) {
    printPackageUpdateNotice(packageUpdate);
    await runCommand('generate', options, requestedConfigPath);
    return;
  }

  await runInteractiveMenu(packageUpdate, options, requestedConfigPath);
}

async function runInteractiveMenu(
  packageUpdate: Awaited<ReturnType<typeof findPackageUpdate>>,
  options: CliOptions,
  requestedConfigPath?: string,
): Promise<void> {
  while (true) {
    const action = await runMainMenu(packageUpdate);
    if (action === 'exit') {
      console.log('Goodbye!');
      return;
    }

    try {
      if (action === 'gui') {
        await runGuiFlow(options, packageUpdate, async (command, answers) => {
          if (command === 'update') {
            await updatePackage(packageUpdate);
            return;
          }
          if (command === 'version') {
            console.log(await readPackageVersion());
            return;
          }
          await runCommand(command, { ...options, guiAnswers: answers }, requestedConfigPath);
        }, requestedConfigPath);
        continue;
      }
      if (action === 'update') {
        await updatePackage(packageUpdate);
        return;
      }
      await runCommand(action, options, requestedConfigPath);
      await waitForKeypress();
      clearTerminal();
      await new Promise<void>((resolve) => setImmediate(resolve));
    } catch (error) {
      if (isSetupCancellation(error)) {
        console.log('\nSetup cancelled.');
        continue;
      }
      console.error(`[error] ${formatError(error)}`);
      await waitForKeypress();
      clearTerminal();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  }
}

async function runCommand(
  command: Exclude<NonNullable<CliOptions['command']>, 'update' | 'version'>,
  options: CliOptions,
  requestedConfigPath?: string,
): Promise<void> {
  if (command === 'build') {
    const report = await runSeoBuild({
      ...(requestedConfigPath ? { config: requestedConfigPath } : {}),
      ...(options.output ? { output: options.output } : {}),
      ...(options.angular ? { angular: true } : {}),
      ...(options.strict ? { strict: true } : {}),
    });
    if (options.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printCompletion(report.passed ? 'SEO build completed' : 'SEO build failed', [
        `Routes: ${report.routeCount}`,
        ...(report.generatedFiles.length > 0 ? [`Generated: ${report.generatedFiles.join(', ')}`] : []),
        ...report.warnings.map((warning) => `Warning: ${warning}`),
        ...report.errors.map((error) => `Error: ${error}`),
      ]);
    }
    if (!report.passed) process.exitCode = 1;
    return;
  }
  if (command === 'analytics') {
    if (options.guiAnswers) {
      await runAnalyticsSetupFromAnswers(options, options.guiAnswers);
      return;
    }
    await runAnalyticsSetup(options);
    return;
  }
  if (command === 'metadata') {
    if (options.guiAnswers) {
      await runMetadataSetupFromAnswers(options, options.guiAnswers);
      return;
    }
    await runMetadataSetup(options);
    return;
  }
  if (command === 'status') {
    const status = await getProjectStatus();
    printCompletion('Angular project status', [
      `Angular: ${status.angularVersion ?? 'not detected'}`,
      `Angular CLI: ${status.cliVersion ?? 'not detected'}`,
      `Rendering: ${status.rendering}`,
      `SSR: ${status.ssr ? 'enabled' : 'disabled'}`,
      `Prerender: ${status.prerender ? 'enabled' : 'disabled'}`,
      ...(status.ssrSignals.length > 0 ? [`SSR detected by: ${status.ssrSignals.join(', ')}`] : []),
      ...(status.prerenderSignals.length > 0 ? [`Prerender detected by: ${status.prerenderSignals.join(', ')}`] : []),
      `Projects: ${status.projects.length > 0 ? status.projects.join(', ') : 'not detected'}`,
      `Targets: ${status.targets.length > 0 ? status.targets.join(', ') : 'not detected'}`,
    ]);
    return;
  }

  let configPath: string;
  let config: unknown;
  let configCreated = false;

  if (command === 'init') {
    configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILE);
    if (await fileExists(configPath)) {
      throw new Error(`Config already exists at "${configPath}". Remove it before running init again.`);
    }
    assertInteractiveTerminal();
    config = options.guiAnswers
      ? await runSetupFromAnswers(configPath, options.output, options.guiAnswers)
      : await runSetupMenu(configPath, options.output);
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
      configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILE);
      console.log("No SEO config found. Let's create one.\n");
      config = options.guiAnswers
        ? await runSetupFromAnswers(configPath, options.output, options.guiAnswers)
        : await runSetupMenu(configPath, options.output);
      configCreated = true;
    }
  }

  validateConfig(config, configPath);
  const routes = config.sitemap.routes;
  if (routes.length === 0) {
    if (configCreated) {
      console.log('\nConfig was created without routes; add sitemap.routes before generating the sitemap.');
      return;
    }
    throw new Error('No routes were configured. Add explicit URLs to sitemap.routes.');
  }

  const output = options.output ?? config.sitemap.output ?? 'public/sitemap.xml';
  const result = await writeSitemap({
    siteUrl: config.siteUrl,
    routes,
    ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
    ...(config.sitemap.stylesheet !== undefined ? { stylesheet: config.sitemap.stylesheet } : {}),
    output,
  });
  const generatedFiles = [`Sitemap: ${result.output} (${result.urlCount} URLs)`];
  if (result.stylesheetOutput) generatedFiles.push(`Stylesheet: ${result.stylesheetOutput}`);

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
    generatedFiles.push(`Robots.txt: ${robotsResult.output}`);
  }
  printCompletion('SEO files generated', generatedFiles);
}

function isSetupCancellation(error: unknown): boolean {
  return error instanceof SetupCancelledError ||
    (error instanceof Error && error.name === 'ExitPromptError');
}

main().catch((error: unknown) => {
  if (isSetupCancellation(error)) {
    console.log('\nSetup cancelled.');
    return;
  }
  console.error(`[error] ${formatError(error)}`);
  process.exitCode = 1;
});
