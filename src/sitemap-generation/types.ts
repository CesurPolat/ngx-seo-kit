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
 * The sitemap-relevant part of an Angular `Route`.
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
  loadChildren?: (() => unknown) | unknown;
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

export interface RobotsTxtGroup {
  /** One or more crawler names, for example `*` or `Googlebot`. */
  userAgent: string | string[];
  allow?: string[];
  disallow?: string[];
  crawlDelay?: number;
}

export interface GenerateRobotsTxtOptions {
  siteUrl: string;
  /** Crawler-specific rules. Defaults to allowing every crawler. */
  groups?: RobotsTxtGroup[];
  /** Sitemap paths or absolute URLs. Defaults to `/sitemap.xml`; `false` omits them. */
  sitemap?: string | string[] | false;
}

export interface RobotsTxtOptions
  extends Omit<GenerateRobotsTxtOptions, 'siteUrl'> {
  /** File destination. Defaults to `robots.txt` beside the sitemap output. */
  output?: string;
}

export interface WriteRobotsTxtOptions extends GenerateRobotsTxtOptions {
  output: string;
}

export interface WriteRobotsTxtResult {
  output: string;
  sitemapCount: number;
}
