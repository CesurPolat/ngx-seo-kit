# Roadmap

This roadmap is based on the current `ngx-seo-kit` architecture and existing
CLI/API surface. Dates are target delivery dates, not release guarantees; the
scope may be adjusted as implementation and compatibility testing progress.

## Available today

- Sitemap XML generation with route metadata, exclusions, normalization and an
  optional browser stylesheet.
- `robots.txt` generation with user-agent groups, crawl delays and one or more
  sitemap references.
- Angular route discovery from runtime route-export tests and in-memory route
  trees.
- Open Graph and basic Schema.org metadata installation with duplicate-safety.
- Google tag installation with duplicate detection.
- Angular, SSR and prerender project status detection.
- Interactive setup, config validation and build-time CLI generation.

## Delivery plan

| Target date | Priority | Improvement | Scope | Status |
| --- | --- | --- | --- | --- |
| 15 October 2026 | P0 | Config validation and diagnostics | Add actionable warnings for missing `siteUrl`, empty routes, invalid output paths, duplicate routes and production-incompatible URLs. Improve CLI error context and exit codes. | Planned |
| 30 October 2026 | P0 | `check` command for CI | Add a non-writing validation command with machine-readable output, strict mode and checks for sitemap/robots configuration. | Planned |
| 15 November 2026 | P0 | Page metadata model | Introduce typed page-level metadata for title, description, canonical URL, robots directives and social image values, while preserving the current global metadata API. | Planned |
| 30 November 2026 | P1 | Canonical and Twitter metadata | Generate canonical links, Twitter/X card tags and complete Open Graph fields with safe escaping and duplicate-aware installation. | Planned |
| 15 December 2026 | P1 | Structured data expansion | Support typed JSON-LD blocks for common Angular sites, including WebSite, Organization, BreadcrumbList, Article and Product, with schema validation errors that point to the source config. | Planned |
| 15 January 2027 | P1 | Multilingual SEO | Add `hreflang` alternate links, locale validation and language-aware route metadata for sites with multiple URL variants. | Planned |
| 31 January 2027 | P0 | Sitemap index and large-site support | Split large sitemaps, generate sitemap indexes and preserve deterministic ordering. Add safeguards for sitemap protocol limits and duplicate locations. | Planned |
| 15 February 2027 | P1 | Specialized sitemap extensions | Add opt-in image sitemap fields first, followed by news and video extension support where the route model can provide valid data. | Planned |
| 28 February 2027 | P0 | Angular build integration | Provide a documented Angular builder or supported build hook so SEO files are generated consistently for `ng build`, SSR and prerender workflows. | Planned |
| 15 March 2027 | P1 | Route discovery improvements | Support lazy-loaded route edge cases, configurable route filters, parameter expansion hooks and clearer diagnostics when route-export tests fail. | Planned |
| 31 March 2027 | P1 | SEO audit report | Add a report command that checks generated files, canonical/metadata completeness, indexability risks, broken route inputs and SSR/prerender readiness. | Planned |
| 15 April 2027 | P2 | Configuration presets | Add reusable presets for common Angular setups, monorepos and static deployments, with explicit override rules and config migration guidance. | Planned |
| 30 April 2027 | P2 | Compatibility and release hardening | Test supported Angular/Node combinations, add snapshot coverage for generated artifacts, document breaking-change policy and publish a stable `1.0.0` readiness checklist. | Planned |

## Priorities

- **P0** - Required for reliable production and CI usage.
- **P1** - High-value SEO capabilities built on the current APIs.
- **P2** - Quality-of-life, ecosystem and release maturity improvements.

## Principles

- Keep generation deterministic so builds produce reviewable diffs.
- Preserve the current programmatic API where possible and provide migrations
  for breaking changes.
- Never silently overwrite unmanaged HTML metadata or user configuration.
- Prefer opt-in advanced features so simple Angular projects stay simple.
- Keep network access out of the default build path; audits and remote checks
  should be explicit commands.

Open an issue for feature suggestions, use cases and prioritization feedback.
