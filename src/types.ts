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
  stylesheet?: boolean | SitemapStylesheetOptions;
  exclude?: string[];
  output?: string;
}

export interface SitemapStylesheetOptions {
  /** Browser-facing URL in the XML instruction. Defaults to `sitemap.xsl`. */
  href?: string;
  /** File destination. Defaults to the sitemap output with an `.xsl` extension. */
  output?: string;
  /** Heading and document title shown by browsers. */
  title?: string;
}

export interface AngularRouteDiscoveryOptions {
  /** Angular source directory. Defaults to `<project>/src`. */
  root?: string;
}

/**
 * The statically inspectable part of an Angular `Route`.
 *
 * Angular's `Routes` type is structurally compatible with this type, so using
 * this API does not add `@angular/router` as a dependency of ngx-seo-kit.
 */
export interface DiscoverableRoute {
  path?: string;
  redirectTo?: unknown;
  component?: unknown;
  loadComponent?: unknown;
  children?: readonly DiscoverableRoute[];
  loadChildren?: unknown;
}

export interface NgxSeoConfig {
  siteUrl: string;
  sitemap: SitemapOptions;
}

export interface GenerateSitemapOptions {
  siteUrl: string;
  routes: SitemapRouteInput[];
  exclude?: string[];
  stylesheet?: string;
}

export interface WriteSitemapOptions extends Omit<GenerateSitemapOptions, 'stylesheet'> {
  output: string;
  stylesheet?: boolean | SitemapStylesheetOptions;
}

export interface WriteSitemapResult {
  output: string;
  urlCount: number;
  stylesheetOutput?: string;
}
