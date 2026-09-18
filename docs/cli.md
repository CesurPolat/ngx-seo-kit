# CLI guide

The `ngx-seo-kit` CLI generates `sitemap.xml` and `robots.txt` files from routes
declared in a configuration file. Run commands from your project root. Relative
configuration and output paths are resolved from the directory where the command
is run.

## Requirements and installation

- Node.js 20 or later
- `ngx-seo-kit` installed as a development dependency

Install the package:

```bash
npm install --save-dev ngx-seo-kit
```

Use `npx` to invoke the CLI directly, or call the package binary without `npx`
from an npm script:

```bash
npx ngx-seo-kit --help
```

When run interactively through `npx`, the CLI checks whether `ngx-seo-kit` is
available from the current project. If it is not, and the directory contains a
`package.json`, the CLI asks before running
`npm install --save-dev ngx-seo-kit@<current-version>`. Declining skips the
installation and continues without modifying the project. This prompt is never
shown in CI or other non-interactive environments.

```json
{
  "scripts": {
    "sitemap": "ngx-seo-kit"
  }
}
```

## Quick start

Open the interactive main menu:

```bash
npx ngx-seo-kit
```

Use the arrow keys to choose one of these actions:

- **Generate SEO files (sitemap.xml, robots.txt, etc.)** reads the current
  configuration and writes the configured search-engine files.
- **Set up Google Analytics** installs a Google tag in the Angular index file.
- **Set up Open Graph & Schema** installs global social metadata and Schema.org
  structured data in the Angular index file.
- **Exit** closes the CLI without making changes.

If no configuration exists when **Generate SEO files** is selected, the guided
setup opens automatically and creates it before generation.

After an interactive action finishes, the main menu opens again. The session
stays open until **Exit** is selected. Explicit commands such as
`ngx-seo-kit generate` still run once and exit, which keeps scripts and CI jobs
predictable. Interrupting a setup or analytics prompt cancels only that action
and returns to the main menu.

The guided setup asks for the site URL, sitemap output path, and optional
excluded routes. It automatically discovers Angular routes under `src`, then
shows a summary before creating `seo.config.ts` and generating the sitemap.
When no routes are discovered, setup creates the config with
`sitemap.routes: []` and skips sitemap generation. Add public paths to that
array, then run `ngx-seo-kit generate`.

Open the guided setup directly when you do not need the main menu:

```bash
npx ngx-seo-kit init
```

Example answers:

```text
Site URL (https://example.com): https://example.com
Sitemap output path (public/sitemap.xml):
Excluded routes (comma separated, optional): /404, /admin
```

The `init` command does not overwrite an existing configuration file. Keep the
file and use `generate` to create a sitemap from the existing configuration.

## Commands

### `generate`

Read the configuration and generate a sitemap and robots file:

```bash
npx ngx-seo-kit generate
```

When no configuration path is provided, the CLI searches the current working
directory in this order:

1. `seo.config.ts`
2. `seo.config.mts`
3. `seo.config.mjs`
4. `seo.config.js`
5. `seo.config.cjs`

If no configuration is found in an interactive terminal, `generate` opens the
guided setup automatically. In CI and other non-interactive environments it
exits without writing files and asks you to run `ngx-seo-kit init` first. Create
and commit the configuration file before running your CI workflow. A bare
command only falls back to generation in non-interactive environments for
backward compatibility.

After successful generation, the CLI prints the absolute output path and number
of URLs written:

```text
✓ Sitemap generated: /project/public/sitemap.xml (3 URLs)
✓ Robots.txt generated: /project/public/robots.txt
```

### `init`

Create a new configuration through the interactive menu and generate a sitemap:

```bash
npx ngx-seo-kit init
```

Create the configuration at a custom path:

```bash
npx ngx-seo-kit init --config config/seo.config.ts
```

`init` only works in an interactive terminal. If the target file already exists,
the command stops without modifying it.

### `analytics`

Install Google Analytics in `src/index.html` through an interactive prompt:

```bash
npx ngx-seo-kit analytics
```

Pass the measurement ID explicitly in non-interactive environments:

```bash
npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX
```

Use `--index` when the Angular application has a custom location:

```bash
npx ngx-seo-kit analytics \
  --tag-id G-XXXXXXXXXX \
  --index projects/storefront/src/index.html
```

The command owns the HTML block between its `ngx-seo-kit:google-tag` markers.
Re-running it does not duplicate the block, and supplying another measurement
ID updates the owned block. An existing Google tag without those markers is
never overwritten automatically.

### `metadata`

Install global Open Graph metadata and Schema.org `WebSite` JSON-LD:

```bash
npx ngx-seo-kit metadata
```

Interactive setup asks for the canonical URL, title, description, social image,
site name, and locale. In CI and other non-interactive terminals, pass the four
required values:

```bash
npx ngx-seo-kit metadata \
  --title "Example" \
  --description "Example Angular application" \
  --url https://example.com \
  --image https://example.com/og-image.png
```

The generated block is marked as owned by ngx-seo-kit, so rerunning the command
updates it without duplicates. Unmanaged Open Graph tags are not overwritten.
This is global fallback metadata; use Angular or SSR integration for
route-specific values.

## Options

