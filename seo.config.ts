import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  "siteUrl": "https://example.com",
  "sitemap": {
    "output": "public/sitemap.xml",
    "stylesheet": true,
    "routes": []
  }
});
