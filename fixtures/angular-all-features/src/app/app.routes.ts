import type {
  CanActivateChildFn,
  CanActivateFn,
  CanDeactivateFn,
  CanLoadFn,
  CanMatchFn,
  RedirectFunction,
  ResolveFn,
  Route,
  Routes,
  UrlMatcher,
} from '@angular/router';
import { SHARED_ROUTES } from './shared.routes';

class HomePage {}
class AboutPage {}
class CatalogLayout {}
class CatalogIndexPage {}
class ProductPage {}
class AccountPage {}
class AccountSettingsPage {}
class NotFoundPage {}
class LocalePage {}
class HelpPanel {}
class GeneratedPage {}
class RouteScopedService {}

const canActivate: CanActivateFn = () => true;
const canActivateChild: CanActivateChildFn = () => true;
const canDeactivate: CanDeactivateFn<unknown> = () => true;
const canMatch: CanMatchFn = () => true;
const canLoad: CanLoadFn = () => true;
const productResolver: ResolveFn<unknown> = () => ({ id: 'example' });
const productTitle: ResolveFn<string> = () => 'Product';
const redirectByState: RedirectFunction = () => '/about';

const localeMatcher: UrlMatcher = (segments) => {
  const first = segments[0];
  return first && /^(en|tr)$/.test(first.path)
    ? { consumed: [first], posParams: { locale: first } }
    : null;
};

const ACCOUNT_PATH = 'account';
const SETTINGS_PATH = `${ACCOUNT_PATH}/settings`;

const ABOUT_ROUTE = {
  path: 'about',
  component: AboutPage,
  title: 'About',
  data: { seo: { sitemap: true, priority: 0.8 } },
} satisfies Route;

const CONDITIONAL_ROUTES: Routes = true
  ? [{ path: 'enabled', component: GeneratedPage }]
  : [{ path: 'disabled', component: GeneratedPage }];

const PAGE_NAMES = ['company', 'careers'] as const;
const GENERATED_ROUTES: Routes = PAGE_NAMES.map((path) => ({
  path,
  component: GeneratedPage,
}));

/**
 * A discovery fixture covering every property on Angular's stable `Route`
 * interface, plus common TypeScript composition patterns.
 */
export const APP_ROUTES = [
  // Empty path and eager component.
  { path: '', pathMatch: 'full', component: HomePage, title: 'Home' },

  // Referenced route object using `satisfies Route`.
  ABOUT_ROUTE,

  // Imported array spread.
  ...SHARED_ROUTES,

  // Componentless parent and empty-path index child.
  {
    path: 'catalog',
    children: [
      { path: '', component: CatalogIndexPage },
      {
        path: ':productId',
        component: ProductPage,
        title: productTitle,
        canActivate: [canActivate],
        canDeactivate: [canDeactivate],
        canMatch: [canMatch],
        data: { seo: { sitemap: true } },
        resolve: { product: productResolver },
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        providers: [RouteScopedService],
      },
    ],
  },

  // Eager layout component with guarded children.
  {
    path: ACCOUNT_PATH,
    component: CatalogLayout,
    canActivateChild: [canActivateChild],
    children: [
      { path: '', component: AccountPage },
      { path: 'settings', component: AccountSettingsPage },
    ],
  },

  // Statically evaluated template-literal path.
  { path: SETTINGS_PATH, component: AccountSettingsPage },

  // Lazy standalone component.
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile.page').then((module) => module.ProfilePage),
  },

  // Lazy route array with a named export.
  {
    path: 'admin',
    canLoad: [canLoad],
    loadChildren: () =>
      import('./admin/admin.routes').then((module) => module.ADMIN_ROUTES),
  },

  // Lazy route array with a default export.
  {
    path: 'store',
    loadChildren: () =>
      import('./store/store.routes').then((module) => module.default),
  },

  // Lazy NgModule whose routes are registered with RouterModule.forChild().
  {
    path: 'legacy',
    loadChildren: () =>
      import('./legacy/legacy.module').then((module) => module.LegacyModule),
  },

  // String and function redirects.
  { path: 'old-about', pathMatch: 'full', redirectTo: 'about' },
  { path: 'start', pathMatch: 'full', redirectTo: redirectByState },

  // Custom matcher without a `path`.
  { matcher: localeMatcher, component: LocalePage },

  // Named auxiliary outlet.
  { path: 'help', component: HelpPanel, outlet: 'sidebar' },

  // Conditional and runtime-generated array spreads.
  ...CONDITIONAL_ROUTES,
  ...GENERATED_ROUTES,

  // Wildcard must remain last.
  { path: '**', component: NotFoundPage },
] satisfies Routes;

