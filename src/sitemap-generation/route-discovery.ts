/**
 * Angular route discovery strategy
 *
 * Route definitions are analyzed statically. Application route files and
 * Angular components must never be executed during discovery.
 *
 * Supported:
 * - Inline and referenced route arrays
 * - `Routes` annotations, `as Routes`, and `satisfies Routes`
 * - Local variables and imported/exported route arrays
 * - Array spreads and statically resolvable route objects
 * - Nested `children`
 * - `loadChildren` with relative dynamic imports
 * - Routes using `component` or `loadComponent`
 * - Redirect, wildcard, and parameterized route classification
 * - Statically resolvable string constants and template literals
 *
 * Excluded from sitemap paths:
 * - Redirects
 * - Wildcards
 * - Parameterized routes without a dynamic route source
 * - Componentless parent routes that do not resolve to a page
 *
 * Reported as unresolved:
 * - Custom matchers
 * - Routes returned by arbitrary function calls
 * - Runtime-generated paths
 * - `map`, `filter`, or other runtime array transformations
 * - Conditional expressions whose value cannot be determined statically
 *
 * Core rule:
 * Resolve a route only when its value can be determined without executing
 * application code. Never silently discard an unsupported route; return a
 * diagnostic containing its source location and the reason it was skipped.
 */

/*
 * Angular route definition possibilities
 * ======================================
 *
 * 1. Inline routes
 *
 * provideRouter([
 *   { path: '', component: HomeComponent },
 *   { path: 'about', component: AboutComponent },
 * ]);
 *
 * 2. Routes stored in a variable
 *
 * export const routes: Routes = [
 *   { path: '', component: HomeComponent },
 * ];
 *
 * provideRouter(routes);
 * RouterModule.forRoot(routes);
 *
 * 3. Type assertion and `satisfies`
 *
 * export const routes = [
 *   { path: 'about', component: AboutComponent },
 * ] as Routes;
 *
 * export const appRoutes = [
 *   { path: 'contact', component: ContactComponent },
 * ] satisfies Routes;
 *
 * 4. Imported and re-exported routes
 *
 * import { publicRoutes } from './public.routes';
 * export { accountRoutes } from './account.routes';
 *
 * export const routes: Routes = [
 *   ...publicRoutes,
 * ];
 *
 * 5. Route objects stored in variables
 *
 * const aboutRoute: Route = {
 *   path: 'about',
 *   component: AboutComponent,
 * };
 *
 * export const routes: Routes = [aboutRoute];
 *
 * 6. Nested child routes
 *
 * export const routes: Routes = [
 *   {
 *     path: 'account',
 *     component: AccountLayoutComponent,
 *     children: [
 *       { path: '', component: AccountComponent },
 *       { path: 'settings', component: SettingsComponent },
 *     ],
 *   },
 * ];
 *
 * 7. Componentless parent routes
 *
 * export const routes: Routes = [
 *   {
 *     path: 'shop',
 *     children: [
 *       { path: '', component: ShopComponent },
 *       { path: 'cart', component: CartComponent },
 *     ],
 *   },
 * ];
 *
 * 8. Lazy route arrays with a named export
 *
 * export const routes: Routes = [
 *   {
 *     path: 'admin',
 *     loadChildren: () =>
 *       import('./admin/admin.routes').then((module) => module.ADMIN_ROUTES),
 *   },
 * ];
 *
 * 9. Lazy route arrays with a default export
 *
 * export const routes: Routes = [
 *   {
 *     path: 'store',
 *     loadChildren: () => import('./store/store.routes'),
 *   },
 * ];
 *
 * 10. Lazy NgModule
 *
 * export const routes: Routes = [
 *   {
 *     path: 'legacy',
 *     loadChildren: () =>
 *       import('./legacy/legacy.module').then((module) => module.LegacyModule),
 *   },
 * ];
 *
 * 11. Lazy standalone component
 *
 * export const routes: Routes = [
 *   {
 *     path: 'profile',
 *     loadComponent: () =>
 *       import('./profile.component').then((module) => module.ProfileComponent),
 *   },
 * ];
 *
 * 12. Redirect routes
 *
 * export const routes: Routes = [
 *   { path: 'old', redirectTo: 'new', pathMatch: 'full' },
 * ];
 *
 * 13. Wildcard routes
 *
 * export const routes: Routes = [
 *   { path: '**', component: NotFoundComponent },
 * ];
 *
 * 14. Parameterized routes
 *
 * export const routes: Routes = [
 *   { path: 'blog/:slug', component: BlogPostComponent },
 *   { path: 'users/:userId/orders/:orderId', component: OrderComponent },
 * ];
 *
 * 15. Custom matcher routes
 *
 * export const routes: Routes = [
 *   { matcher: localeMatcher, component: LocalizedPageComponent },
 * ];
 *
 * 16. Statically resolvable path constants
 *
 * const ACCOUNT_PATH = 'account';
 * const SETTINGS_PATH = `${ACCOUNT_PATH}/settings`;
 *
 * export const routes: Routes = [
 *   { path: ACCOUNT_PATH, component: AccountComponent },
 *   { path: SETTINGS_PATH, component: SettingsComponent },
 * ];
 *
 * 17. Object and array spreads
 *
 * const baseRoute = { path: 'help' };
 * const publicRoutes: Routes = [
 *   { ...baseRoute, component: HelpComponent },
 * ];
 *
 * export const routes: Routes = [
 *   ...publicRoutes,
 *   { path: 'terms', component: TermsComponent },
 * ];
 *
 * 18. Conditional routes
 *
 * export const routes: Routes = [
 *   ...(environment.production ? productionRoutes : developmentRoutes),
 *   {
 *     path: environment.production ? 'dashboard' : 'debug',
 *     component: DashboardComponent,
 *   },
 * ];
 *
 * 19. Routes created by a factory function
 *
 * function createRoutes(): Routes {
 *   return [{ path: 'generated', component: GeneratedComponent }];
 * }
 *
 * export const routes = createRoutes();
 *
 * 20. Routes created with runtime array operations
 *
 * export const routes: Routes = pages.map((page) => ({
 *   path: page.slug,
 *   component: page.component,
 * }));
 *
 * 21. Route metadata controlling sitemap inclusion
 *
 * export const routes: Routes = [
 *   {
 *     path: 'private',
 *     component: PrivateComponent,
 *     data: { seo: { sitemap: false } },
 *   },
 * ];
 *
 * 22. Routes using `forChild`
 *
 * const featureRoutes: Routes = [
 *   { path: '', component: FeatureComponent },
 * ];
 *
 * @NgModule({
 *   imports: [RouterModule.forChild(featureRoutes)],
 * })
 * export class FeatureRoutingModule {}
 */
