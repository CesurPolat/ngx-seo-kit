# ngx-seo-kit

A type-safe SEO toolkit that generates `sitemap.xml` and `robots.txt` files for Angular applications at build time.

> This project is under active development. The first usable release focuses on generating XML sitemaps for static, predefined pages.

## Features

- Valid XML sitemap output
- Routes defined as strings or detailed objects
- Support for `lastmod`, `changefreq`, and `priority`
- Automatic duplicate URL removal
- Route and trailing-slash normalization
- Route exclusion
- Safe XML character escaping
- Optional browser-friendly HTML table through an XSL stylesheet
- Command-line interface and programmatic API
- Guided interactive CLI setup
- Guided Google Analytics installation for Angular apps
- Automatic `robots.txt` generation with a sitemap reference
- Managed Open Graph tags and Schema.org `WebSite` JSON-LD

## Requirements

- Node.js 20 or later

## Installation

After the package is published:

```bash
npm install --save-dev ngx-seo-kit
```

To work on this repository locally:

```bash
npm install
npm test
```

## Quick start

Launch the interactive main menu:

```bash
npx ngx-seo-kit
```

The menu remains open after each completed action and closes only when you
select **Exit**. Direct commands such as `ngx-seo-kit generate` still run once.

If the package is not installed in the current project, the interactive CLI
asks for confirmation before adding its current version to `devDependencies`.
Declining leaves the project unchanged and continues with the temporary `npx`
copy.

Choose **Generate SEO files**. If no configuration exists, the guided setup
opens automatically and asks for your site URL, sitemap output path, and
excluded routes. It discovers Angular
routes from `src/app/app.routes.ts`, previews the configuration, creates `seo.config.ts`, and
generates the first sitemap and robots file. If no Angular routes are found, setup still creates
the configuration with an empty `sitemap.routes` array so you can add public
paths manually; sitemap generation is skipped until routes are available.

You can skip the main menu and open the setup directly with
`npx ngx-seo-kit init`. Interactive menus are disabled in CI and build
environments, where the configuration file must already exist.

### Manual configuration

You can also create `seo.config.ts` manually in the project root:

```ts
import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: [
      ...await discoverRoutes('./src/app/app.routes.ts'),
    ],
    output: 'public/sitemap.xml',
    stylesheet: true,
    exclude: ['/404', '/admin'],
  },
  robots: {
    groups: [{ userAgent: '*', allow: ['/'], disallow: ['/admin'] }],
  },
});
```

Generate the sitemap and robots file:

```bash
npx ngx-seo-kit
```

When finished, the CLI displays the output path and URL count:

```text
✓ Sitemap generated: /project/public/sitemap.xml (4 URLs)
✓ Sitemap stylesheet generated: /project/dist/my-portfolio/browser/sitemap.xsl
✓ Robots.txt generated: /project/public/robots.txt
```

`robots.txt` is generated beside the sitemap by default and references its
public URL. Set `robots: false` to disable it, or configure `robots.output`,
`robots.groups`, and `robots.sitemap` to customize the file.

With `stylesheet: true`, search engines still receive a standard XML sitemap,
while browsers render it as a responsive HTML table. For customization:

```js
stylesheet: {
  href: '/sitemap.xsl',
  output: 'dist/my-portfolio/browser/sitemap.xsl',
  title: 'Cesur Polat Sitemap',
}
```

`discoverRoutes(...)` follows `provideRouter(...)` and `RouterModule.forRoot(...)`, including
nested `children` and relative `loadChildren` imports. Redirects, wildcards, and
parameterized paths such as `/users/:id` are skipped because they are not
concrete sitemap URLs. Its result is spread into `sitemap.routes`, where it can
be combined with explicit URLs and route metadata.

To scan a non-standard route file or add a manual URL:

```js
sitemap: {
  routes: [
    ...await discoverRoutes('./projects/storefront/src/app/app.routes.ts'),
    '/blog/generated-slug',
  ],
}
```

Alternatively, import an Angular `Routes` variable and convert its eager route
tree directly:

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

`routesToPaths(...)` walks in-memory `children` arrays but does not execute
`loadChildren` functions. Use file-based `discoverRoutes(...)` when lazy route
discovery is required or importing the application route tree has runtime side
effects.

## Angular build integration

Run the sitemap command after the Angular build:

```json
{
  "scripts": {
    "build": "ngx-seo-kit generate && ng build"
  }
}
```

Angular copies `public/sitemap.xml` and `public/robots.txt` into the build output.
Generate the files before `ng build` so the latest versions are included in the
deployment.

After deployment, the following URL should return the XML file directly:

```text
https://example.com/sitemap.xml
```

## Route metadata

Routes can include additional metadata for search engines:

```js
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    routes: [
      {
        path: '/',
        changefreq: 'weekly',
        priority: 1,
      },
      {
        path: '/projects',
        lastmod: '2026-09-03',
        changefreq: 'monthly',
        priority: 0.8,
      },
    ],
  },
};
```

Supported `changefreq` values:

