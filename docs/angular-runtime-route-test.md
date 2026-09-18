# Reading Angular runtime routes in `ng test`

Angular AOT does not prevent a test from reading routes registered with the
router. Inject `Router` and use its `config` property. This is especially
useful when the route tree is assembled through `provideRouter`, providers, or
runtime configuration rather than being safe to import directly in Node.js.

Install the package in the Angular application, then add this service:

```ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { routesToPathsAsync } from 'ngx-seo-kit';

@Injectable({ providedIn: 'root' })
export class RouteExportService {
  constructor(private readonly router: Router) {}

  sitemapPaths(): Promise<string[]> {
    return routesToPathsAsync(this.router.config);
  }
}
```

Test it using the application's actual route provider:

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { RouteExportService } from './route-export.service';

describe('RouteExportService', () => {
  it('exports public URLs from the Angular router config', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(APP_ROUTES)],
    });

    const service = TestBed.inject(RouteExportService);
    const paths = await service.sitemapPaths();

    expect(paths).toContain('/');
    expect(paths).toContain('/admin/users');
  });
});
```

Run it with:

```bash
ng test --include='**/route-export.service.spec.ts'
```

The interactive `npx ngx-seo-kit` menu also contains **Run runtime route
export test**, which runs the same command from the Angular project root.

`routesToPathsAsync` follows lazy `loadChildren` functions that resolve to a
route array, excludes redirects, wildcard routes, and parameterised paths, and
returns normalized URL paths. A lazy-loaded NgModule does not expose its child
routes through `loadChildren` alone; for those routes, use the package's
build-time `discoverRoutes()` source scanner or load the module and inspect its
router configuration separately.
