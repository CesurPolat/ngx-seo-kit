import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  CHANGE_FREQUENCIES,
  type GenerateSitemapOptions,
  type SitemapRoute,
  type SitemapRouteInput,
  type WriteSitemapOptions,
  type WriteSitemapResult,
} from './types.js';

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN = '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const URLSET_CLOSE = '</urlset>';

export function generateSitemap(options: GenerateSitemapOptions): string {
  const siteUrl = normalizeSiteUrl(options.siteUrl);
  const excludedPaths = new Set((options.exclude ?? []).map(normalizePath));
  const uniqueRoutes = new Map<string, SitemapRoute>();

  for (const input of options.routes) {
    const route = normalizeRoute(input);

    if (excludedPaths.has(route.path) || uniqueRoutes.has(route.path)) {
      continue;
    }

    validateRoute(route);
    uniqueRoutes.set(route.path, route);
  }

  const entries = [...uniqueRoutes.values()].map((route) => {
    const lines = ['  <url>', `    <loc>${escapeXml(toAbsoluteUrl(siteUrl, route.path))}</loc>`];

    if (route.lastmod !== undefined) {
      lines.push(`    <lastmod>${formatLastModified(route.lastmod)}</lastmod>`);
    }

    if (route.changefreq !== undefined) {
      lines.push(`    <changefreq>${route.changefreq}</changefreq>`);
    }

    if (route.priority !== undefined) {
      lines.push(`    <priority>${formatPriority(route.priority)}</priority>`);
    }

    lines.push('  </url>');
    return lines.join('\n');
  });

  return [XML_HEADER, URLSET_OPEN, ...entries, URLSET_CLOSE, ''].join('\n');
}

export async function writeSitemap(options: WriteSitemapOptions): Promise<WriteSitemapResult> {
  if (!options.output.trim()) {
    throw new Error('Sitemap output path cannot be empty.');
  }

  const output = resolve(options.output);
  const xml = generateSitemap(options);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, xml, 'utf8');

  return {
    output,
    urlCount: countUrls(xml),
  };
}

function normalizeSiteUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid siteUrl: "${value}".`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('siteUrl must use http or https.');
  }

  if (url.search || url.hash) {
    throw new Error('siteUrl cannot contain a query string or hash.');
  }

  return url.toString().replace(/\/$/, '');
}

function normalizeRoute(input: SitemapRouteInput): SitemapRoute {
  const route = typeof input === 'string' ? { path: input } : { ...input };
  return { ...route, path: normalizePath(route.path) };
}

function normalizePath(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error('Sitemap route path cannot be empty.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    return normalizePath(`${url.pathname}${url.search}`);
  }

  const [withoutHash] = trimmed.split('#', 1);
  const path = withoutHash?.startsWith('/') ? withoutHash : `/${withoutHash ?? ''}`;
  const normalized = path.replace(/\/{2,}/g, '/');

  return normalized.length > 1 ? normalized.replace(/\/$/, '') : normalized;
}

function validateRoute(route: SitemapRoute): void {
  if (route.changefreq !== undefined && !CHANGE_FREQUENCIES.includes(route.changefreq)) {
    throw new Error(`Invalid changefreq for route "${route.path}": "${route.changefreq}".`);
  }

  if (route.priority !== undefined) {
    if (!Number.isFinite(route.priority) || route.priority < 0 || route.priority > 1) {
      throw new Error(`Priority for route "${route.path}" must be between 0 and 1.`);
    }
  }

  if (route.lastmod !== undefined) {
    formatLastModified(route.lastmod);
  }
}

function toAbsoluteUrl(siteUrl: string, path: string): string {
  return new URL(path.replace(/^\//, ''), `${siteUrl}/`).toString();
}

function formatLastModified(value: string | Date): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('lastmod contains an invalid Date.');
    }

    return value.toISOString();
  }

  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) {
    throw new Error(`Invalid lastmod value: "${value}".`);
  }

  return value;
}

function formatPriority(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function countUrls(xml: string): number {
  return xml.match(/<url>/g)?.length ?? 0;
}
