import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const GOOGLE_TAG_START = '<!-- ngx-seo-kit:google-tag:start -->';
const GOOGLE_TAG_END = '<!-- ngx-seo-kit:google-tag:end -->';

export interface InstallGoogleTagOptions {
  tagId: string;
  index?: string;
}

export interface InstallGoogleTagResult {
  action: 'added' | 'updated' | 'unchanged';
  index: string;
  tagId: string;
}

export function normalizeGoogleTagId(value: string): string {
  const tagId = value.trim().toUpperCase();

  if (!/^G-[A-Z0-9]+$/.test(tagId)) {
    throw new Error(
      'Invalid Google Analytics measurement ID. Expected a value like G-XXXXXXXXXX.',
    );
  }

  return tagId;
}

export function generateGoogleTagSnippet(tagIdInput: string, newline = '\n'): string {
  const tagId = normalizeGoogleTagId(tagIdInput);

  return [
    GOOGLE_TAG_START,
    '<!-- Google tag (gtag.js) -->',
    `<script async src="https://www.googletagmanager.com/gtag/js?id=${tagId}"></script>`,
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    `  gtag('config', '${tagId}');`,
    '</script>',
    GOOGLE_TAG_END,
  ].join(newline);
}

export async function installGoogleTag(
  options: InstallGoogleTagOptions,
): Promise<InstallGoogleTagResult> {
  const tagId = normalizeGoogleTagId(options.tagId);
  const index = resolve(options.index ?? 'src/index.html');
  let html: string;

  try {
    html = await readFile(index, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      throw new Error(
        `Angular index file not found at "${index}". Pass its path with --index.`,
      );
    }
    throw error;
  }

  const newline = html.includes('\r\n') ? '\r\n' : '\n';
  const snippet = generateGoogleTagSnippet(tagId, newline);
  const ownedBlockPattern = new RegExp(
    `${escapeRegExp(GOOGLE_TAG_START)}[\\s\\S]*?${escapeRegExp(GOOGLE_TAG_END)}`,
  );
  const ownedBlock = html.match(ownedBlockPattern)?.[0];

  if (ownedBlock) {
    if (ownedBlock === snippet) {
      return { action: 'unchanged', index, tagId };
    }

    await writeFile(index, html.replace(ownedBlockPattern, snippet), 'utf8');
    return { action: 'updated', index, tagId };
  }

  if (
    /googletagmanager\.com\/gtag\/js\?id=/i.test(html) ||
    /gtag\s*\(\s*['"]config['"]\s*,/i.test(html)
  ) {
    throw new Error(
      `A Google tag already exists in "${index}". Remove it before installing with ngx-seo-kit to avoid duplicate analytics events.`,
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

  return { action: 'added', index, tagId };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
