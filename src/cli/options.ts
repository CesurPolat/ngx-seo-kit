export interface CliOptions {
  command?: 'generate' | 'init' | 'analytics' | 'metadata' | 'status' | 'update' | 'version';
  config?: string;
  output?: string;
  tagId?: string;
  index?: string;
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  siteName?: string;
  locale?: string;
  help: boolean;
}

export function parseArguments(args: string[]): CliOptions {
  const options: CliOptions = { help: false };
  let commandSeen = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (
      argument === 'generate' ||
      argument === 'init' ||
      argument === 'analytics' ||
      argument === 'metadata' ||
      argument === 'status' ||
      argument === 'update' ||
      argument === 'version'
    ) {
      if (commandSeen) throw new Error('Only one command can be specified.');
      options.command = argument;
      commandSeen = true;
      continue;
    }

    if (argument === '--version' || argument === '-v') {
      if (commandSeen) throw new Error('Only one command can be specified.');
      options.command = 'version';
      commandSeen = true;
      continue;
    }

    if (argument === '--update' || argument === '-U') {
      if (commandSeen) throw new Error('Only one command can be specified.');
      options.command = 'update';
      commandSeen = true;
      continue;
    }

    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }

    const optionNames: Partial<Record<string, keyof CliOptions>> = {
      '--config': 'config',
      '-c': 'config',
      '--output': 'output',
      '-o': 'output',
      '--tag-id': 'tagId',
      '--index': 'index',
      '--title': 'title',
      '--description': 'description',
      '--url': 'url',
      '--image': 'image',
      '--site-name': 'siteName',
      '--locale': 'locale',
    };
    const optionName = argument ? optionNames[argument] : undefined;
    if (argument && optionName) {
      const value = readOptionValue(args, ++index, argument);
      Object.assign(options, { [optionName]: value });
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index];
  if (!value || value.startsWith('-')) throw new Error(`${option} requires a value.`);
  return value;
}

export function printHelp(): void {
  console.log(`ngx-seo-kit Angular SEO toolkit

Usage:
  npx ngx-seo-kit [options]
  npx ngx-seo-kit generate [options]
  npx ngx-seo-kit init [options]
  npx ngx-seo-kit analytics [options]
  npx ngx-seo-kit metadata [options]
  npx ngx-seo-kit status
  npx ngx-seo-kit update
  npx ngx-seo-kit version

Commands:
  (none)               Open the interactive main menu.
  generate             Generate SEO files (sitemap.xml, robots.txt, etc.).
  init                 Create a config through the guided setup.
  analytics            Install Google Analytics in an Angular index file.
  metadata             Install Open Graph and Schema.org metadata.
  status               Show Angular version and SSR/prerender project status.
  update               Install and start the latest ngx-seo-kit version.
  version              Print the installed ngx-seo-kit version.

Options:
  -c, --config <path>  Config file (default: seo.config.ts)
  -o, --output <path>  Override the sitemap output path
  --tag-id <id>        Google Analytics measurement ID (for example G-XXXXXXXXXX)
  --index <path>       Angular index file for analytics or metadata
  --title <text>       Open Graph title used by metadata
  --description <text> Open Graph description used by metadata
  --url <url>          Canonical absolute URL used by metadata
  --image <url>        Absolute social image URL used by metadata
  --site-name <text>   Optional Open Graph site name
  --locale <locale>    Open Graph locale (default: en_US)
  -h, --help           Show this help
  -U, --update         Install and start the latest ngx-seo-kit version
  -v, --version        Print the installed ngx-seo-kit version

Examples:
  npx ngx-seo-kit
  npx ngx-seo-kit init
  npx ngx-seo-kit version
  npx ngx-seo-kit generate
  npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX
  npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX --index projects/app/src/index.html
  npx ngx-seo-kit metadata --title "Example" --description "Example site" --url https://example.com --image https://example.com/og-image.png
  npx ngx-seo-kit status
  npx ngx-seo-kit generate --config config/seo.production.ts
  npx ngx-seo-kit generate --output public/sitemap.xml
`);
}
