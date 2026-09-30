# API reference

## `runSeoBuild(options)`

Runs the SEO generation and validation pipeline programmatically.

```ts
import { runSeoBuild } from 'ngx-seo-kit';

const report = await runSeoBuild({
  config: 'seo.config.ts',
  strict: true,
});

if (!report.passed) process.exitCode = 1;
```

The report includes `passed`, `errors`, `warnings`, `generatedFiles` and
`routeCount`.

## JSON-LD helpers

```ts
import { createOrganizationJsonLd } from 'ngx-seo-kit';

const organization = createOrganizationJsonLd({
  name: 'Example Inc.',
  url: 'https://example.com',
});
```

Available typed helpers are `createWebSiteJsonLd`,
`createOrganizationJsonLd` and `createBreadcrumbListJsonLd`.
