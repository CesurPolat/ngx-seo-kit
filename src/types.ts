export const CHANGE_FREQUENCIES = [
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
] as const;

export type ChangeFrequency = (typeof CHANGE_FREQUENCIES)[number];

export interface SitemapRoute {
  path: string;
  lastmod?: string | Date;
  changefreq?: ChangeFrequency;
  priority?: number;
}

export type SitemapRouteInput = string | SitemapRoute;

export interface SitemapOptions {
  routes: SitemapRouteInput[];
  exclude?: string[];
  output?: string;
}

export interface NgxSeoConfig {
  siteUrl: string;
  sitemap: SitemapOptions;
}

export interface GenerateSitemapOptions {
  siteUrl: string;
  routes: SitemapRouteInput[];
  exclude?: string[];
}

export interface WriteSitemapOptions extends GenerateSitemapOptions {
  output: string;
}

export interface WriteSitemapResult {
  output: string;
  urlCount: number;
}
