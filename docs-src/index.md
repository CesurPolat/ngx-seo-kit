---
layout: home

hero:
  name: ngx-seo-kit
  text: Angular SEO without the plumbing
  tagline: Generate sitemaps, robots.txt and route-aware metadata from one typed configuration.
  image:
    src: /logo.png
    alt: ngx-seo-kit logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Read the CLI guide
      link: /cli

features:
  - title: Sitemap and robots generation
    details: Produce deterministic search-engine files from your Angular routes.
  - title: Route-aware metadata
    details: Resolve title, description, canonical, robots and social metadata from route data.
  - title: Build validation
    details: Run one command to generate and validate your SEO output in CI.
---

## Why ngx-seo-kit?

Keep SEO configuration close to your Angular project while keeping the build
deterministic and reviewable. The CLI handles static artifacts, while the
optional Angular provider updates metadata as users navigate between routes.

```bash
npm install --save-dev ngx-seo-kit
npx ngx-seo-kit build
```
