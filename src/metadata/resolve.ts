import type { ResolvedSeoMetadata, SeoMetadata, SeoRouteData } from './types.js';

export function resolveSeoMetadata(
  global: SeoMetadata,
  parents: readonly SeoRouteData[],
  currentUrl: string,
  siteUrl: string,
): ResolvedSeoMetadata {
  const merged = parents.reduce<SeoMetadata>((result, route) => ({ ...result, ...route }), { ...global });
  const routeCanonical = [...parents].reverse().find((route) => route.canonical)?.canonical;
  let canonical: string;
  if (routeCanonical) canonical = routeCanonical;
  else if (parents.length === 0 && global.canonical) canonical = global.canonical;
  else {
    try { canonical = new URL(currentUrl, ensureTrailingSlash(siteUrl)).toString(); }
    catch { throw new Error('SEO siteUrl must be an absolute URL using http or https.'); }
  }
  const { robots, canonical: _canonical, ...rest } = merged;
  return {
    ...rest,
    title: requireText(merged.title, 'title'),
    canonical: normalizeHttpUrl(canonical, 'canonical'),
    ...(merged.description ? { description: merged.description.trim() } : {}),
    ...(merged.image ? { image: normalizeHttpUrl(merged.image, 'image') } : {}),
    ...(robots ? { robots: normalizeRobots(robots) } : {}),
  };
}

export function normalizeRobots(value: string | readonly string[]): string {
  const directives: readonly string[] = typeof value === 'string' ? value.split(',') : value;
  const normalized = directives.map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (normalized.length === 0) throw new Error('robots cannot be empty.');
  if (normalized.some((item) => !/^[a-z][a-z0-9-]*$/.test(item))) {
    throw new Error('robots contains an invalid directive.');
  }
  return [...new Set(normalized)].join(',');
}

function requireText(value: string | undefined, name: string): string {
  const normalized = value?.trim();
  if (!normalized) throw new Error(`SEO ${name} cannot be empty.`);
  return normalized;
}

function normalizeHttpUrl(value: string, name: string): string {
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new Error(`SEO ${name} must be an absolute URL.`); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`SEO ${name} must use http or https.`);
  }
  return url.toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
