import { discoverRoutes } from 'ngx-seo-kit';

/** @type {import('ngx-seo-kit').NgxSeoConfig} */
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'dist/browser/sitemap.xml',
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
};
