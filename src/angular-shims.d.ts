declare module '@angular/core' {
  export interface EnvironmentProviders {}
  export class InjectionToken<T> { constructor(description: string); }
  export const ENVIRONMENT_INITIALIZER: unknown;
  export function Injectable(options?: { providedIn?: string }): ClassDecorator;
  export function inject<T>(token: unknown): T;
  export function makeEnvironmentProviders(providers: unknown[]): EnvironmentProviders;
}

declare module '@angular/common' {
  export const DOCUMENT: unknown;
}

declare module '@angular/platform-browser' {
  export class Title { setTitle(title: string): void; }
  export class Meta {
    updateTag(tag: Record<string, string>, selector?: string): void;
    removeTag(selector: string): void;
  }
}

declare module '@angular/router' {
  export class Router {
    url: string;
    routerState: { root: unknown };
    events: { subscribe(listener: unknown): { unsubscribe(): void } };
  }
}

declare module 'tsx/cjs/api' {
  export function register(): () => void;
}

declare module 'tsx/esm/api' {
  export function register(): () => Promise<void>;
}
