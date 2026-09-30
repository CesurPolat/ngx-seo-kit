export { defineSeoConfig } from './config.js';
export { runSeoBuild } from './seo-build.js';
export type { SeoBuildOptions, SeoBuildReport } from './seo-build.js';
export { getProjectStatus } from './project-status/index.js';
export type { AngularProjectStatus, AngularRenderingMode } from './project-status/index.js';
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
  generateSocialMetadataSnippet,
  installSocialMetadata,
} from './metadata/social-metadata.js';
export {
  createBreadcrumbListJsonLd,
  createOrganizationJsonLd,
  createWebSiteJsonLd,
  generateJsonLdScripts,
  normalizeJsonLd,
} from './metadata/json-ld.js';
export { normalizeRobots, resolveSeoMetadata } from './metadata/resolve.js';
export type {
  BreadcrumbItemJsonLd,
  BreadcrumbListJsonLd,
  OrganizationJsonLd,
  ResolvedSeoMetadata,
  RobotsDirective,
  RobotsValue,
  SeoMetadata,
  SeoRouteData,
  TwitterCard,
  TypedJsonLd,
  WebSiteJsonLd,
} from './metadata/types.js';
export type {
  InstallSocialMetadataOptions,
  InstallSocialMetadataResult,
  SocialMetadataOptions,
} from './metadata/social-metadata.js';
export {
  discoverRoutes,
  routesToPaths,
} from './route-discovery/index.js';
export { generateRobotsTxt, writeRobotsTxt } from './sitemap-generation/robots.js';
export { generateSitemap, generateSitemapStylesheet, writeSitemap } from './sitemap-generation/index.js';
export { CHANGE_FREQUENCIES } from './sitemap-generation/types.js';
export type {
  NgxSeoConfig,
} from './types.js';
export type {
  ChangeFrequency,
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
export type { DiscoverableRoute } from './route-discovery/types.js';
