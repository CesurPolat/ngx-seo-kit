import { inquireWizard } from '@cesur_polat/webquirer';
import { normalizeGoogleTagId } from '../analytics/google-tag.js';
import { fileExists, findConfig } from './config.js';
import { validateAbsoluteHttpUrl } from './feature-setup.js';
import { validateSiteUrl } from './setup.js';
import type { CliOptions, Command } from './options.js';
import type { PackageUpdate } from './package-manager.js';

type GuiAnswers = Record<string, unknown>;
type ExecuteGuiCommand = (command: Command, answers: GuiAnswers) => Promise<void>;

export async function runGuiFlow(
  options: CliOptions,
  packageUpdate: PackageUpdate | undefined,
  execute: ExecuteGuiCommand,
  requestedConfigPath?: string,
): Promise<void> {
  const configAvailable = requestedConfigPath
    ? await fileExists(requestedConfigPath)
    : Boolean(await findConfig(process.cwd()));
  const result = await inquireWizard({
    title: 'ngx-seo-kit',
    questions: [mainMenuQuestion(packageUpdate)],
    next: async ({ step, allAnswers }) => {
      if (step === 0) {
        const action = String(allAnswers.action) as Command | 'exit';
        if (action === 'exit') return { done: true, result: allAnswers };
        const questions = questionsFor(action, options, !configAvailable && (action === 'generate' || action === 'build'));
        return questions.length ? { title: titleFor(action), questions } : { done: true, result: allAnswers };
      }
      return { done: true, result: allAnswers };
    },
  }) as GuiAnswers;

  const action = result.action as Command | 'exit';
  if (action === 'exit') return;
  await execute(action, result);
}

function mainMenuQuestion(packageUpdate: PackageUpdate | undefined) {
  const choices = [
    { name: 'Generate SEO files', value: 'generate', description: 'Create sitemap.xml and robots.txt.' },
    { name: 'Build and validate SEO', value: 'build', description: 'Validate SEO output and optionally run Angular build.' },
    { name: 'Create SEO configuration', value: 'init', description: 'Create seo.config.ts through a guided setup.' },
    { name: 'Set up Google Analytics', value: 'analytics', description: 'Install a Google tag in the Angular app.' },
    { name: 'Set up Open Graph & Schema', value: 'metadata', description: 'Install global social and structured metadata.' },
    { name: 'Check Angular project status', value: 'status', description: 'Inspect Angular SSR and prerender configuration.' },
    ...(packageUpdate ? [{ name: 'Update ngx-seo-kit to ' + packageUpdate.latestVersion, value: 'update', description: 'Install the latest published version.' }] : []),
    { name: 'Exit', value: 'exit', description: 'Close ngx-seo-kit.' },
  ] as const;
  return { type: 'select' as const, presentation: 'buttons' as const, name: 'action', message: 'What would you like to do?', choices, required: true };
}

function questionsFor(action: Command, options: CliOptions, needsConfig = false) {
  if (action === 'init' || needsConfig) {
    return [
      { name: 'siteUrl', message: 'Site URL', default: 'https://example.com', required: true, validate: validateSiteUrl },
      { name: 'output', message: 'Sitemap output path', default: options.output ?? 'public/sitemap.xml', required: true, validate: nonEmpty },
      { name: 'exclude', message: 'Excluded routes (comma separated)' },
      { type: 'confirm' as const, name: 'create', message: 'Create configuration without routes?', default: true },
    ];
  }
  if (action === 'analytics') {
    return [
      { name: 'tagId', message: 'Google Analytics measurement ID', required: true, validate: (value: string) => { try { normalizeGoogleTagId(value); return true; } catch (error) { return error instanceof Error ? error.message : 'Enter a valid measurement ID.'; } } },
      { name: 'index', message: 'Angular index file (optional)', default: options.index ?? '' },
    ];
  }
  if (action === 'metadata') {
    return [
      { name: 'url', message: 'Canonical site URL', default: 'https://example.com', required: true, validate: validateAbsoluteHttpUrl },
      { name: 'title', message: 'Open Graph title', required: true, validate: nonEmpty },
      { name: 'description', message: 'Open Graph description', required: true, validate: nonEmpty },
      { name: 'image', message: 'Social image URL', default: 'https://example.com/og-image.png', required: true, validate: validateAbsoluteHttpUrl },
      { name: 'siteName', message: 'Site name', default: '' },
      { name: 'locale', message: 'Open Graph locale', default: 'en_US', validate: (value: string) => /^[a-z]{2}_[A-Z]{2}$/.test(value.trim()) || 'Use a locale like en_US or tr_TR.' },
      { name: 'canonical', message: 'Page canonical URL (optional)', default: '', validate: optionalUrl },
      { type: 'select' as const, name: 'twitterCard', message: 'Twitter/X card type', choices: ['summary', 'summary_large_image', 'app', 'player'], default: 'summary_large_image' },
      { name: 'robots', message: 'Robots directives (optional)', default: '' },
      { type: 'input' as const, name: 'jsonLd', message: 'Additional JSON-LD JSON (optional)', default: '' },
      { name: 'index', message: 'Angular index file (optional)', default: options.index ?? '' },
    ];
  }
  return [];
}

function titleFor(action: Command): string {
  return ({ init: 'Create SEO configuration', analytics: 'Set up Google Analytics', metadata: 'Set up Open Graph & Schema' } as Record<string, string>)[action] ?? 'ngx-seo-kit';
}

function nonEmpty(value: string): true | string {
  return value.trim().length > 0 || 'This value cannot be empty.';
}

function optionalUrl(value: string): true | string {
  return !value.trim() || validateAbsoluteHttpUrl(value);
}
