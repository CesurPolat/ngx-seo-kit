import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { routesToPathsAsync } from 'ngx-seo-kit';

/**
 * Reads the Router's runtime configuration.
 *
 * This intentionally reads `Router.config` rather than importing APP_ROUTES:
 * it exercises the same route tree that Angular receives through provideRouter.
 */
@Injectable({ providedIn: 'root' })
export class RouteExportService {
  constructor(private readonly router: Router) {}

  async sitemapPaths(): Promise<string[]> {
    return routesToPathsAsync(this.router.config);
  }
}
