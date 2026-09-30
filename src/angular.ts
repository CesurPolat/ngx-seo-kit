import { resolveSeoMetadata } from './metadata/resolve.js';
import type { ResolvedSeoMetadata, SeoMetadata, SeoRouteData } from './metadata/types.js';
import { DOCUMENT } from '@angular/common';
import { ENVIRONMENT_INITIALIZER, EnvironmentProviders, Injectable, InjectionToken, inject, makeEnvironmentProviders } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import type { NgxSeoConfig } from './types.js';

export interface SeoTitleAdapter { setTitle(title: string): void; }
export interface SeoMetaAdapter {
  updateTag(tag: { name?: string; property?: string; content: string; [key: string]: string | undefined }, selector?: string): void;
  removeTag(selector: string): void;
}
export interface SeoDocumentAdapter { querySelector(selector: string): { remove(): void } | null; head: { appendChild(node: unknown): void }; createElement(name: string): { type?: string; textContent?: string; setAttribute(name: string, value: string): void }; }
export interface SeoRuntimeDependencies { title: SeoTitleAdapter; meta: SeoMetaAdapter; document: SeoDocumentAdapter; }
export interface SeoActivatedRouteSnapshot { data: Record<string, unknown>; firstChild?: SeoActivatedRouteSnapshot | null; }
export interface SeoRouterAdapter {
  url: string;
  routerState: { root: SeoActivatedRouteSnapshot };
  events: { subscribe(listener: (event: { urlAfterRedirects?: string; type?: string }) => void): { unsubscribe(): void } };
}

export interface NgxSeoRuntimeConfig {
  siteUrl: string;
  metadata: SeoMetadata;
}

export type NgxSeoProviderConfig = NgxSeoRuntimeConfig | Pick<NgxSeoConfig, 'siteUrl' | 'metadata'>;

export const NGX_SEO_CONFIG = new InjectionToken<NgxSeoRuntimeConfig>('NGX_SEO_CONFIG');

export class SeoMetadataRuntime {
  constructor(
    private readonly dependencies: SeoRuntimeDependencies,
    private readonly global: SeoMetadata,
    private readonly siteUrl: string,
  ) {}

  update(routeData: readonly SeoRouteData[], url: string): ResolvedSeoMetadata {
    const metadata = resolveSeoMetadata(this.global, routeData, url, this.siteUrl);
    this.dependencies.title.setTitle(metadata.title);
    this.updateMeta('description', metadata.description);
    this.updateLink('canonical', metadata.canonical);
    this.updateMeta('robots', metadata.robots);
    this.updateProperty('og:title', metadata.title);
    this.updateProperty('og:description', metadata.description);
    this.updateProperty('og:url', metadata.canonical);
    this.updateProperty('og:image', metadata.image);
    this.updateProperty('og:type', metadata.ogType ?? 'website');
    this.updateProperty('og:site_name', metadata.siteName);
    this.updateProperty('og:locale', metadata.locale);
    this.updateMeta('twitter:card', metadata.twitterCard ?? (metadata.image ? 'summary_large_image' : 'summary'));
    this.updateMeta('twitter:title', metadata.title);
    this.updateMeta('twitter:description', metadata.description);
    this.updateMeta('twitter:image', metadata.image);
    this.updateJsonLd(metadata.jsonLd);
    return metadata;
  }

  private updateMeta(name: string, content: string | undefined): void {
    if (content) this.dependencies.meta.updateTag({ name, content }, `meta[name="${name}"]`);
    else this.dependencies.meta.removeTag(`meta[name="${name}"]`);
  }

  private updateProperty(property: string, content: string | undefined): void {
    if (content) this.dependencies.meta.updateTag({ property, content }, `meta[property="${property}"]`);
    else this.dependencies.meta.removeTag(`meta[property="${property}"]`);
  }

  private updateLink(rel: string, href: string): void {
    const existing = this.dependencies.document.querySelector(`link[rel="${rel}"]`);
    if (existing) existing.remove();
    const link = this.dependencies.document.createElement('link');
    link.setAttribute('rel', rel); link.setAttribute('href', href);
    this.dependencies.document.head.appendChild(link);
  }

  private updateJsonLd(value: SeoMetadata['jsonLd']): void {
    const current = this.dependencies.document.querySelector('script[data-ngx-seo-kit-json-ld]');
    if (current) current.remove();
    if (!value) return;
    const script = this.dependencies.document.createElement('script');
    script.type = 'application/ld+json'; script.setAttribute('data-ngx-seo-kit-json-ld', 'true');
    script.textContent = JSON.stringify(value);
    this.dependencies.document.head.appendChild(script);
  }
}

/** Connects the runtime metadata updater to an Angular Router-like instance. */
export function connectSeoMetadata(
  router: SeoRouterAdapter,
  runtime: SeoMetadataRuntime,
): { unsubscribe(): void } {
  const update = (url: string): void => {
    const routeData: SeoRouteData[] = [];
    let route: SeoActivatedRouteSnapshot | null | undefined = router.routerState.root;
    while (route) {
      const seo = route.data.seo;
      if (seo && typeof seo === 'object') routeData.push(seo as SeoRouteData);
      route = route.firstChild;
    }
    runtime.update(routeData, url);
  };
  update(router.url);
  return router.events.subscribe((event) => {
    if (event.urlAfterRedirects !== undefined || event.type === 'NavigationEnd') {
      update(event.urlAfterRedirects ?? router.url);
    }
  });
}

@Injectable()
export class NgxSeoService {
  private readonly subscription: { unsubscribe(): void };

  constructor() {
    const router = inject(Router) as unknown as SeoRouterAdapter;
    const config = inject<NgxSeoRuntimeConfig>(NGX_SEO_CONFIG);
    const runtime = new SeoMetadataRuntime(
      {
        title: inject(Title),
        meta: inject(Meta),
        document: inject(DOCUMENT) as unknown as SeoDocumentAdapter,
      },
      config.metadata,
      config.siteUrl,
    );
    this.subscription = connectSeoMetadata(router, runtime);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}

export function provideNgxSeo(config: NgxSeoProviderConfig): EnvironmentProviders {
  const runtimeConfig: NgxSeoRuntimeConfig = {
    siteUrl: config.siteUrl,
    metadata: config.metadata ?? (() => { throw new Error('ngx-seo-kit requires metadata in seo.config.ts before provideNgxSeo().'); })(),
  };
  return makeEnvironmentProviders([
    { provide: NGX_SEO_CONFIG, useValue: runtimeConfig },
    NgxSeoService,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => { inject(NgxSeoService); },
    },
  ]);
}
