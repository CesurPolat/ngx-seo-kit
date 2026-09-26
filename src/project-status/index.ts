import { access, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type AngularRenderingMode = 'ssr' | 'prerender' | 'ssr+prerender' | 'csr' | 'unknown';

export interface AngularProjectStatus {
  directory: string;
  angularVersion?: string;
  cliVersion?: string;
  rendering: AngularRenderingMode;
  ssr: boolean;
  prerender: boolean;
  ssrSignals: string[];
  prerenderSignals: string[];
  projects: string[];
  targets: string[];
  files: {
    packageJson: string;
    angularJson?: string;
  };
}

/** Reads Angular version and rendering capabilities from the current project. */
export async function getProjectStatus(projectDirectory = process.cwd()): Promise<AngularProjectStatus> {
  const directory = resolve(projectDirectory);
  const packagePath = join(directory, 'package.json');
  const packageJson = await readJson(packagePath, 'package.json');
  const angularPath = join(directory, 'angular.json');
  const angularJson = await readJsonIfPresent(angularPath);
  const dependencies = {
    ...(isRecord(packageJson.dependencies) ? packageJson.dependencies : {}),
    ...(isRecord(packageJson.devDependencies) ? packageJson.devDependencies : {}),
  };
  const scripts = isRecord(packageJson.scripts) ? Object.entries(packageJson.scripts) : [];
  const targets = collectTargets(angularJson);
  const targetNames = targets.map((target) => target.toLowerCase());
  const builders = collectBuilders(angularJson);
  const configSignals = collectRenderingSignals(angularJson);
  const ssrSignals = [
    ...(typeof dependencies['@angular/ssr'] === 'string' ? ['@angular/ssr dependency'] : []),
    ...(targetNames.some((target) => target.includes('server') || target.includes('ssr')) ? ['server/ssr target'] : []),
    ...(builders.some((builder) => builder.includes('server') || builder.includes('ssr')) ? ['server/ssr builder'] : []),
    ...(scripts.some(([name, command]) => `${name} ${command}`.toLowerCase().includes('ssr')) ? ['ssr script'] : []),
    ...configSignals.ssr,
  ];
  const prerenderSignals = [
    ...(targetNames.some((target) => target.includes('prerender')) ? ['prerender target'] : []),
    ...(builders.some((builder) => builder.includes('prerender')) ? ['prerender builder'] : []),
    ...(scripts.some(([name, command]) => `${name} ${command}`.toLowerCase().includes('prerender')) ? ['prerender script'] : []),
    ...configSignals.prerender,
  ];
  const ssr = ssrSignals.length > 0;
  const prerender = prerenderSignals.length > 0;

  return {
    directory,
    ...(typeof dependencies['@angular/core'] === 'string'
      ? { angularVersion: dependencies['@angular/core'] }
      : {}),
    ...(typeof dependencies['@angular/cli'] === 'string'
      ? { cliVersion: dependencies['@angular/cli'] }
      : {}),
    rendering: ssr && prerender ? 'ssr+prerender' : ssr ? 'ssr' : prerender ? 'prerender' : angularJson ? 'csr' : 'unknown',
    ssr,
    prerender,
    ssrSignals: [...new Set(ssrSignals)],
    prerenderSignals: [...new Set(prerenderSignals)],
    projects: collectProjects(angularJson),
    targets,
    files: {
      packageJson: packagePath,
      ...(angularJson ? { angularJson: angularPath } : {}),
    },
  };
}

async function readJson(path: string, label: string): Promise<Record<string, unknown>> {
  try {
    return parseJson(await readFile(path, 'utf8'), label);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(`Angular project file not found: ${path}`);
    }
    throw error;
  }
}

async function readJsonIfPresent(path: string): Promise<Record<string, unknown> | undefined> {
  try {
    await access(path);
  } catch {
    return undefined;
  }
  return parseJson(await readFile(path, 'utf8'), 'angular.json');
}

function parseJson(source: string, label: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(source);
    if (!isRecord(value)) throw new Error(`${label} must contain a JSON object.`);
    return value;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${label}: ${message}`);
  }
}

function collectProjects(config: Record<string, unknown> | undefined): string[] {
  return config && isRecord(config.projects) ? Object.keys(config.projects) : [];
}

function collectTargets(config: Record<string, unknown> | undefined): string[] {
  if (!config || !isRecord(config.projects)) return [];
  const targets = new Set<string>();
  for (const project of Object.values(config.projects)) {
    if (!isRecord(project)) continue;
    const projectTargets = isRecord(project.architect) ? project.architect : project.targets;
    if (!isRecord(projectTargets)) continue;
    for (const target of Object.keys(projectTargets)) targets.add(target);
  }
  return [...targets].sort();
}

function collectBuilders(config: Record<string, unknown> | undefined): string[] {
  const builders: string[] = [];
  walkConfig(config, [], (key, value, path) => {
    if ((key === 'builder' || key === 'executor') && typeof value === 'string') {
      builders.push(value.toLowerCase());
    }
    void path;
  });
  return builders;
}

function collectRenderingSignals(config: Record<string, unknown> | undefined): {
  ssr: string[];
  prerender: string[];
} {
  const ssr: string[] = [];
  const prerender: string[] = [];
  walkConfig(config, [], (key, value, path) => {
    const location = path.join('.');
    if (key === 'ssr' && value === true) ssr.push(`${location}.ssr=true`);
    if (key === 'prerender' && (value === true || isRecord(value))) prerender.push(`${location}.prerender`);
    if (key === 'outputMode' && value === 'server') ssr.push(`${location}.outputMode=server`);
    if (key === 'outputMode' && value === 'static') prerender.push(`${location}.outputMode=static`);
  });
  return { ssr, prerender };
}

function walkConfig(
  value: unknown,
  path: string[],
  visit: (key: string, value: unknown, path: string[]) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkConfig(item, [...path, String(index)], visit));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    visit(key, child, path);
    walkConfig(child, childPath, visit);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
