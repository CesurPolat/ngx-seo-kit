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
your site URL, sitemap output path, routes, and excluded routes. It previews the
configuration before creating `seo.config.mjs` and generating the first sitemap.

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
    routes: ['/', '/about', '/projects', '/contact'],
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
✓ Sitemap generated: /project/dist/my-portfolio/browser/sitemap.xml (4 URLs)
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

The first release reads its route list from the configuration file. It does not automatically analyze Angular Router files or fetch dynamic blog and project slugs from an API. These features are planned for future releases.

## Roadmap

- [x] Configuration-based XML sitemap generation
- [x] CLI and programmatic API
- [x] Route normalization and validation
- [ ] Automatic Angular route discovery
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
