# ngx-seo-kit

A type-safe SEO toolkit that generates `sitemap.xml` files for Angular applications at build time.

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

Choose **Create configuration** to start the guided setup. The setup asks for
your site URL, sitemap output path, and excluded routes. It discovers Angular
routes under `src`, previews the configuration, creates `seo.config.mjs`, and
generates the first sitemap. If no Angular routes are found, setup still creates
the configuration with an empty `sitemap.routes` array so you can add public
paths manually; sitemap generation is skipped until routes are available.

You can skip the main menu and open the setup directly with
`npx ngx-seo-kit init`. Interactive menus are disabled in CI and build
environments, where the configuration file must already exist.

### Manual configuration

You can also create `seo.config.mjs` manually in the project root:

```js
/** @type {import('ngx-seo-kit').NgxSeoConfig} */
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'dist/my-portfolio/browser/sitemap.xml',
    stylesheet: true,
    exclude: ['/404', '/admin'],
  },
};
```

Generate the sitemap:

```bash
npx ngx-seo-kit
```

When finished, the CLI displays the output path and URL count:

```text
✓ Sitemap generated: /project/dist/my-portfolio/browser/sitemap.xml (4 URLs, 4 discovered)
✓ Sitemap stylesheet generated: /project/dist/my-portfolio/browser/sitemap.xsl
```

With `stylesheet: true`, search engines still receive a standard XML sitemap,
while browsers render it as a responsive HTML table. For customization:

```js
stylesheet: {
  href: '/sitemap.xsl',
  output: 'dist/my-portfolio/browser/sitemap.xsl',
  title: 'Cesur Polat Sitemap',
}
```

The CLI follows `provideRouter(...)` and `RouterModule.forRoot(...)`, including
nested `children` and relative `loadChildren` imports. Redirects, wildcards, and
parameterized paths such as `/users/:id` are skipped because they are not
concrete sitemap URLs. Explicit `sitemap.routes` entries remain available for
dynamic URLs and metadata, and are merged with discovered routes.

To scan a non-standard source directory or disable discovery:

```js
sitemap: {
  discoverRoutes: { root: 'projects/storefront/src' },
  // discoverRoutes: false,
  routes: ['/blog/generated-slug'],
}
```

## Angular build integration

Run the sitemap command after the Angular build:

```json
{
  "scripts": {
    "build": "ng build && ngx-seo-kit generate"
  }
}
```

The `sitemap.output` value must point to the deployed directory of your Angular application. In modern Angular SSR projects, this is usually `dist/<project-name>/browser`; it may differ for static-only builds.

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
  -c, --config <path>  Configuration file (default: seo.config.mjs)
  -o, --output <path>  Override the output path from the configuration
  -h, --help           Show help
```

To use a different configuration file or output path:

```bash
npx ngx-seo-kit generate --config config/seo.production.mjs --output dist/browser/sitemap.xml
```

When no configuration path is provided, the CLI searches for `seo.config.mjs`, `seo.config.js`, and `seo.config.cjs`, in that order.

A working example is available in [seo.config.example.mjs](./seo.config.example.mjs).

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
import { discoverAngularRoutes } from 'ngx-seo-kit';

const routes = await discoverAngularRoutes(process.cwd());
```

Write the sitemap to a file:

```ts
import { writeSitemap } from 'ngx-seo-kit';

const result = await writeSitemap({
  siteUrl: 'https://example.com',
  routes: ['/', '/projects'],
  output: 'dist/browser/sitemap.xml',
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

The CLI currently loads configuration files directly through Node.js, so executable configurations must use the `.mjs`, `.js`, or `.cjs` extension.

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
- [ ] `robots.txt` generation with a sitemap reference

## Development

```bash
npm install
npm run build
npm test
```

## License

[MIT](./LICENSE)
