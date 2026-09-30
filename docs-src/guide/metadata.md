# Metadata and Angular runtime

Use `data.seo` for page-level metadata. Child routes override parent values;
missing fields use the global metadata from `seo.config.ts`.

```ts
export const routes: Routes = [
  {
    path: 'products',
    component: ProductsComponent,
    data: {
      seo: {
        title: 'Products',
        description: 'Browse our products',
        robots: ['index', 'follow'],
        twitterCard: 'summary_large_image',
      },
    },
  },
];
```

Register the provider once in `app.config.ts`:

```ts
import seoConfig from '../../seo.config';
import { provideNgxSeo } from 'ngx-seo-kit/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideNgxSeo(seoConfig),
  ],
};
```

The provider listens to Angular navigation and updates title, description,
canonical, robots, Open Graph, Twitter/X and JSON-LD tags. It is designed to
work with browser, SSR and prerender rendering.

For static global tags in `index.html`, use the CLI metadata command:

```bash
npx ngx-seo-kit metadata
```
