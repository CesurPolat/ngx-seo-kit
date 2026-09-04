import { defineSeoConfig, discoverRoutes } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'public/sitemap.xml',
    stylesheet: {
      href: '/sitemap.xsl',
      title: 'Example Sitemap',
    },
    routes: [
      ...await discoverRoutes('./src/app/app.routes.ts'),
      { path: '/projects/featured', changefreq: 'weekly', priority: 0.9 },
    ],
    exclude: ['/404', '/admin'],
  },
});
