import { spawn } from 'node:child_process';
import process from 'node:process';

/** Runs Angular's route-export test and returns the runtime route paths. */
export async function discoverRoutes(): Promise<string[]> {
  const ngArgs = ['test', '--include=**/route-export.service.spec.ts', '--watch=false'];
  const executable = process.platform === 'win32' ? process.env.ComSpec ?? 'cmd.exe' : 'ng';
  const args = process.platform === 'win32'
    ? ['/d', '/s', '/c', `ng ${ngArgs.join(' ')}`]
    : ngArgs;
  let stdout = '';
  let stderr = '';
  const stopLoading = startLoading('Discovering Angular routes');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(executable, args, {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.once('error', (error) => {
        const notFound = (error as NodeJS.ErrnoException).code === 'ENOENT';
        reject(notFound
          ? new Error('Angular CLI was not found. Run this function from an Angular project with @angular/cli installed.')
          : error);
      });
      child.once('exit', (code, signal) => {
        if (code === 0) return resolve();
        reject(new Error(
          signal
            ? `Route export test was terminated by signal ${signal}.`
            : `Route export test failed with exit code ${code ?? 'unknown'}${stderr.trim() ? `: ${stderr.trim()}` : '.'}`,
        ));
      });
    });

    const match = /\[ngx-seo-kit:routes\]\s+(\[[^\r\n]*\])/.exec(stdout);
    if (!match?.[1]) throw new Error('Route export test did not return a route list.');
    const paths: unknown = JSON.parse(match[1]);
    if (!Array.isArray(paths) || !paths.every((path) => typeof path === 'string')) {
      throw new Error('Route export test returned an invalid route list.');
    }
    return paths;
  } finally {
    stopLoading();
  }
}

function startLoading(message: string): () => void {
  const interactive = Boolean(process.stdout.isTTY && !process.env.CI);
  if (!interactive) {
    console.log(`${message}...`);
    return () => undefined;
  }

  const frames = ['|', '/', '-', '\\'];
  let index = 0;
  const render = () => {
    process.stdout.write(`\r${frames[index++ % frames.length]} ${message}...`);
  };
  render();
  const timer = setInterval(render, 120);
  return () => {
    clearInterval(timer);
    process.stdout.write(`\r${' '.repeat(message.length + 6)}\r`);
  };
}
