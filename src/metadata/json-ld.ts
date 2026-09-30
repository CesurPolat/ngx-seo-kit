import { safeJson } from '../utils.js';
import type { TypedJsonLd } from './types.js';

export function createWebSiteJsonLd(input: Omit<Extract<TypedJsonLd, { '@type': 'WebSite' }>, '@type'>): TypedJsonLd {
  return { '@type': 'WebSite', ...input };
}

export function createOrganizationJsonLd(input: Omit<Extract<TypedJsonLd, { '@type': 'Organization' }>, '@type'>): TypedJsonLd {
  return { '@type': 'Organization', ...input };
}

export function createBreadcrumbListJsonLd(input: Omit<Extract<TypedJsonLd, { '@type': 'BreadcrumbList' }>, '@type'>): TypedJsonLd {
  return { '@type': 'BreadcrumbList', ...input };
}

export function normalizeJsonLd(value: TypedJsonLd | readonly TypedJsonLd[]): readonly TypedJsonLd[] {
  return Array.isArray(value)
    ? [...(value as readonly TypedJsonLd[])]
    : [value as TypedJsonLd];
}

export function generateJsonLdScripts(value: TypedJsonLd | readonly TypedJsonLd[], newline = '\n'): string {
  return normalizeJsonLd(value)
    .map((schema) => ['<script type="application/ld+json">', safeJson(schema), '</script>'].join(newline))
    .join(newline);
}
