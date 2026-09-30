export const ROBOTS_DIRECTIVES = [
  'index',
  'noindex',
  'follow',
  'nofollow',
  'noarchive',
  'nosnippet',
  'noimageindex',
] as const;

export type RobotsDirective = (typeof ROBOTS_DIRECTIVES)[number];
export type RobotsValue = string | readonly RobotsDirective[];
export type TwitterCard = 'summary' | 'summary_large_image' | 'app' | 'player';

export interface WebSiteJsonLd {
  '@type': 'WebSite';
  name: string;
  url: string;
  description?: string;
  image?: string;
}

export interface OrganizationJsonLd {
  '@type': 'Organization';
  name: string;
  url?: string;
  logo?: string;
  sameAs?: readonly string[];
}

export interface BreadcrumbItemJsonLd {
  name: string;
  item: string;
  position?: number;
}

export interface BreadcrumbListJsonLd {
  '@type': 'BreadcrumbList';
  itemListElement: readonly BreadcrumbItemJsonLd[];
}

export type TypedJsonLd = WebSiteJsonLd | OrganizationJsonLd | BreadcrumbListJsonLd;

export interface SeoMetadata {
  title: string;
  description?: string;
  canonical?: string;
  robots?: RobotsValue;
  image?: string;
  ogType?: string;
  siteName?: string;
  locale?: string;
  twitterCard?: TwitterCard;
  jsonLd?: TypedJsonLd | readonly TypedJsonLd[];
}

export interface SeoRouteData extends Partial<SeoMetadata> {}

export interface ResolvedSeoMetadata extends Omit<SeoMetadata, 'robots' | 'canonical'> {
  title: string;
  canonical: string;
  robots?: string;
}
