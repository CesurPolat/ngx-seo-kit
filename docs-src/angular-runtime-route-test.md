# Reading Angular runtime routes in `ng test`

Angular AOT does not prevent a test from reading routes registered with the
router. Inject `Router` and use its `config` property. This is especially
useful when the route tree is assembled through `provideRouter`, providers, or
runtime configuration rather than being safe to import directly in Node.js.

Install the package in the Angular application, then add this service:

```ts
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { routesToPaths } from 'ngx-seo-kit';

@Injectable({ providedIn: 'root' })
export class RouteExportService {
  constructor(private readonly router: Router) {}

  sitemapPaths(): string[] {
    return routesToPaths(this.router.config);
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

    console.log('[ngx-seo-kit:routes]', JSON.stringify(paths));
    expect(paths).toContain('/');
    expect(paths).toContain('/admin/users');
  });
});
```

Run it with:

```bash
ng test --include='**/route-export.service.spec.ts' --watch=false
```

`discoverRoutes()` creates `src/app/route-export.service.ts` and
`src/app/route-export.service.spec.ts` automatically when either file is
missing, then runs the test from the Angular project root. It never overwrites
existing generated files.

`routesToPaths` follows eager `children` arrays, excludes redirects, wildcard
routes, and parameterised paths, and returns normalized URL paths. Lazy
`loadChildren` children are not loaded by this test; use the package's
build-time `discoverRoutes()` source scanner for those routes.