```text
always, hourly, daily, weekly, monthly, yearly, never
```

`priority` must be between `0` and `1`. `lastmod` must use the `YYYY-MM-DD` format or a valid W3C datetime format.

## CLI options

In interactive terminals, the CLI checks npm for a newer `ngx-seo-kit` release
and prints the update command when one is available. Checks are skipped in CI;
set `NGX_SEO_KIT_DISABLE_UPDATE_CHECK=1` to opt out elsewhere.

See the [CLI guide](./docs/cli.md) for setup, configuration precedence, CI usage,
and troubleshooting details.

```text
ngx-seo-kit [options]
ngx-seo-kit generate [options]
ngx-seo-kit init [options]

Commands:
  (none)               Open the interactive main menu
  generate             Generate the sitemap
  init                 Open the setup menu and create a configuration file

Options:
  -c, --config <path>  Configuration file (default: seo.config.ts)
  -o, --output <path>  Override the output path from the configuration
  -h, --help           Show help
```

To use a different configuration file or output path:

```bash
npx ngx-seo-kit generate --config config/seo.production.ts --output public/sitemap.xml
```

When no configuration path is provided, the CLI searches for `seo.config.ts`,
`seo.config.mts`, `seo.config.mjs`, `seo.config.js`, and `seo.config.cjs`, in
that order.

A working example is available in [seo.config.example.ts](./seo.config.example.ts).

## Google Analytics setup

Install the Google tag in the default Angular `src/index.html` file:

```bash
npx ngx-seo-kit analytics
```

The interactive command asks for the Google Analytics measurement ID, validates
its `G-...` format, and inserts the tag before `</head>`. For CI or scripts, pass
the ID directly:

```bash
npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX
```

For an Angular monorepo or a custom index path:

```bash
npx ngx-seo-kit analytics \
  --tag-id G-XXXXXXXXXX \
  --index projects/storefront/src/index.html
```

Running the command again is safe. It leaves an identical installation alone
and updates a tag previously installed by `ngx-seo-kit` when the measurement ID
changes. If an unmanaged Google tag already exists, the command stops instead
of adding a second tag and potentially recording duplicate events.

For Angular client-side navigation, enable **Page changes based on browser
history events** in the web stream's Enhanced Measurement settings. Review the
consent and privacy requirements that apply to the site before deploying
analytics.

## Open Graph and Schema setup

Choose **Set up Open Graph & Schema** from the interactive menu, or run:

```bash
npx ngx-seo-kit metadata
```

The guided setup writes managed Open Graph tags and a Schema.org `WebSite`
JSON-LD block into `src/index.html`. Re-running it updates the owned block
without creating duplicates. Existing Open Graph tags without ngx-seo-kit
markers are never overwritten automatically.

For CI or a non-interactive terminal, provide the required values explicitly:

```bash
npx ngx-seo-kit metadata \
  --title "Example" \
  --description "Example Angular application" \
  --url https://example.com \
  --image https://example.com/og-image.png
```

Use `--index projects/storefront/src/index.html` for a custom Angular index
path. `--site-name` and `--locale` are optional. This feature installs global
fallback metadata; route-specific metadata still belongs in the Angular
application or its SSR rendering flow.

## Programmatic API

Generate XML without writing it to a file:

```ts
import { generateSitemap } from 'ngx-seo-kit';

const xml = generateSitemap({
  siteUrl: 'https://example.com',
  routes: ['/', '/projects'],
});
```

Discover routes directly:

```ts
import { discoverRoutes } from 'ngx-seo-kit';

const routes = await discoverRoutes('./src/app/app.routes.ts');
```

Convert an imported Angular route variable:

```ts
import { routesToPaths } from 'ngx-seo-kit';
import { routes } from './src/app/app.routes';

const paths = routesToPaths(routes);
```

Write the sitemap to a file:

```ts
import { writeSitemap } from 'ngx-seo-kit';

const result = await writeSitemap({
  siteUrl: 'https://example.com',
  routes: ['/', '/projects'],
  output: 'public/sitemap.xml',
});

console.log(result.output, result.urlCount);
```

Use `defineSeoConfig` when defining a TypeScript configuration:

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: ['/', '/about'],
  },
});
```

The CLI runs `.ts` and `.mts` configurations through its TypeScript loader.
JavaScript `.mjs`, `.js`, and `.cjs` configurations remain supported.

## Generated XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
</urlset>
```

## Limitations

Dynamic parameters cannot be expanded without application data. Add those
concrete URLs through `sitemap.routes`; fetching slugs from APIs is not yet
automatic.

## Roadmap

- [x] Configuration-based XML sitemap generation
- [x] CLI and programmatic API
- [x] Route normalization and validation
- [x] Automatic Angular route discovery
- [ ] Dynamic route sources
- [ ] Sitemap indexes and splitting at 50,000 URLs
- [x] `robots.txt` generation with a sitemap reference

## Development

```bash
npm install
npm run build
npm test
```

## License

[MIT](./LICENSE)
