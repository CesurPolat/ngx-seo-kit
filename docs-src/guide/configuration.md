# Configuration

`seo.config.ts` is the source of truth for static SEO output.

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  metadata: {
    title: 'Example',
    description: 'Default page description',
    canonical: 'https://example.com/',
    image: 'https://example.com/og-image.png',
    robots: ['index', 'follow'],
    twitterCard: 'summary_large_image',
  },
  sitemap: {
    routes: [
      '/',
      { path: '/blog', changefreq: 'weekly', priority: 0.8 },
    ],
    output: 'public/sitemap.xml',
  },
});
```

`siteUrl` and metadata image/canonical values must be absolute `http` or
`https` URLs. Sitemap routes are normalized and duplicate routes fail the
`build` pipeline.
