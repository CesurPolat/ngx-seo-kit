import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { escapeHtmlAttribute, escapeRegExp, safeJson } from '../utils.js';

const METADATA_START = '<!-- ngx-seo-kit:social-metadata:start -->';
const METADATA_END = '<!-- ngx-seo-kit:social-metadata:end -->';

export interface SocialMetadataOptions {
  title: string;
  description: string;
  url: string;
  image: string;
  siteName?: string;
  locale?: string;
}

export interface InstallSocialMetadataOptions extends SocialMetadataOptions {
  index?: string;
}

export interface InstallSocialMetadataResult {
  action: 'added' | 'updated' | 'unchanged';
  index: string;
}

export function generateSocialMetadataSnippet(
  options: SocialMetadataOptions,
  newline = '\n',
): string {
  const metadata = normalizeSocialMetadata(options);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: metadata.siteName ?? metadata.title,
    url: metadata.url,
    description: metadata.description,
    image: metadata.image,
  };

  return [
    METADATA_START,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtmlAttribute(metadata.title)}">`,
    `<meta property="og:description" content="${escapeHtmlAttribute(metadata.description)}">`,
    `<meta property="og:url" content="${escapeHtmlAttribute(metadata.url)}">`,
    `<meta property="og:image" content="${escapeHtmlAttribute(metadata.image)}">`,
    ...(metadata.siteName
      ? [`<meta property="og:site_name" content="${escapeHtmlAttribute(metadata.siteName)}">`]
      : []),
    ...(metadata.locale
      ? [`<meta property="og:locale" content="${escapeHtmlAttribute(metadata.locale)}">`]
      : []),
    '<script type="application/ld+json">',
    safeJson(schema),
    '</script>',
    METADATA_END,
  ].join(newline);
}

export async function installSocialMetadata(
  options: InstallSocialMetadataOptions,
): Promise<InstallSocialMetadataResult> {
  const index = resolve(options.index ?? 'src/index.html');
  let html: string;

  try {
    html = await readFile(index, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `Angular index file not found at "${index}". Pass its path with --index.`,
      );
    }
    throw error;
  }

  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  const snippet = generateSocialMetadataSnippet(options, newline);
  const ownedBlockPattern = new RegExp(
    `${escapeRegExp(METADATA_START)}[\\s\\S]*?${escapeRegExp(METADATA_END)}`,
  );
  const ownedBlock = html.match(ownedBlockPattern)?.[0];

  if (ownedBlock) {
    if (ownedBlock === snippet) return { action: 'unchanged', index };

    await writeFile(index, html.replace(ownedBlockPattern, snippet), 'utf8');
    return { action: 'updated', index };
  }

  if (/<meta\s+[^>]*property\s*=\s*['"]og:/i.test(html)) {
    throw new Error(
      `Open Graph metadata already exists in "${index}". Remove it before installing with ngx-seo-kit to avoid conflicting tags.`,
    );
  }

  const headEnd = /<\/head\s*>/i.exec(html);
  if (!headEnd || headEnd.index === undefined) {
    throw new Error(`Could not find a closing </head> tag in "${index}".`);
  }

  const beforeHeadEnd = html.slice(0, headEnd.index);
  const separator = beforeHeadEnd.endsWith(newline) ? '' : newline;
  const updatedHtml =
    beforeHeadEnd + separator + snippet + newline + html.slice(headEnd.index);
  await writeFile(index, updatedHtml, 'utf8');

  return { action: 'added', index };
}

function normalizeSocialMetadata(options: SocialMetadataOptions): SocialMetadataOptions {
  const title = normalizeText(options.title, 'title');
  const description = normalizeText(options.description, 'description');
  const url = normalizeHttpUrl(options.url, 'url');
  const image = normalizeHttpUrl(options.image, 'image');
  const siteName = options.siteName === undefined
    ? undefined
    : normalizeText(options.siteName, 'siteName');
  const locale = options.locale === undefined
    ? undefined
    : normalizeLocale(options.locale);

  return {
    title,
    description,
    url,
    image,
    ...(siteName ? { siteName } : {}),
    ...(locale ? { locale } : {}),
  };
}

function normalizeText(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`Open Graph ${name} cannot be empty.`);
  return normalized;
}

function normalizeHttpUrl(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error(`Open Graph ${name} must be an absolute URL.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Open Graph ${name} must use http or https.`);
  }
  return url.toString();
}

function normalizeLocale(value: string): string {
  const locale = value.trim();
  if (!/^[a-z]{2}_[A-Z]{2}$/.test(locale)) {
    throw new Error('Open Graph locale must use a value like en_US or tr_TR.');
  }
  return locale;
}
