export interface DiscoverableRoute {
  path?: string;
  redirectTo?: unknown;
  component?: unknown;
  loadComponent?: unknown;
  children?: readonly DiscoverableRoute[];
}
