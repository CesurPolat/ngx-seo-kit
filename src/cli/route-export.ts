import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export interface RouteExportFiles {
  service: string;
  test: string;
}

export interface WriteRouteExportFilesOptions {
  projectDirectory?: string;
  appDirectory?: string;
}

export interface WriteRouteExportFilesResult extends RouteExportFiles {
  created: readonly string[];
}

const SERVICE_FILE = 'route-export.service.ts';
const TEST_FILE = 'route-export.service.spec.ts';

export function generateRouteExportFiles(): RouteExportFiles {
  return {
    service: `import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { routesToPaths } from 'ngx-seo-kit';

@Injectable({ providedIn: 'root' })
export class RouteExportService {
  constructor(private readonly router: Router) {}

  sitemapPaths(): string[] {
    return routesToPaths(this.router.config);
  }
}
`,
    test: `import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { RouteExportService } from './route-export.service';

describe('RouteExportService', () => {
  it('exports public URLs from the Angular router config', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes)],
    });

    const service = TestBed.inject(RouteExportService);
    const paths = service.sitemapPaths();

    console.log('[ngx-seo-kit:routes]', JSON.stringify(paths));
  });
});
`,
  };
}

export async function writeRouteExportFiles(
  options: WriteRouteExportFilesOptions = {},
): Promise<WriteRouteExportFilesResult> {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const appDirectory = options.appDirectory ?? join(projectDirectory, 'src', 'app');
  const service = join(appDirectory, SERVICE_FILE);
  const test = join(appDirectory, TEST_FILE);

  if (await fileExists(service) || await fileExists(test)) {
    throw new Error(
      `Route export files already exist in "${appDirectory}". Remove them before generating new files.`,
    );
  }

  const contents = generateRouteExportFiles();
  await mkdir(dirname(service), { recursive: true });
  await writeFile(service, contents.service, { encoding: 'utf8', flag: 'wx' });
  try {
    await writeFile(test, contents.test, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    throw new Error(`Could not create route export test at "${test}": ${formatError(error)}`);
  }

  return { service, test, created: [service, test] };
}

export async function ensureRouteExportFiles(
  options: WriteRouteExportFilesOptions = {},
): Promise<WriteRouteExportFilesResult | undefined> {
  const projectDirectory = options.projectDirectory ?? process.cwd();
  const appDirectory = options.appDirectory ?? join(projectDirectory, 'src', 'app');
  const service = join(appDirectory, SERVICE_FILE);
  const test = join(appDirectory, TEST_FILE);
  const serviceExists = await fileExists(service);
  const testExists = await fileExists(test);

  if (serviceExists && testExists) return undefined;
  if (!serviceExists && !testExists) return writeRouteExportFiles(options);

  const contents = generateRouteExportFiles();
  await mkdir(dirname(service), { recursive: true });
  const created: string[] = [];
  if (!serviceExists) {
    await writeFile(service, contents.service, { encoding: 'utf8', flag: 'wx' });
    created.push(service);
  }
  if (!testExists) {
    await writeFile(test, contents.test, { encoding: 'utf8', flag: 'wx' });
    created.push(test);
  }
  return { service, test, created };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
