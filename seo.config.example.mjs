/** @type {import('ngx-seo-kit').NgxSeoConfig} */
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'dist/browser/sitemap.xml',
    discoverRoutes: true,
    routes: [
      { path: '/projects/featured', changefreq: 'weekly', priority: 0.9 },
    ],
    exclude: ['/404', '/admin'],
  },
};
