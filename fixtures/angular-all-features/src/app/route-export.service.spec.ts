import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { APP_ROUTES } from './app.routes';
import { RouteExportService } from './route-export.service';

describe('RouteExportService', () => {
  it('reads the routes registered with Angular Router, including lazy route arrays', async () => {
    TestBed.configureTestingModule({
      providers: [provideRouter(APP_ROUTES)],
    });

    const service = TestBed.inject(RouteExportService);
    const paths = await service.sitemapPaths();

    expect(paths).toContain('/');
    expect(paths).toContain('/about');
    expect(paths).toContain('/admin/users');
    expect(paths).toContain('/store/cart');
    expect(paths).not.toContain('/catalog/:productId');
  });
});
