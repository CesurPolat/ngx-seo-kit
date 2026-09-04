export class SiteUrlError extends Error {
  constructor(
    readonly code: 'invalid' | 'unsupported-protocol' | 'query-or-hash',
    message: string,
  ) {
    super(message);
    this.name = 'SiteUrlError';
  }
}

export function withDefaultProtocol(value: string): string {
  const url = value.trim();
  return /^[a-z][a-z\d+.-]*:\/\//i.test(url) ? url : `https://${url}`;
}

export function normalizeSiteUrl(value: string): string {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new SiteUrlError('invalid', `Invalid siteUrl: "${value}".`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SiteUrlError('unsupported-protocol', 'siteUrl must use http or https.');
  }

  if (url.search || url.hash) {
    throw new SiteUrlError(
      'query-or-hash',
      'siteUrl cannot contain a query string or hash.',
    );
  }

  return url.toString().replace(/\/$/, '');
}
