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
import { runMainMenu } from './cli/menu.js';
import { parseArguments, printHelp, type CliOptions } from './cli/options.js';
import {
  findPackageUpdate,
  offerLocalInstallation,
  printPackageUpdateNotice,
  readPackageVersion,
  updatePackage,
} from './cli/package-manager.js';
import { runRouteExportTest, saveRuntimeRoutesToConfig } from './cli/route-export.js';
import { runSetupMenu, SetupCancelledError } from './cli/setup.js';
import { assertInteractiveTerminal, isInteractiveTerminal } from './cli/terminal.js';
import { writeSitemap } from './sitemap-generation/index.js';
import { writeRobotsTxt } from './sitemap-generation/robots.js';

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
  if (!isInteractiveTerminal()) {
    printPackageUpdateNotice(packageUpdate);
    await runCommand('generate', options, requestedConfigPath);
    return;
  }

  while (true) {
    const action = await runMainMenu(packageUpdate);
    if (action === 'exit') {
      console.log('Goodbye!');
      return;
    }

    try {
      if (action === 'update') {
        await updatePackage(packageUpdate);
        return;
      }
      if (action === 'route-export-test') {
        await runRouteExportTest();
        continue;
      }
      if (action === 'save-runtime-routes') {
        const paths = await runRouteExportTest();
        await saveRuntimeRoutesToConfig(paths, requestedConfigPath);
        continue;
      }
      await runCommand(action, options, requestedConfigPath);
    } catch (error) {
      if (isSetupCancellation(error)) {
        console.log('\nSetup cancelled.');
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`âœ— ${message}`);
    }
  }
}

async function runCommand(
  command: Exclude<NonNullable<CliOptions['command']>, 'update' | 'version'>,
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
    configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILE);
    if (await fileExists(configPath)) {
      throw new Error(`Config already exists at "${configPath}". Remove it before running init again.`);
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
      configPath = requestedConfigPath ?? resolve(DEFAULT_CONFIG_FILE);
      console.log("No SEO config found. Let's create one.\n");
      config = await runSetupMenu(configPath, options.output);
      configCreated = true;
    }
  }

  validateConfig(config, configPath);
  const routes = config.sitemap.routes;
  if (routes.length === 0) {
    if (configCreated) {
      console.log('\nNo Angular routes were discovered. Config was created; add sitemap.routes before generating the sitemap.');
      return;
    }
    throw new Error('No routes were configured. Add discoverRoutes(), routesToPaths(), or explicit URLs to sitemap.routes.');
  }

  const output = options.output ?? config.sitemap.output ?? 'public/sitemap.xml';
  const result = await writeSitemap({
    siteUrl: config.siteUrl,
    routes,
    ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
    ...(config.sitemap.stylesheet !== undefined ? { stylesheet: config.sitemap.stylesheet } : {}),
    output,
  });
  console.log(`\nâœ“ Sitemap generated: ${result.output} (${result.urlCount} URLs)`);
  if (result.stylesheetOutput) {
    console.log(`âœ“ Sitemap stylesheet generated: ${result.stylesheetOutput}`);
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
    console.log(`âœ“ Robots.txt generated: ${robotsResult.output}`);
  }
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
  const message = error instanceof Error ? error.message : String(error);
  console.error(`âœ— ${message}`);
  process.exitCode = 1;
});
