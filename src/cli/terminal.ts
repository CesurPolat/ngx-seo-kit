import process from 'node:process';

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
  const dim = color ? '\u001b[2m' : '';
  const bold = color ? '\u001b[1m' : '';
  const reset = color ? '\u001b[0m' : '';

  console.log(`\n${green}${bold}✔${reset} ${cyan}${bold}${title}${reset}`);
  for (const detail of details) {
    console.log(`  ${dim}${detail}${reset}`);
  }
}
