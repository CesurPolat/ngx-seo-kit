import type { DiscoverableRoute } from './types.js';

/** Converts an in-memory Angular route tree into concrete URL paths. */
export function routesToPaths(routes: readonly DiscoverableRoute[]): string[] {
  const paths = new Set<string>();
  collect(routes, '', paths);
  return [...paths].sort((left, right) => {
    if (left === '/') return -1;
    if (right === '/') return 1;
    return left.localeCompare(right);
  });
}

function collect(
  routes: readonly DiscoverableRoute[],
  parent: string,
  output: Set<string>,
): void {
  for (const route of routes) {
    if (typeof route.path !== 'string') continue;
    const path = joinPath(parent, route.path);
    const dynamic = path.split('/').some((segment) => segment === '**' || segment.startsWith(':'));
    const page = Object.hasOwn(route, 'component') || Object.hasOwn(route, 'loadComponent');
    if (!dynamic && !Object.hasOwn(route, 'redirectTo') && page) output.add(path);
    if (Array.isArray(route.children)) collect(route.children, path, output);
  }
}

function joinPath(parent: string, child: string): string {
  const value = [parent, child].filter(Boolean).join('/').replaceAll(/\/+/g, '/');
  return value ? `/${value.replace(/^\/+/, '').replace(/\/+$/, '')}` : '/';
}
