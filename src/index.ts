export { defineSeoConfig } from './config.js';
export {
  discoverAngularRoutes,
  discoverRoutes,
  routesToPaths,
} from './route-discovery.js';
export { generateSitemap, generateSitemapStylesheet, writeSitemap } from './sitemap/index.js';
export { CHANGE_FREQUENCIES } from './sitemap/types.js';
export type {
  AngularRouteDiscoveryOptions,
  DiscoverableRoute,
  NgxSeoConfig,
} from './types.js';
export type {
  ChangeFrequency,
  GenerateSitemapOptions,
  SitemapOptions,
  SitemapRoute,
  SitemapRouteInput,
  SitemapStylesheetOptions,
  WriteSitemapOptions,
  WriteSitemapResult,
} from './sitemap/types.js';
