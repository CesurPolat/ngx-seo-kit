import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'ngx-seo-kit',
  description: 'Build-time SEO tools for Angular applications.',
  lang: 'en-US',
  base: '/ngx-seo-kit/',
  outDir: '../docs',
  cleanUrls: true,
  lastUpdated: true,
  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'ngx-seo-kit',
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'CLI', link: '/cli' },
      { text: 'API', link: '/guide/api' },
      { text: 'GitHub', link: 'https://github.com/CesurPolat/ngx-seo-kit' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Metadata and Angular runtime', link: '/guide/metadata' },
            { text: 'API reference', link: '/guide/api' },
          ],
        },
      ],
      '/': [
        {
          text: 'Documentation',
          items: [
            { text: 'CLI guide', link: '/cli' },
            { text: 'Angular route discovery', link: '/angular-runtime-route-test' },
          ],
        },
      ],
    },
    editLink: {
      pattern: 'https://github.com/CesurPolat/ngx-seo-kit/edit/main/docs-src/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/CesurPolat/ngx-seo-kit' },
    ],
    search: { provider: 'local' },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 ngx-seo-kit contributors',
    },
  },
});
