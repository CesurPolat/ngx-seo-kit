import select from '@inquirer/select';
import process from 'node:process';
import type { PackageUpdate } from './package-manager.js';

export type MenuAction =
  | 'generate'
  | 'analytics'
  | 'metadata'
  | 'status'
  | 'update'
  | 'exit';

export async function runMainMenu(packageUpdate: PackageUpdate | undefined): Promise<MenuAction> {
  printBrand(packageUpdate);
  return select<MenuAction>({
    message: 'What would you like to do?',
    choices: [
      {
        name: 'Generate SEO files (sitemap.xml, robots.txt, etc.)',
        value: 'generate',
        description: 'Create search-engine files from your config. Direct command: npx ngx-seo-kit generate',
      },
      {
        name: 'Set up Google Analytics',
        value: 'analytics',
        description: 'Install a Google tag in the Angular app. Direct command: npx ngx-seo-kit analytics',
      },
      {
        name: 'Set up Open Graph & Schema',
        value: 'metadata',
        description: 'Install global social and structured metadata. Direct command: npx ngx-seo-kit metadata',
      },
      {
        name: 'Check Angular project status',
        value: 'status',
        description: 'Show Angular version and SSR/prerender configuration.',
      },
      ...(packageUpdate ? [{
        name: `Update ngx-seo-kit (${packageUpdate.currentVersion} â†’ ${packageUpdate.latestVersion})`,
        value: 'update' as const,
        description: 'Install the latest published ngx-seo-kit version.',
      }] : []),
      { name: 'Exit', value: 'exit', description: 'Close ngx-seo-kit without making any changes.' },
    ],
  });
}

function printBrand(packageUpdate?: PackageUpdate): void {
  const useColor = process.stdout.isTTY && !('NO_COLOR' in process.env);
  const colors = useColor
    ? [
        '\u001b[38;2;168;85;247m',
        '\u001b[38;2;217;70;239m',
        '\u001b[38;2;236;72;153m',
        '\u001b[38;2;34;211;238m',
        '\u001b[38;2;6;182;212m',
      ]
    : ['', '', '', '', ''];
  const accent = useColor ? '\u001b[38;2;250;204;21m' : '';
  const bold = useColor ? '\u001b[1m' : '';
  const reset = useColor ? '\u001b[0m' : '';
  const bannerLines = [
    ' _ __   __ _ __  __     ___  ___  ___        _  ___ _',
    "| '_ \\ / _` |\\ \\/ /    / __|/ _ \\/ _ \\      | |/ (_) |_",
    '| | | | (_| | >  <     \\__ \\  __/ (_) |     |   <| |  _|',
    '|_| |_|\\__, |/_/\\_\\    |___/\\___|\\___/      |_|\\_\\_|\\__|',
    '       |___/',
  ];
  const banner = bannerLines.map((line, index) => `${colors[index]}${line}`).join('\n');
  console.log(`\n${bold}${banner}${reset}\n${accent}${bold}             Angular SEO tooling${reset}\n`);
  if (packageUpdate) {
    console.warn(
      `  Update available: ngx-seo-kit ${packageUpdate.currentVersion} â†’ ${packageUpdate.latestVersion}\n` +
        '  Run: npm install -D ngx-seo-kit@latest\n',
    );
  }
}
