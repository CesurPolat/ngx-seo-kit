import input from '@inquirer/input';
import { installGoogleTag, normalizeGoogleTagId } from '../analytics/google-tag.js';
import { installSocialMetadata } from '../metadata/social-metadata.js';
import type { TypedJsonLd } from '../metadata/types.js';
import type { CliOptions } from './options.js';
import { isInteractiveTerminal, printCompletion } from './terminal.js';

export async function runAnalyticsSetup(options: CliOptions): Promise<void> {
  let tagId = options.tagId;
  if (!tagId) {
    if (!isInteractiveTerminal()) {
      throw new Error('Google Analytics setup requires --tag-id in CI and non-interactive terminals.');
    }
    tagId = await input({
      message: 'Google Analytics measurement ID',
      validate: (value) => {
        try {
          normalizeGoogleTagId(value);
          return true;
        } catch (error) {
          return error instanceof Error ? error.message : 'Enter a valid measurement ID.';
        }
      },
    });
  }

  const result = await installGoogleTag({
    tagId,
    ...(options.index ? { index: options.index } : {}),
  });
  const labels = { added: 'installed', updated: 'updated', unchanged: 'already configured' } as const;
  printCompletion(`Google Analytics ${labels[result.action]}: ${result.tagId}`, [`Index: ${result.index}`]);
}

export async function runMetadataSetup(options: CliOptions): Promise<void> {
  const interactive = isInteractiveTerminal();
  if (!interactive && (!options.title || !options.description || !options.url || !options.image)) {
    throw new Error('Open Graph setup requires --title, --description, --url, and --image in CI and non-interactive terminals.');
  }

  const url = options.url ?? await input({
    message: 'Canonical site URL',
    default: 'https://example.com',
    validate: validateAbsoluteHttpUrl,
  });
  const title = options.title ?? await input({ message: 'Open Graph title', validate: validateRequiredText });
  const description = options.description ?? await input({ message: 'Open Graph description', validate: validateRequiredText });
  const image = options.image ?? await input({
    message: 'Social image URL',
    default: new URL('/og-image.png', url).toString(),
    validate: validateAbsoluteHttpUrl,
  });
  const siteName = options.siteName ?? (interactive
    ? await input({ message: 'Site name', default: title, validate: validateRequiredText })
    : title);
  const locale = options.locale ?? (interactive
    ? await input({
        message: 'Open Graph locale',
        default: 'en_US',
        validate: (value) => /^[a-z]{2}_[A-Z]{2}$/.test(value.trim()) || 'Use a locale like en_US or tr_TR.',
      })
    : 'en_US');

  const result = await installSocialMetadata({
    title,
    description,
    url,
    image,
    siteName,
    locale,
    ...(options.canonical ? { canonical: options.canonical } : {}),
    ...(options.twitterCard ? { twitterCard: options.twitterCard as 'summary' | 'summary_large_image' | 'app' | 'player' } : {}),
    ...(options.robots ? { robots: options.robots } : {}),
    ...(options.jsonLd ? { jsonLd: parseJsonLd(options.jsonLd) } : {}),
    ...(options.index ? { index: options.index } : {}),
  });
  const labels = { added: 'installed', updated: 'updated', unchanged: 'already configured' } as const;
  printCompletion(`Open Graph & Schema ${labels[result.action]}`, [`Index: ${result.index}`]);
}

function parseJsonLd(value: string): TypedJsonLd | readonly TypedJsonLd[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object') throw new Error('must be an object or array');
    return parsed as TypedJsonLd | readonly TypedJsonLd[];
  } catch (error) {
    throw new Error(`--json-ld must contain valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function validateRequiredText(value: string): true | string {
  return value.trim().length > 0 || 'This value cannot be empty.';
}

export function validateAbsoluteHttpUrl(value: string): true | string {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:'
      ? true
      : 'URL must use http or https.';
  } catch {
    return 'Enter a valid absolute URL.';
  }
}

export async function runAnalyticsSetupFromAnswers(options: CliOptions, answers: Record<string, unknown>): Promise<void> {
  const tagId = readAnswer(answers, 'tagId');
  const index = readAnswer(answers, 'index', false);
  const result = await installGoogleTag({ tagId, ...(index ? { index } : options.index ? { index: options.index } : {}) });
  const labels = { added: 'installed', updated: 'updated', unchanged: 'already configured' } as const;
  printCompletion(`Google Analytics ${labels[result.action]}: ${result.tagId}`, [`Index: ${result.index}`]);
}

export async function runMetadataSetupFromAnswers(options: CliOptions, answers: Record<string, unknown>): Promise<void> {
  const url = readAnswer(answers, 'url');
  const title = readAnswer(answers, 'title');
  const description = readAnswer(answers, 'description');
  const image = readAnswer(answers, 'image', false) || new URL('/og-image.png', url).toString();
  const siteName = readAnswer(answers, 'siteName', false) || title;
  const locale = readAnswer(answers, 'locale', false) || 'en_US';
  const canonical = readAnswer(answers, 'canonical', false);
  const twitterCard = readAnswer(answers, 'twitterCard', false);
  const robots = readAnswer(answers, 'robots', false);
  const jsonLd = readAnswer(answers, 'jsonLd', false);
  const index = readAnswer(answers, 'index', false);
  const result = await installSocialMetadata({
    title, description, url, image, siteName, locale,
    ...(canonical ? { canonical } : {}),
    ...(twitterCard ? { twitterCard: twitterCard as 'summary' | 'summary_large_image' | 'app' | 'player' } : {}),
    ...(robots ? { robots } : {}),
    ...(jsonLd ? { jsonLd: parseJsonLd(jsonLd) } : {}),
    ...(index ? { index } : options.index ? { index: options.index } : {}),
  });
  const labels = { added: 'installed', updated: 'updated', unchanged: 'already configured' } as const;
  printCompletion(`Open Graph & Schema ${labels[result.action]}`, [`Index: ${result.index}`]);
}

function readAnswer(answers: Record<string, unknown>, name: string, required = true): string {
  const value = answers[name];
  if (typeof value === 'string' && (!required || value.trim())) return value.trim();
  if (!required) return '';
  throw new Error(`Missing GUI answer: ${name}`);
}
