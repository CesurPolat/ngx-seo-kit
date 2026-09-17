import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { normalizeSiteUrl } from '../site-url.js';
import type {
  GenerateRobotsTxtOptions,
  RobotsTxtGroup,
  WriteRobotsTxtOptions,
  WriteRobotsTxtResult,
} from './types.js';

const DEFAULT_GROUP: RobotsTxtGroup = {
  userAgent: '*',
  allow: ['/'],
};

export function generateRobotsTxt(options: GenerateRobotsTxtOptions): string {
  const siteUrl = normalizeSiteUrl(options.siteUrl);
  const groups = options.groups ?? [DEFAULT_GROUP];
  const sitemapInputs = normalizeSitemapInputs(options.sitemap);
  const sections = groups.map(formatGroup);

  if (sitemapInputs.length > 0) {
    sections.push(
      sitemapInputs
        .map((sitemap) => `Sitemap: ${toAbsoluteSitemapUrl(siteUrl, sitemap)}`)
        .join('\n'),
    );
  }

  return `${sections.join('\n\n')}\n`;
}

export async function writeRobotsTxt(
  options: WriteRobotsTxtOptions,
): Promise<WriteRobotsTxtResult> {
  if (!options.output.trim()) {
    throw new Error('robots.txt output path cannot be empty.');
  }

  const output = resolve(options.output);
  const contents = generateRobotsTxt(options);

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, contents, 'utf8');

  return {
    output,
    sitemapCount: countSitemaps(contents),
  };
}

function formatGroup(group: RobotsTxtGroup): string {
  const userAgents = Array.isArray(group.userAgent)
    ? group.userAgent
    : [group.userAgent];

  if (userAgents.length === 0) {
    throw new Error('A robots.txt group must contain at least one user-agent.');
  }

  const lines = userAgents.map(
    (userAgent) => `User-agent: ${normalizeDirectiveValue(userAgent, 'user-agent')}`,
  );

  for (const path of group.allow ?? []) {
    lines.push(`Allow: ${normalizeDirectiveValue(path, 'allow path', true)}`);
  }

  for (const path of group.disallow ?? []) {
    lines.push(`Disallow: ${normalizeDirectiveValue(path, 'disallow path', true)}`);
  }

  if (group.crawlDelay !== undefined) {
    if (!Number.isFinite(group.crawlDelay) || group.crawlDelay < 0) {
      throw new Error('robots.txt crawlDelay must be a non-negative number.');
    }

    lines.push(`Crawl-delay: ${group.crawlDelay}`);
  }

  return lines.join('\n');
}

function normalizeSitemapInputs(
  sitemap: GenerateRobotsTxtOptions['sitemap'],
): string[] {
  if (sitemap === false) return [];

  const inputs = sitemap === undefined
    ? ['/sitemap.xml']
    : Array.isArray(sitemap)
      ? sitemap
      : [sitemap];

  return [...new Set(inputs.map((value) => normalizeDirectiveValue(value, 'sitemap')))];
}

function toAbsoluteSitemapUrl(siteUrl: string, sitemap: string): string {
  let url: URL;

  try {
    url = new URL(sitemap, `${siteUrl}/`);
  } catch {
    throw new Error(`Invalid robots.txt sitemap URL: "${sitemap}".`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('robots.txt sitemap URLs must use http or https.');
  }

  return url.toString();
}

function normalizeDirectiveValue(
  value: string,
  name: string,
  allowEmpty = false,
): string {
  const normalized = value.trim();

  if ((!allowEmpty && !normalized) || /[\r\n]/.test(value)) {
    throw new Error(`Invalid robots.txt ${name}.`);
  }

  return normalized;
}

function countSitemaps(contents: string): number {
  return contents.match(/^Sitemap:/gm)?.length ?? 0;
}
