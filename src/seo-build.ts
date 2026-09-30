import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { basename, dirname, resolve } from 'node:path';
import { findConfig, loadConfig, validateConfig } from './cli/config.js';
import { writeRobotsTxt } from './sitemap-generation/robots.js';
import { writeSitemap } from './sitemap-generation/index.js';
import type { NgxSeoConfig } from './types.js';

export interface SeoBuildOptions {
  cwd?: string;
  config?: string;
  output?: string;
  angular?: boolean;
  strict?: boolean;
}

export interface SeoBuildReport {
  passed: boolean;
  errors: string[];
  warnings: string[];
  generatedFiles: string[];
  routeCount: number;
}

export async function runSeoBuild(options: SeoBuildOptions = {}): Promise<SeoBuildReport> {
  const cwd = resolve(options.cwd ?? process.cwd());
  const report: SeoBuildReport = {
    passed: false,
    errors: [],
    warnings: [],
    generatedFiles: [],
    routeCount: 0,
  };
  const configPath = options.config
    ? resolve(cwd, options.config)
    : await findConfig(cwd);

  if (!configPath) {
    report.errors.push('SEO config not found. Create seo.config.ts or pass --config.');
    return report;
  }

  let config: NgxSeoConfig;
  try {
    config = (await loadConfig(configPath)) as NgxSeoConfig;
    validateConfig(config, configPath);
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    return report;
  }

  const routes = config.sitemap.routes;
  report.routeCount = routes.length;
  if (routes.length === 0) {
    report.errors.push('sitemap.routes must contain at least one route.');
    return report;
  }

  try {
    const duplicates = findDuplicateRoutes(routes);
    if (duplicates.length > 0) report.errors.push(`Duplicate sitemap routes: ${duplicates.join(', ')}.`);
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
  }
  if (!config.metadata) {
    report.warnings.push('Global metadata is not configured in seo.config.ts.');
  }

  if (report.errors.length === 0) {
    const output = resolve(cwd, options.output ?? config.sitemap.output ?? 'public/sitemap.xml');
    try {
      const sitemap = await writeSitemap({
        siteUrl: config.siteUrl,
        routes,
        ...(config.sitemap.exclude ? { exclude: config.sitemap.exclude } : {}),
        ...(config.sitemap.stylesheet !== undefined ? { stylesheet: config.sitemap.stylesheet } : {}),
        output,
      });
      report.generatedFiles.push(sitemap.output);
      if (sitemap.stylesheetOutput) report.generatedFiles.push(sitemap.stylesheetOutput);

      if (config.robots !== false) {
        const robots = config.robots ?? {};
        const robotsResult = await writeRobotsTxt({
          siteUrl: config.siteUrl,
          output: resolve(cwd, robots.output ?? `${dirname(output)}/robots.txt`),
          ...(robots.groups ? { groups: robots.groups } : {}),
          ...(robots.sitemap !== undefined ? { sitemap: robots.sitemap } : { sitemap: `/${basename(output)}` }),
        });
        report.generatedFiles.push(robotsResult.output);
      }

      await validateGeneratedFiles(config, output, report);
      await validateIndexMarkers(cwd, report);
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (options.strict && report.warnings.length > 0) {
    report.errors.push(...report.warnings.map((warning) => `Strict mode: ${warning}`));
  }

  if (report.errors.length === 0 && options.angular) {
    const exitCode = await runAngularBuild(cwd);
    if (exitCode !== 0) report.errors.push(`Angular build failed with exit code ${exitCode}.`);
  }

  report.passed = report.errors.length === 0;
  return report;
}

function findDuplicateRoutes(routes: NgxSeoConfig['sitemap']['routes']): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const input of routes) {
    const path = normalizeRoutePath(typeof input === 'string' ? input : input.path);
    if (seen.has(path)) duplicates.add(path);
    seen.add(path);
  }
  return [...duplicates];
}

function normalizeRoutePath(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    return normalizeRoutePath(`${url.pathname}${url.search}`);
  }
  const [withoutHash] = trimmed.split('#', 1);
  const path = withoutHash?.startsWith('/') ? withoutHash : `/${withoutHash ?? ''}`;
  const normalized = path.replace(/\/{2,}/g, '/');
  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

async function validateGeneratedFiles(
  config: NgxSeoConfig,
  sitemapPath: string,
  report: SeoBuildReport,
): Promise<void> {
  const xml = await readFile(sitemapPath, 'utf8');
  if (!xml.startsWith('<?xml') || !xml.includes('<urlset')) {
    throw new Error(`Generated sitemap is not valid XML: "${sitemapPath}".`);
  }
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => match[1])
    .filter((location): location is string => Boolean(location));
  if (locations.length === 0) throw new Error('Generated sitemap does not contain any <loc> entries.');
  if (new Set(locations).size !== locations.length) throw new Error('Generated sitemap contains duplicate <loc> entries.');
  const site = new URL(config.siteUrl);
  for (const location of locations) {
    const url = new URL(location);
    if (url.origin !== site.origin) throw new Error(`Sitemap URL is outside siteUrl: "${location}".`);
  }

  const robotsPath = report.generatedFiles.find((file) => file.endsWith('robots.txt'));
  if (robotsPath) {
    const robots = await readFile(robotsPath, 'utf8');
    if (!/^Sitemap:\s+\S+/m.test(robots)) throw new Error('Generated robots.txt does not contain a Sitemap reference.');
  }
}

async function validateIndexMarkers(cwd: string, report: SeoBuildReport): Promise<void> {
  const candidates = [resolve(cwd, 'src/index.html'), resolve(cwd, 'index.html')];
  for (const candidate of candidates) {
    try { await access(candidate); } catch { continue; }
    const html = await readFile(candidate, 'utf8');
    const start = (html.match(/ngx-seo-kit:social-metadata:start/g) ?? []).length;
    const end = (html.match(/ngx-seo-kit:social-metadata:end/g) ?? []).length;
    if (start !== end) report.errors.push(`Metadata marker block is incomplete in "${candidate}".`);
    return;
  }
}

function runAngularBuild(cwd: string): Promise<number> {
  const command = process.platform === 'win32' ? 'ng.cmd' : 'ng';
  return new Promise((resolvePromise) => {
    const child = spawn(command, ['build'], { cwd, stdio: 'inherit', shell: false });
    child.on('error', (error: NodeJS.ErrnoException) => {
      resolvePromise(error.code === 'ENOENT' ? 127 : 1);
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
  });
}
