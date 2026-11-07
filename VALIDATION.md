# Validation record

## Passed locally

- Node 24.22.1, TypeScript strict compilation of all public source.
- Nine automated test groups (`npm test`) covering prices including zero and invalid
  values, all explicit inventory states, missing stock, precedence/allowlisting,
  localized/variant URLs, image deduplication and invalid images, URL rejection,
  homepage graph, collection/category listing order and subset, breadcrumbs,
  informational pages, serializer escaping, and React server-rendered script/CSP nonce.
- `npm pack --dry-run`: declared exports and their declarations exist in the tarball.
- Production Next.js 15.3.9 / React 19.0.5 smoke app installed the actual packed
  tarball, imported both package entrypoints and ran `next build` successfully.
  Parsed the generated HTML: exactly one JSON-LD script, expected product name
  containing `</script>` safely encoded, and the expected USD 12.50 offer.
  This is a minimal synthetic integration, not a deployed Medusa storefront.
- Optional admin widget strict type check against `@medusajs/admin-sdk@2.22.4`,
  `@medusajs/framework@2.22.4`, `@medusajs/ui@4.2.11`, React 18 types.

The Next smoke test caught legacy `moduleResolution: node` handling of the `/react`
subpath; `typesVersions` now provides the declaration fallback, and the unchanged
consumer TypeScript settings passed after repacking/reinstalling. Tested framework
versions record the integration basis, not advice to pin an older framework release.
Use supported security-patched framework versions in production.

## Not verified here

- A live Medusa server and actual regional catalog, taxes, customer-specific pricing,
  inventory updates, route selection and cache invalidation.
- Live Admin placement, appearance and navigation in a browser.
- Deployed production HTML, CSP configuration, crawler access, Rich Results Test,
  Search Console, or Google's decision to display rich results.
- CI matrix on Node 20/22 until GitHub Actions runs. The local run used Node 24 only.
- CommonJS (not supported), Medusa v1 (not supported), ProductGroup rich results,
  and arbitrary Next/Medusa version combinations.

See README for reproducible package checks and live-store acceptance steps. Nothing
was deployed, published to npm, or released by these checks.
