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
init        Create an SEO config interactively
analytics   Install Google Analytics in an Angular index.html
metadata    Install Open Graph and Schema.org metadata
status      Show Angular version, SSR and prerender status
version     Print the installed version
update      Install the latest version
```

Use `npx ngx-seo-kit --help` for all options.

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

```bash
npm install
npm test
```

## License

MIT
