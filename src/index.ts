export { defineSeoConfig } from './config.js';
export {
  generateGoogleTagSnippet,
  installGoogleTag,
  normalizeGoogleTagId,
} from './analytics/google-tag.js';
export type {
  InstallGoogleTagOptions,
  InstallGoogleTagResult,
} from './analytics/google-tag.js';
export {
  discoverAngularRoutes,
  discoverRoutes,
  routesToPaths,
  routesToPathsAsync,
} from './sitemap-generation/route-discovery.js';
export { generateRobotsTxt, writeRobotsTxt } from './sitemap-generation/robots.js';
export { generateSitemap, generateSitemapStylesheet, writeSitemap } from './sitemap-generation/index.js';
export { CHANGE_FREQUENCIES } from './sitemap-generation/types.js';
export type {
  NgxSeoConfig,
} from './types.js';
export type {
  AngularRouteDiscoveryOptions,
  ChangeFrequency,
  DiscoverableRoute,
  GenerateRobotsTxtOptions,
  GenerateSitemapOptions,
  RobotsTxtGroup,
  RobotsTxtOptions,
  SitemapOptions,
  SitemapRoute,
  SitemapRouteInput,
  SitemapStylesheetOptions,
  WriteSitemapOptions,
  WriteSitemapResult,
  WriteRobotsTxtOptions,
  WriteRobotsTxtResult,
} from './sitemap-generation/types.js';
