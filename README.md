# ngx-seo-kit

Angular uygulamaları için build sırasında `sitemap.xml` üreten, bağımlılıksız ve tip güvenli SEO araç seti.

> Proje geliştirme aşamasındadır. İlk MVP, statik ve önceden bilinen sayfalardan XML sitemap üretimine odaklanır.

## Neler sunuyor?

- Geçerli XML sitemap çıktısı
- String veya detaylı nesne olarak route tanımlama
- `lastmod`, `changefreq` ve `priority` desteği
- Yinelenen URL’leri otomatik temizleme
- Route ve trailing slash normalizasyonu
- İstenmeyen route’ları hariç tutma
- XML karakterlerini güvenli biçimde encode etme
- CLI ve programatik API
- Sıfır runtime bağımlılığı

## Gereksinimler

- Node.js 20 veya üzeri

## Kurulum

Paket yayımlandığında:

```bash
npm install --save-dev ngx-seo-kit
```

Bu repository üzerinde geliştirme yapmak için:

```bash
npm install
npm test
```

## Hızlı başlangıç

İlk kurulumda etkileşimli menüyü açın:

```bash
npx ngx-seo-kit init
```

Menü; site adresini, sitemap çıktı yolunu, route listesini ve hariç tutulacak
route’ları sorar. Ardından proje kökünde `seo.config.mjs` dosyasını oluşturur ve
ilk sitemap’i üretir.

Config dosyası yoksa `npx ngx-seo-kit` komutu da etkileşimli terminalde kurulum
menüsünü otomatik açar. CI/build ortamlarında menü açılmaz; config dosyasının
önceden oluşturulmuş olması gerekir.

### Elle yapılandırma

İsterseniz proje kökünde `seo.config.mjs` dosyasını elle oluşturabilirsiniz:

```js
/** @type {import('ngx-seo-kit').NgxSeoConfig} */
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    output: 'dist/my-portfolio/browser/sitemap.xml',
    routes: ['/', '/about', '/projects', '/contact'],
    exclude: ['/404', '/admin'],
  },
};
```

Sitemap’i üretin:

```bash
npx ngx-seo-kit
```

CLI, tamamlandığında dosyanın konumunu ve URL sayısını gösterir:

```text
✓ Sitemap generated: /project/dist/my-portfolio/browser/sitemap.xml (4 URLs)
```

## Angular build entegrasyonu

Sitemap komutunu Angular build işleminden sonra çalıştırın:

```json
{
  "scripts": {
    "build": "ng build && ngx-seo-kit"
  }
}
```

`sitemap.output` değerinin Angular uygulamanızın deploy edilen klasörünü göstermesi gerekir. Yeni Angular SSR yapılarında bu klasör çoğunlukla `dist/<proje-adı>/browser` olur; yalnızca static build kullanan projelerde farklı olabilir.

Deploy sonrasında aşağıdaki adres doğrudan XML döndürmelidir:

```text
https://example.com/sitemap.xml
```

## Route metadata

Route’lara arama motorları için ek bilgiler eklenebilir:

```js
export default {
  siteUrl: 'https://example.com',
  sitemap: {
    routes: [
      {
        path: '/',
        changefreq: 'weekly',
        priority: 1,
      },
      {
        path: '/projects',
        lastmod: '2026-09-03',
        changefreq: 'monthly',
        priority: 0.8,
      },
    ],
  },
};
```

Desteklenen `changefreq` değerleri:

```text
always, hourly, daily, weekly, monthly, yearly, never
```

`priority`, `0` ile `1` arasında olmalıdır. `lastmod`, `YYYY-MM-DD` veya geçerli W3C datetime biçiminde verilmelidir.

## CLI seçenekleri

```text
ngx-seo-kit [generate] [options]
ngx-seo-kit init [options]

Commands:
  generate             Sitemap üretir (varsayılan)
  init                 Kurulum menüsünü açar ve config oluşturur

Options:
  -c, --config <path>  Config dosyası (varsayılan: seo.config.mjs)
  -o, --output <path>  Config içindeki output değerini geçersiz kılar
  -h, --help           Yardımı gösterir
```

Farklı bir config veya çıktı yolu kullanmak için:

```bash
npx ngx-seo-kit --config config/seo.production.mjs --output dist/browser/sitemap.xml
```

Config belirtilmediğinde CLI sırasıyla `seo.config.mjs`, `seo.config.js` ve `seo.config.cjs` dosyalarını arar.

Çalışan bir config örneği [seo.config.example.mjs](./seo.config.example.mjs) dosyasında bulunur.

## Programatik API

XML’i dosyaya yazmadan üretmek için:

```ts
import { generateSitemap } from 'ngx-seo-kit';

const xml = generateSitemap({
  siteUrl: 'https://example.com',
  routes: ['/', '/projects'],
});
```

Dosyaya yazmak için:

```ts
import { writeSitemap } from 'ngx-seo-kit';

const result = await writeSitemap({
  siteUrl: 'https://example.com',
  routes: ['/', '/projects'],
  output: 'dist/browser/sitemap.xml',
});

console.log(result.output, result.urlCount);
```

TypeScript config tanımlarken `defineSeoConfig` kullanılabilir:

```ts
import { defineSeoConfig } from 'ngx-seo-kit';

export default defineSeoConfig({
  siteUrl: 'https://example.com',
  sitemap: {
    routes: ['/', '/about'],
  },
});
```

CLI şu anda config dosyasını doğrudan Node.js ile yüklediği için çalıştırılabilir config’in `.mjs`, `.js` veya `.cjs` olması gerekir.

## Üretilen XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <changefreq>weekly</changefreq>
    <priority>1</priority>
  </url>
</urlset>
```

## Sınırlar

İlk sürüm route listesini config dosyasından alır. Angular Router dosyasını otomatik analiz etmez ve API’den dinamik blog/proje slug’ları çekmez. Bu özellikler sonraki sürümler için planlanmaktadır.

## Yol haritası

- [x] Config tabanlı XML sitemap üretimi
- [x] CLI ve programatik API
- [x] Route normalizasyonu ve doğrulama
- [ ] Angular route’larını otomatik keşfetme
- [ ] Dinamik route kaynağı
- [ ] Sitemap index ve 50.000 URL bölme desteği
- [ ] `robots.txt` üretimi ve sitemap bağlantısı

## Geliştirme

```bash
npm install
npm run build
npm test
```

## Lisans

[MIT](./LICENSE)
