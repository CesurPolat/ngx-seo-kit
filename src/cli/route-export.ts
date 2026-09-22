import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import type { NgxSeoConfig } from '../types.js';
import {
  fileExists,
  findConfig,
  loadConfig,
  requireConfig,
  serializeConfig,
  validateConfig,
} from './config.js';

export async function runRouteExportTest(): Promise<string[]> {
  await ensureRouteExportTestFiles();
  const ngArgs = ['test', '--include=**/route-export.service.spec.ts', '--watch=false'];
  const executable = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'ng';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `ng ${ngArgs.join(' ')}`]
    : ngArgs;
  console.log('\nLoading routes...');

  let stdout = '';
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr?.on('data', () => undefined);
    child.once('error', (error) => {
      const notFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
      reject(notFound
        ? new Error('Angular CLI was not found. Run this option from an Angular project with @angular/cli installed.')
        : error);
    });
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      reject(new Error(
        signal
          ? `Route export test was terminated by signal ${signal}.`
          : `Route export test failed with exit code ${code ?? 'unknown'}.`,
      ));
    });
  });

  const match = /\[ngx-seo-kit:routes\]\s+(\[[^\r\n]*\])/.exec(stdout);
  if (!match?.[1]) {
    throw new Error('Route export test passed but did not return a route list. Run the menu option once more to update the generated test.');
  }
  const paths: unknown = JSON.parse(match[1]);
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === 'string')) {
    throw new Error('Route export test returned an invalid route list.');
  }
  return paths;
}

export async function saveRuntimeRoutesToConfig(
  paths: string[],
  requestedConfigPath?: string,
): Promise<void> {
  const configPath = requestedConfigPath
    ? await requireConfig(requestedConfigPath)
    : await findConfig(process.cwd());
  if (!configPath) throw new Error('No SEO config was found. Run "ngx-seo-kit init" first.');

  const loaded = await loadConfig(configPath);
  validateConfig(loaded, configPath);
  const merged = {
    ...loaded,
    sitemap: {
      ...loaded.sitemap,
      routes: [...new Set([...loaded.sitemap.routes, ...paths])],
    },
  } satisfies NgxSeoConfig;
  await writeFile(configPath, serializeConfig(merged, configPath), 'utf8');
  console.log(`\nâœ“ Saved ${paths.length} runtime routes to ${configPath}`);
}

async function ensureRouteExportTestFiles(): Promise<void> {
  const appDirectory = resolve('src', 'app');
  const routeFile = join(appDirectory, 'app.routes.ts');
  const serviceFile = join(appDirectory, 'route-export.service.ts');
  const specFile = join(appDirectory, 'route-export.service.spec.ts');

  if (await fileExists(specFile)) {
    await migrateRouteExportService(serviceFile);
    await migrateRouteExportSpec(specFile);
    return;
  }
  if (!(await fileExists(routeFile))) {
    throw new Error('Route export test could not be created because src/app/app.routes.ts was not found. Create that file or add route-export.service.spec.ts manually.');
  }

  const routeSource = await readFile(routeFile, 'utf8');
  const setup = exportedRouteImport(routeSource) ?? await exportedAppConfigImport(appDirectory);
  if (!setup) {
    throw new Error('Could not find an exported route array in src/app/app.routes.ts or an exported application config in src/app/app.config.ts. Export one of them and run this option again.');
  }

  await mkdir(appDirectory, { recursive: true });
  if (!(await fileExists(serviceFile))) {
    await writeFile(serviceFile, routeExportServiceSource(), { encoding: 'utf8', flag: 'wx' });
    console.log(`Created: ${serviceFile}`);
  }
  await writeFile(specFile, routeExportSpecSource(setup), { encoding: 'utf8', flag: 'wx' });
  console.log(`Created: ${specFile}`);
}

interface RouteTestSetup {
  importStatement: string;
  providersExpression: string;
}

function exportedRouteImport(source: string): RouteTestSetup | undefined {
  const namedRoutes = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*routes[\w$]*)\b/i.exec(source);
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

async function exportedAppConfigImport(appDirectory: string): Promise<RouteTestSetup | undefined> {
  const configFile = join(appDirectory, 'app.config.ts');
  if (!(await fileExists(configFile))) return undefined;
  const source = await readFile(configFile, 'utf8');
  const namedConfig = /export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*config[\w$]*)\b/i.exec(source);
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

async function migrateRouteExportService(serviceFile: string): Promise<void> {
  if (!(await fileExists(serviceFile))) return;
  const source = await readFile(serviceFile, 'utf8');
  if (!source.includes("import { routesToPathsAsync } from 'ngx-seo-kit';")) return;
  await writeFile(serviceFile, routeExportServiceSource(), { encoding: 'utf8' });
  console.log(`Updated: ${serviceFile}`);
}

async function migrateRouteExportSpec(specFile: string): Promise<void> {
  const source = await readFile(specFile, 'utf8');
  const legacy = "console.info('[ngx-seo-kit] Runtime router paths:', paths);";
  if (!source.includes(legacy)) return;
  await writeFile(
    specFile,
    source.replace(legacy, "console.info('[ngx-seo-kit:routes]', JSON.stringify(paths));"),
    'utf8',
  );
  console.log(`Updated: ${specFile}`);
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

    console.info('[ngx-seo-kit:routes]', JSON.stringify(paths));
    expect(paths.length).toBeGreaterThan(0);
  });
});
`;
}
