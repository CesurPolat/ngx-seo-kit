# CLI guide

The `ngx-seo-kit` CLI generates a `sitemap.xml` file from routes declared in a
configuration file. Run commands from your project root. Relative configuration
and output paths are resolved from the directory where the command is run.

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

- **Generate sitemap** reads the current configuration and writes the sitemap.
- **Create configuration** starts the guided setup. This option is disabled when
  a configuration already exists.
- **Exit** closes the CLI without making changes.

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

Read the configuration and generate a sitemap:

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

If no configuration is found in an interactive terminal, the setup opens. The
setup is disabled in CI and non-interactive terminals. In those environments,
the command exits with an error and asks you to run `ngx-seo-kit init` first.
Create and commit the configuration file before running your CI workflow. Use
the explicit `generate` command in automation; a bare command only falls back to
generation in non-interactive environments for backward compatibility.

After successful generation, the CLI prints the absolute output path and number
of URLs written:

```text
✓ Sitemap generated: /project/public/sitemap.xml (3 URLs)
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

## Options

| Option | Short form | Description |
| --- | --- | --- |
| `--config <path>` | `-c <path>` | Configuration file to read or create with `init` |
| `--output <path>` | `-o <path>` | Override `sitemap.output` for the current invocation |
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

Angular copies `public/sitemap.xml` into the build output. Run the generator
before `ng build` so the latest sitemap is included in the deployment.

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
