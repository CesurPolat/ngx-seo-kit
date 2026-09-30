# ngx-seo-kit

Build-time SEO tools for Angular applications. Generates `sitemap.xml` and
`robots.txt`, and provides optional Open Graph, Schema.org, Analytics, route
discovery, and project status helpers.

## Requirements

- Node.js 20+
- Angular project for the Angular-specific features

## Install

```bash
npm install --save-dev ngx-seo-kit
```

## Quick start

Create `seo.config.ts` in the Angular project root:

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: ['/', '/about', '/contact'],
    output: 'public/sitemap.xml',
    stylesheet: true,
    exclude: ['/admin'],
  },
});
```

Generate the files:

```bash
npx ngx-seo-kit generate
```

This writes the sitemap and, unless disabled, `robots.txt` beside it.

```ts
robots: false
```

## Interactive CLI

Run the CLI without a command to open the menu:

```bash
npx ngx-seo-kit
```

Available commands:

```text
generate    Generate sitemap.xml and robots.txt
build       Generate and validate SEO files; optionally run ng build
init        Create an SEO config interactively
analytics   Install Google Analytics in an Angular index.html
metadata    Install Open Graph and Schema.org metadata
status      Show Angular version, SSR and prerender status
version     Print the installed version
update      Install the latest version
```

Use `npx ngx-seo-kit --help` for all options.

## SEO build pipeline

Run the SEO generation and validation pipeline:

```bash
npx ngx-seo-kit build
```

This validates `seo.config.ts`, checks route duplicates, generates and reads
back `sitemap.xml` and `robots.txt`, and fails when the generated files are
invalid. Use strict mode to treat warnings such as missing global metadata as
errors:

```bash
npx ngx-seo-kit build --strict
npx ngx-seo-kit build --json
```

To run Angular’s production build after the SEO pipeline succeeds:

```bash
npx ngx-seo-kit build --angular
```

The command does not modify route files or `index.html`; metadata installation
remains the responsibility of the `metadata` command and runtime route SEO
remains the responsibility of `provideNgxSeo`.

## Route discovery

### Runtime routes with `ng test`

`discoverRoutes()` runs the Angular route-export test and returns the runtime
paths:

```ts
import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: await discoverRoutes(),
  },
});
```

The project must contain a route-export test that prints the marker
`[ngx-seo-kit:routes]` with a JSON array.

When `discoverRoutes()` runs, it creates these files automatically if neither
file exists. Existing files are never overwritten.

### In-memory Angular routes

Use `routesToPaths()` when the route tree is already imported:

```ts
import { routesToPaths } from 'ngx-seo-kit';
import { routes } from './src/app/app.routes';

const paths = routesToPaths(routes);
```

Redirects, wildcards, parameterized paths, and routes without a component are
excluded because they are not concrete sitemap URLs.

## Project status

Check Angular, SSR, and prerender settings:

```bash
npx ngx-seo-kit status
```

Or use the API:

```ts
import { getProjectStatus } from 'ngx-seo-kit';

const status = await getProjectStatus();
```

The status reader checks `package.json` and `angular.json`, including Angular
`targets`/`architect`, SSR and prerender builders, `outputMode`, and scripts.

## Roadmap

Planned features and target delivery dates are tracked in
[`ROADMAP.md`](ROADMAP.md).

- **15 October 2026** — Config diagnostics and actionable CLI errors
- **30 October 2026** — CI-friendly `check` command
- **15 November 2026** — Typed page-level metadata
- **30 November 2026** — Canonical and Twitter/X metadata
- **15 December 2026** — Expanded structured data support
- **31 January 2027** — Sitemap indexes and large-site support
- **31 March 2027** — SEO audit report command

## Sitemap routes

Routes can include sitemap metadata:

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: [
      '/',
      {
        path: '/blog',
        lastmod: '2026-09-26',
        changefreq: 'weekly',
        priority: 0.8,
      },
    ],
  },
});
```

Supported `changefreq` values are `always`, `hourly`, `daily`, `weekly`,
`monthly`, `yearly`, and `never`. Priorities must be between `0` and `1`.

## Angular build integration

Generate SEO files before the Angular build so they are copied to the output:

```json
{
  "scripts": {
    "build": "ngx-seo-kit generate && ng build"
  }
}
```

## Metadata helpers

Install Google Analytics:

```bash
npx ngx-seo-kit analytics --tag-id G-XXXXXXXXXX
```

Install Open Graph and Schema.org metadata:

```bash
npx ngx-seo-kit metadata \
  --title "Example" \
  --description "Example site" \
  --url https://example.com \
  --image https://example.com/og-image.png
```

Global metadata can also be kept in `seo.config.ts` as a fallback for every
route:

```ts
export default defineSeoConfig({
  siteUrl: 'https://example.com',
  metadata: {
    title: 'Example',
    description: 'Example Angular application',
    image: 'https://example.com/og-image.png',
  },
  sitemap: { routes: ['/'] },
});
```

For page-level metadata, put partial SEO data in Angular route `data.seo`.
Child routes override parent routes, and missing fields fall back to the global
metadata:

```ts
{
  path: 'products',
  data: {
    seo: {
      title: 'Products',
      description: 'Browse our products',
      robots: ['index', 'follow'],
      twitterCard: 'summary_large_image',
    },
  },
}
```

The Angular entrypoint exports `provideNgxSeo`. Pass the same config used by
the CLI (or its `siteUrl` and `metadata` fields) once from `app.config.ts`:

```ts
import seoConfig from '../../seo.config';
import { provideNgxSeo } from 'ngx-seo-kit/angular';

export const appConfig: ApplicationConfig = {
  providers: [provideNgxSeo(seoConfig)],
};
```

The provider owns the Angular service and router subscription. Canonical URLs
are derived from `siteUrl` and the active router URL when a route does not
define one. Angular remains an optional peer dependency of the core package.

Typed JSON-LD helpers are available for `WebSite`, `Organization` and
`BreadcrumbList`; custom JSON-LD blocks can be passed through `jsonLd`.

## Programmatic API

```ts
import {
  defineSeoConfig,
  generateRobotsTxt,
  generateSitemap,
  getProjectStatus,
  routesToPaths,
  writeRobotsTxt,
  writeSitemap,
} from 'ngx-seo-kit';
```

## Development

Build the documentation site as static HTML for GitHub Pages:

```bash
npm run docs:build
```

The generated site is written to `docs/index.html` and can be served from the
repository’s `docs` folder.

```bash
npm install
npm test
```

## License

MIT
