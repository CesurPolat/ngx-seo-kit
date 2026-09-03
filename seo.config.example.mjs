/** @type {import('ngx-seo-kit').NgxSeoConfig} */
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'dist/browser/sitemap.xml',
    routes: [
      { path: '/', changefreq: 'weekly', priority: 1 },
      { path: '/about', changefreq: 'monthly', priority: 0.8 },
      { path: '/projects', changefreq: 'weekly', priority: 0.9 },
      '/contact',
    ],
    exclude: ['/404', '/admin'],
  },
};
