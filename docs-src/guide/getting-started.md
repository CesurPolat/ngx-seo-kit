# Getting started

## Install

```bash
npm install --save-dev ngx-seo-kit
```

Create `seo.config.ts` in your Angular project root:

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
  },
});
```

## Generate and validate

```bash
npx ngx-seo-kit build
```

The command validates the configuration, generates `sitemap.xml` and
`robots.txt`, and validates the generated files. For CI, use:

```bash
npx ngx-seo-kit build --json
npx ngx-seo-kit build --strict
```

To run Angular’s build after SEO validation:

```bash
npx ngx-seo-kit build --angular
```
