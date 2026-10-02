<p align="center">
  <img src="docs-src/public/banner.png" alt="ngx-seo-kit banner" width="100%" />
</p>

<p align="center">
  <strong>Build-time SEO tools for Angular applications.</strong><br />
  Generate sitemaps, robots.txt, metadata, structured data, and route-aware SEO output from one typed configuration.
</p>

<p align="center">
  <a href="https://ngx-seo-kit.cesurpolat.dev/">Documentation</a> ·
  <a href="https://github.com/CesurPolat/ngx-seo-kit/issues">Issues</a> ·
  <a href="LICENSE">MIT License</a>
</p>

## ✨ Features

- 🗺️ **Sitemap and robots generation** — Produce deterministic `sitemap.xml` and `robots.txt` files from Angular routes.
- 🧭 **Route-aware metadata** — Resolve titles, descriptions, canonicals, robots directives, Open Graph, Twitter cards, and JSON-LD.
- 🧪 **Build validation** — Validate configuration, detect duplicate routes, and fail CI when generated SEO files are invalid.
- 🔍 **Angular route discovery** — Export runtime routes from `ng test` or convert an in-memory Angular route tree to sitemap paths.
- 🛠️ **Interactive CLI** — Initialize configuration, install metadata, inspect project status, and run the complete SEO build pipeline.
- 📦 **Typed API** — Use the same configuration and helpers programmatically from Node.js or Angular.

## 📥 Install

```bash
npm install --save-dev ngx-seo-kit
```

Requires Node.js 20+. Angular is only required for Angular-specific features.

## 🚀 Quick start

Create `seo.config.ts` in the Angular project root:

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  metadata: {
    title: 'Example',
    description: 'Example Angular application',
    image: 'https://example.com/og-image.png',
  },
  sitemap: {
    routes: ['/', '/about', '/contact'],
    output: 'public/sitemap.xml',
    stylesheet: true,
    exclude: ['/admin'],
  },
});
```

Generate the SEO files:

```bash
npx ngx-seo-kit generate
```

To validate the output and optionally run the Angular build:

```bash
npx ngx-seo-kit build
npx ngx-seo-kit build --strict
npx ngx-seo-kit build --angular
```

## 🔌 CLI

Run the CLI without a command to open the interactive menu:

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

## 🧩 Angular runtime metadata

Install the provider once from `app.config.ts`:

```ts
import { ApplicationConfig } from '@angular/core';
import { provideNgxSeo } from 'ngx-seo-kit/angular';
import seoConfig from '../../seo.config';

export const appConfig: ApplicationConfig = {
  providers: [provideNgxSeo(seoConfig)],
};
```

Page-level SEO data can live in Angular route definitions. Child routes override
parent routes, while missing fields fall back to global metadata:

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

## 🗺️ Route discovery

Discover runtime routes through an Angular route-export test:

```ts
import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: { routes: await discoverRoutes() },
});
```

If routes are already imported, convert them directly:

```ts
import { routesToPaths } from 'ngx-seo-kit';
import { routes } from './src/app/app.routes';

const paths = routesToPaths(routes);
```

Redirects, wildcards, parameterized paths, and routes without a component are
excluded because they are not concrete sitemap URLs.

## 🧱 Build integration

Generate SEO files before the Angular build so they are copied to the final
application output:

```json
{
  "scripts": {
    "build": "ngx-seo-kit generate && ng build"
  }
}
```

## 📚 Documentation

Read the full documentation at
[ngx-seo-kit.cesurpolat.dev](https://ngx-seo-kit.cesurpolat.dev/).

- [Getting started](https://ngx-seo-kit.cesurpolat.dev/guide/getting-started)
- [Configuration](https://ngx-seo-kit.cesurpolat.dev/guide/configuration)
- [Metadata and Angular runtime](https://ngx-seo-kit.cesurpolat.dev/guide/metadata)
- [API reference](https://ngx-seo-kit.cesurpolat.dev/guide/api)
- [CLI guide](https://ngx-seo-kit.cesurpolat.dev/cli)
- [Roadmap](ROADMAP.md)

Build the static documentation site locally:

```bash
npm run docs:dev
```

## 🛠️ Development

```bash
npm install
npm test
npm run docs:build
```

## 📄 License

MIT
