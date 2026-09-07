import type { SitemapOptions } from './sitemap/types.js';

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