| Option | Short form | Description |
| --- | --- | --- |
| `--config <path>` | `-c <path>` | Configuration file to read or create with `init` |
| `--output <path>` | `-o <path>` | Override `sitemap.output` for the current invocation |
| `--tag-id <id>` | | Google Analytics measurement ID used by `analytics` |
| `--index <path>` | | Angular index file used by `analytics` and `metadata` (default: `src/index.html`) |
| `--title <text>` | | Open Graph title used by `metadata` |
| `--description <text>` | | Open Graph description used by `metadata` |
| `--url <url>` | | Canonical absolute URL used by `metadata` |
| `--image <url>` | | Absolute social image URL used by `metadata` |
| `--site-name <text>` | | Optional Open Graph site name |
| `--locale <locale>` | | Open Graph locale such as `en_US` or `tr_TR` |
| `--help` | `-h` | Print help and exit without performing an operation |

Use a custom configuration and output path together:

```bash
npx ngx-seo-kit generate \
  --config config/seo.production.ts \
  --output dist/my-app/browser/sitemap.xml
```

The same command in PowerShell:

```powershell
npx ngx-seo-kit generate `
  --config config/seo.production.ts `
  --output dist/my-app/browser/sitemap.xml
```

The output path is selected in this order:

1. The `--output` option
2. `sitemap.output` in the configuration
3. The default `public/sitemap.xml`

The CLI creates missing output directories automatically.

## Configuration file

The recommended filename and format is `seo.config.ts`:

```ts
import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'public/sitemap.xml',
    stylesheet: true,
    routes: [
      ...await discoverRoutes('./src/app/app.routes.ts'),
      '/about',
      {
        path: '/blog',
        lastmod: '2026-09-04',
        changefreq: 'weekly',
        priority: 0.8,
      },
    ],
    exclude: ['/404', '/admin'],
  },
  robots: {
    output: 'public/robots.txt',
    groups: [{ userAgent: '*', allow: ['/'], disallow: ['/admin'] }],
  },
});
```

Required fields:

- `siteUrl`: The site URL. It must use `http` or `https` and must not contain a
  query string or hash.
- `sitemap`: Sitemap generation options.
- `sitemap.routes`: Route strings or detailed route objects. Spread the result
  of `discoverRoutes('./path/to/app.routes.ts')` here to include Angular routes.

Optional sitemap fields:

- `stylesheet`: `true` to generate a sibling `sitemap.xsl`, or an object with
  optional `href`, `output`, and `title` fields. Browsers render the XML as an
  HTML table while crawlers continue to receive standard sitemap XML.
- `exclude`: Routes omitted from the generated sitemap.
- `output`: Destination for the generated XML file.

The optional top-level `robots` field controls `robots.txt`. When omitted, the
CLI writes `robots.txt` beside the sitemap with an allow-all group and a sitemap
reference. Set it to `false` to disable generation. The options object accepts:

- `output`: Destination for `robots.txt`.
- `groups`: User-agent groups with `allow`, `disallow`, and optional
  `crawlDelay` directives.
- `sitemap`: A sitemap path, an array of paths or absolute URLs, or `false` to
  omit sitemap directives.

Optional route fields:

- `lastmod`: A `YYYY-MM-DD` date or valid W3C datetime value.
- `changefreq`: `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, or
  `never`.
- `priority`: A number from `0` to `1`.

Routes listed in `exclude` are omitted. The CLI also normalizes leading and
trailing slashes, removes URL fragments, and deduplicates routes.

`discoverRoutes(...)` starts from the supplied route file and follows
`provideRouter(...)`, `RouterModule.forRoot(...)`, nested `children`, and relative
`loadChildren` imports. Redirect,
wildcard, and parameterized routes are skipped. Add concrete dynamic URLs to
`routes` when they are known at build time.

For an Angular route variable that can be safely imported in the Node.js build
environment, use `routesToPaths(...)`:

```ts
import { defineSeoConfig, routesToPaths } from 'ngx-seo-kit';
import { routes } from './src/app/app.routes';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: routesToPaths(routes),
  },
});
```

This method reads eager `children` arrays without executing `loadChildren`.
Use `discoverRoutes('./src/app/app.routes.ts')` when lazy routes must also be
followed statically.

## Angular build integration

Generate the sitemap after the Angular build:

```json
{
  "scripts": {
    "build": "ngx-seo-kit generate && ng build"
  }
}
```

Angular copies `public/sitemap.xml` and `public/robots.txt` into the build output.
Run the generator before `ng build` so the latest files are included in the
deployment.

Example CI steps:

```yaml
- name: Install dependencies
  run: npm ci
- name: Build and generate sitemap
  run: npm run build
```

After deployment, this URL should return the XML file directly:

```text
https://example.com/sitemap.xml
```

## Troubleshooting

### Configuration file not found

The following error in CI means that a configuration file was not found in the
working directory:

```text
Config file not found. Run "ngx-seo-kit init" in an interactive terminal first.
```

Create the configuration in a local terminal and commit it, or provide its path
explicitly in the CI command:

```bash
npx ngx-seo-kit --config config/seo.production.ts
```

### Sitemap is written to the wrong directory

Match `sitemap.output` to the actual Angular build output, or temporarily
override it with `--output`. All relative paths are resolved from the working
directory.

### Configuration cannot be loaded

Use `export default` in `.ts`, `.mts`, and `.mjs` files, or
`module.exports = { ... }` in CommonJS `.cjs` files. TypeScript configurations
are transpiled by the CLI before they are loaded.

### Invalid route metadata

Check the `priority` range, `changefreq` value, and `lastmod` format. When a route
is invalid, the sitemap is not written and the CLI exits with an error.
