import type { Route, Routes } from '@angular/router';

class ContactPage {}
class LegalPage {}
class PreviewPage {}

const LEGAL_ROUTE: Route = {
  path: 'legal',
  component: LegalPage,
};

const BASE_PREVIEW_ROUTE = {
  component: PreviewPage,
  data: { seo: { sitemap: false } },
} satisfies Partial<Route>;

export const SHARED_ROUTES: Routes = [
  { path: 'contact', component: ContactPage },
  LEGAL_ROUTE,
  { ...BASE_PREVIEW_ROUTE, path: 'preview' },
  { ['path']: 'computed-property', component: ContactPage },
];

