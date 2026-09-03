# ngx-seo-kit

Angular uygulamalarında sayfa başlığı, meta etiketleri, canonical URL, Open Graph, Twitter Card ve yapılandırılmış verileri tek bir yerden yönetmek için geliştirilen SEO araç seti.

> [!IMPORTANT]
> Proje henüz geliştirme aşamasındadır ve kararlı bir sürümü yayımlanmamıştır. Aşağıdaki API, hedeflenen kullanım biçimini gösterir ve ilk sürüme kadar değişebilir.

## Özellikler

- Angular standalone uygulamalarıyla uyumlu sade provider API'si
- Route bazlı ve dinamik SEO yönetimi
- Sayfa başlığı ve meta description desteği
- Canonical URL yönetimi
- Open Graph ve Twitter Card etiketleri
- `robots` (`index`, `follow`, `noindex`, `nofollow`) kontrolü
- JSON-LD yapılandırılmış veri desteği
- Angular SSR ile uyumlu çalışma hedefi
- TypeScript ile tip güvenli yapılandırma

## Kurulum

Paket yayımlandıktan sonra npm ile kurulabilir:

```bash
npm install ngx-seo-kit
```

## Hızlı başlangıç

SEO sağlayıcısını uygulama yapılandırmasına ekleyin:

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNgxSeo } from 'ngx-seo-kit';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideNgxSeo({
      siteName: 'Örnek Site',
      siteUrl: 'https://example.com',
      titleTemplate: '%s | Örnek Site',
      defaultDescription: 'Örnek Site açıklaması',
      defaultImage: '/assets/og/default.jpg',
    }),
  ],
};
```

Bir bileşende sayfanın SEO bilgilerini güncelleyin:

```ts
import { Component, inject } from '@angular/core';
import { NgxSeoService } from 'ngx-seo-kit';

@Component({
  selector: 'app-about',
  standalone: true,
  template: '<h1>Hakkımızda</h1>',
})
export class AboutComponent {
  private readonly seo = inject(NgxSeoService);

  constructor() {
    this.seo.update({
      title: 'Hakkımızda',
      description: 'Ekibimizi ve çalışma biçimimizi keşfedin.',
      canonical: '/hakkimizda',
      image: '/assets/og/about.jpg',
    });
  }
}
```

Oluşturulması hedeflenen etiketler:

```html
<title>Hakkımızda | Örnek Site</title>
<meta name="description" content="Ekibimizi ve çalışma biçimimizi keşfedin.">
<link rel="canonical" href="https://example.com/hakkimizda">
<meta property="og:title" content="Hakkımızda | Örnek Site">
<meta property="og:image" content="https://example.com/assets/og/about.jpg">
```

## Route bazlı kullanım

Statik sayfalarda SEO verileri route üzerinde tanımlanabilir:

```ts
// app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
    data: {
      seo: {
        title: 'Ana Sayfa',
        description: 'Ürünlerimizi ve güncel içeriklerimizi keşfedin.',
        canonical: '/',
      },
    },
  },
  {
    path: 'iletisim',
    loadComponent: () =>
      import('./pages/contact/contact.component').then((m) => m.ContactComponent),
    data: {
      seo: {
        title: 'İletişim',
        description: 'Sorularınız için bizimle iletişime geçin.',
        canonical: '/iletisim',
      },
    },
  },
];
```

## Dinamik sayfalar

Ürün veya blog detayı gibi verisi sonradan yüklenen sayfalarda servis kullanılabilir:

```ts
this.productService.getBySlug(slug).subscribe((product) => {
  this.seo.update({
    title: product.name,
    description: product.summary,
    canonical: `/urunler/${product.slug}`,
    image: product.coverImage,
    type: 'product',
  });
});
```

## Robots ayarları

Arama motorlarının bir sayfayı indekslemesini veya bağlantılarını takip etmesini kontrol edin:

```ts
this.seo.update({
  title: 'Hesabım',
  robots: {
    index: false,
    follow: false,
  },
});
```

## JSON-LD

Schema.org uyumlu yapılandırılmış veri ekleyin:

```ts
this.seo.update({
  title: 'Angular SEO Rehberi',
  description: 'Angular uygulamaları için teknik SEO rehberi.',
  structuredData: {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Angular SEO Rehberi',
    author: {
      '@type': 'Person',
      name: 'Ada Yılmaz',
    },
  },
});
```

## Planlanan API

### `provideNgxSeo(config)`

Kitaplığın genel ayarlarını tanımlar.

```ts
interface NgxSeoConfig {
  siteName: string;
  siteUrl: string;
  titleTemplate?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultImage?: string;
  defaultLocale?: string;
}
```

### `NgxSeoService`

```ts
update(metadata: NgxSeoMetadata): void;
reset(): void;
```

`update`, yalnızca verilen alanları günceller. `reset`, aktif sayfa verilerini temizleyerek varsayılan yapılandırmayı yeniden uygular.

## SSR notu

SEO etiketlerinin arama motorları tarafından ilk HTML yanıtında görülebilmesi için uygulamanızı Angular SSR ile sunmanız önerilir. Yalnızca tarayıcıda yapılan güncellemeler, JavaScript çalıştırmayan botlar tarafından görülmeyebilir.

## Geliştirme

Kaynak kod eklendikten sonra önerilen geliştirme akışı:

```bash
npm install
npm test
npm run build
```

## Yol haritası

- [ ] Temel title ve meta tag servisi
- [ ] Route verilerinden otomatik SEO güncelleme
- [ ] Open Graph ve Twitter Card desteği
- [ ] Canonical ve robots yönetimi
- [ ] JSON-LD desteği
- [ ] Angular SSR testleri
- [ ] İlk npm sürümü

## Katkıda bulunma

Hata bildirimleri ve geliştirme önerileri için issue açabilirsiniz. Değişiklik göndermeden önce testlerin başarılı olduğundan ve yeni davranışların testlerle kapsandığından emin olun.

## Lisans

Bu proje için henüz bir lisans dosyası eklenmemiştir. Açık kaynak olarak yayımlamadan önce uygun bir lisans seçilmelidir.
