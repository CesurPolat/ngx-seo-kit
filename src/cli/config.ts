import { randomUUID } from 'node:crypto';
import { access, readFile, rm, writeFile } from 'node:fs/promises';
import { register as registerCommonJs } from 'tsx/cjs/api';
import { register } from 'tsx/esm/api';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { NgxSeoConfig } from '../types.js';

const DEFAULT_CONFIG_FILES = [
  'seo.config.ts',
  'seo.config.mts',
  'seo.config.mjs',
  'seo.config.js',
  'seo.config.cjs',
] as const;

export async function findConfig(directory: string): Promise<string | undefined> {
  for (const filename of DEFAULT_CONFIG_FILES) {
    const candidate = resolve(directory, filename);
    if (await fileExists(candidate)) return candidate;
  }
  return undefined;
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function requireConfig(path: string): Promise<string> {
  if (!(await fileExists(path))) throw new Error(`Config file not found at "${path}".`);
  return path;
}

export function serializeConfig(config: NgxSeoConfig, path: string, routeFile?: string): string {
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

  if (extension === '.cjs') return `${annotation}\nmodule.exports = ${value};\n`;
  if (isTypeScript) {
    const imports = useResolver
      ? "import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';"
      : "import { defineSeoConfig } from 'ngx-seo-kit';";
    return `${imports}\n\nexport default defineSeoConfig(${value});\n`;
  }
  return `${useResolver ? "import { discoverRoutes } from 'ngx-seo-kit';\n\n" : ''}${annotation}\nexport default ${value};\n`;
}

export async function loadConfig(path: string): Promise<unknown> {
  try {
    const extension = extname(path);
    const url = pathToFileURL(path).href;
    let module: { default?: unknown };

    if (extension === '.ts' || extension === '.mts' || extension === '.cts') {
      const unregister = register();
      const unregisterCommonJs = registerCommonJs();
      try {
        try {
          module = (await import(url)) as { default?: unknown };
        } catch (error) {
          if (!shouldRetryTypeScriptConfigAsModule(error) || extension !== '.ts') throw error;
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
    /Top-level await is currently not supported with the "cjs" output format/i.test(error.message)
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

export function validateConfig(value: unknown, path: string): asserts value is NgxSeoConfig {
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
  if (!Array.isArray(config.sitemap.routes)) throw new Error('sitemap.routes must be an array.');

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
      const option = stylesheet[key];
      if (option !== undefined && (typeof option !== 'string' || !option.trim())) {
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
