import confirm from '@inquirer/confirm';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import process from 'node:process';
import { fileExists } from './config.js';
import { isInteractiveTerminal } from './terminal.js';

export interface PackageUpdate {
  currentVersion: string;
  latestVersion: string;
}

export async function offerLocalInstallation(): Promise<void> {
  if (
    !isInteractiveTerminal() ||
    !(await fileExists(resolve('package.json'))) ||
    isPackageAvailableFromProject()
  ) return;

  const shouldInstall = await confirm({
    message: 'ngx-seo-kit is not installed in this project. Install it as a dev dependency?',
    default: true,
  });
  if (!shouldInstall) return;

  const version = await readPackageVersion();
  console.log(`\nInstalling ngx-seo-kit@${version} as a dev dependency...\n`);
  await installDevDependency(`ngx-seo-kit@${version}`);
  console.log('\nâœ“ ngx-seo-kit was added to devDependencies.');
}

export async function findPackageUpdate(): Promise<PackageUpdate | undefined> {
  if (!shouldCheckForUpdates()) return undefined;
  try {
    const currentVersion = await readPackageVersion();
    const response = await fetch('https://registry.npmjs.org/ngx-seo-kit/latest', {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(1_500),
    });
    if (!response.ok) return undefined;
    const latest = (await response.json()) as { version?: unknown };
    if (typeof latest.version === 'string' && isNewerVersion(latest.version, currentVersion)) {
      return { currentVersion, latestVersion: latest.version };
    }
  } catch {
    // A version check must never block sitemap generation.
  }
  return undefined;
}

export function printPackageUpdateNotice(packageUpdate: PackageUpdate | undefined): void {
  if (!packageUpdate) return;
  console.warn(
    `\nUpdate available: ngx-seo-kit ${packageUpdate.currentVersion} â†’ ${packageUpdate.latestVersion}\n` +
      'Run: npm install -D ngx-seo-kit@latest\n',
  );
}

export async function updatePackage(
  packageUpdate: PackageUpdate | undefined,
  force = false,
): Promise<void> {
  if (!packageUpdate && !force) return;
  const currentVersion = packageUpdate?.currentVersion ?? (await readPackageVersion());
  const targetVersion = packageUpdate?.latestVersion ?? 'latest';
  console.log(`\nUpdating ngx-seo-kit ${currentVersion} â†’ ${targetVersion}...\n`);
  await installDevDependency('ngx-seo-kit@latest');
  console.log(`\nâœ“ Updated ngx-seo-kit to ${targetVersion}. Starting it now...\n`);
  await runLatestPackage();
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
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(version);
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

export async function readPackageVersion(): Promise<string> {
  const packageJsonPath = new URL('../../../package.json', import.meta.url);
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as { version?: unknown };
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
  await runChildProcess(executable, args, 'npm install');
}

async function runLatestPackage(): Promise<void> {
  const executable = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'npx';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'npx --yes ngx-seo-kit@latest']
    : ['--yes', 'ngx-seo-kit@latest'];
  await runChildProcess(executable, args, 'npx');
}

async function runChildProcess(executable: string, args: string[], label: string): Promise<void> {
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(executable, args, { cwd: process.cwd(), stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) return resolvePromise();
      reject(new Error(
        signal
          ? `${label} was terminated by signal ${signal}.`
          : `${label} failed with exit code ${code ?? 'unknown'}.`,
      ));
    });
  });
}
