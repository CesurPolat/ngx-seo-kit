import process from 'node:process';
import readline from 'node:readline';

let keypressEventsInitialized = false;

export function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI);
}

export function assertInteractiveTerminal(): void {
  if (!isInteractiveTerminal()) {
    throw new Error(
      'Config file not found. Run "ngx-seo-kit init" in an interactive terminal first.',
    );
  }
}

export function printCompletion(title: string, details: readonly string[] = []): void {
  const color = process.stdout.isTTY && !('NO_COLOR' in process.env);
  const green = color ? '\u001b[38;2;34;197;94m' : '';
  const cyan = color ? '\u001b[38;2;34;211;238m' : '';
  const bold = color ? '\u001b[1m' : '';
  const reset = color ? '\u001b[0m' : '';

  console.log(`\n${green}${bold}✔${reset} ${cyan}${bold}${title}${reset}`);
  for (const detail of details) {
    console.log(`  ${detail}`);
  }
}

export async function waitForKeypress(): Promise<void> {
  if (!isInteractiveTerminal()) return;

  console.log('\nPress any key to return to menu...');
  await new Promise<void>((resolve) => {
    const stdin = process.stdin;
    if (!keypressEventsInitialized) {
      readline.emitKeypressEvents(stdin);
      keypressEventsInitialized = true;
    }
    const cleanup = () => {
      stdin.removeListener('keypress', onKeypress);
      if (stdin.setRawMode) stdin.setRawMode(true);
      stdin.resume();
      resolve();
    };
    const onKeypress = () => cleanup();
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    stdin.once('keypress', onKeypress);
  });
}

export function clearTerminal(): void {
  if (process.stdout.isTTY) process.stdout.write('\u001b[2J\u001b[H');
}
