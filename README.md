# Medusa Next.js JSON-LD

[![CI](https://github.com/abhi1693/medusa-nextjs-jsonld/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/abhi1693/medusa-nextjs-jsonld/actions/workflows/ci.yml)
[![Sponsor](https://img.shields.io/badge/Sponsor-abhi1693-ea4aaa?logo=githubsponsors&logoColor=white)](https://github.com/sponsors/abhi1693)

Server-rendered Schema.org structured data for **Medusa v2** storefronts. ESM TypeScript package with no runtime dependency in the core; optional React 18/19 component for Next.js App Router. Supports Product/Offer, WebSite/Organization, CollectionPage/ItemList, BreadcrumbList and informational WebPage types.

This repository is a source package, not a published npm release. It is not an automatically loaded Medusa backend plugin: storefronts own their HTML, routing, pricing context, and canonical URLs. Install in the **storefront**, add the component to the corresponding server pages, and optionally copy the admin widget into your backend. There is no tracking, external service, API key or database migration.

## Install from source

```sh
npm ci
npm run check
npm pack
# In your storefront, install the resulting local tarball:
npm install /path/to/medusa-nextjs-jsonld-0.1.0.tgz
```

Requires Node 20+, React 18/19 for the `/react` export. Core imports do not load React or Next. The package is currently ESM-only. No license to redistribute has been selected by the repository owner (`UNLICENSED`).

## Product page (minimum integration)

```tsx
import { buildProductJsonLd } from "medusa-nextjs-jsonld"
import { JsonLd } from "medusa-nextjs-jsonld/react"

// Keep config in your storefront's server code. Use your actual public origin.
const config = {
  baseUrl: "https://shop.example.com",
  productDefaults: { brand: "Your actual brand" },
}

// After your existing region-aware listProducts call and notFound checks:
const url = `/${countryCode}/products/${encodeURIComponent(product.handle)}`
const data = buildProductJsonLd(product, config, { url })
return <>
  <JsonLd id="product-jsonld" data={data} />
  <ProductTemplate product={product} region={region} countryCode={countryCode} />
</>
```

Use your existing page component and props rather than replacing its metadata, variant-image handling or static params. A copyable adapter is in `examples/nextjs/product-page.tsx`. The official starter has promise-valued route params in Next 15, so await `props.params` before building URLs. Keep canonical metadata and JSON-LD URL consistent.

Fetch `*variants.calculated_price,+variants.inventory_quantity,+metadata` with the same region/currency and customer context as the visible product. Do not separately fetch anonymous prices if the page shows customer-specific prices. Medusa v2 `calculated_amount` is already in major units: **10 means 10, not 0.10**. Zero-price offers are valid. Currency codes must be three letters; this is format validation, not a currency registry lookup. Supply the actual active ISO currency. Raw price lists and uncalculated prices are not used. Variants without a valid calculated price and currency do not produce offers. Do not use this adapter for Medusa v1's cents-based pricing.

Pass `variantUrls` keyed by variant ID only if those URLs really select and render that variant. Without a mapping offers point to the product page; the library does not invent a query parameter or a variant route. A selected variant URL, filtered variants, and visible content must remain consistent. A Product with multiple offers is supported, but this release does not model ProductGroup variant families or promise Google's variant-specific features.

### Configuration and precedence

Type declarations in `dist/types.d.ts` are the complete API contract. For supported static product properties, precedence is:

1. `config.productDefaults` (store-wide fallback)
2. Product title/description from the supplied Medusa product
3. `product.metadata.jsonld` (per-product, explicitly allowlisted)
4. `options.overrides` (per-page)

Only supply facts that apply to this product and are visible or verifiable. Static fields do not replace calculated prices, availability, canonical identity, or arbitrary JSON-LD. Supported keys: name, description, brand (string or `{name}`), sku, mpn, gtin, gtin8, gtin12, gtin13, gtin14, color, material, size, category, model. These are caller assertions, not verified catalog identifiers. Unknown metadata keys are ignored; raw HTML/script injection is not supported. Do not put secrets in public JSON-LD.

Availability comes only from explicit inventory flags/quantity: unmanaged inventory is in stock; managed stock with a positive quantity is in stock; depleted managed stock with backorders enabled is backorder; depleted managed stock with backorders disabled is out of stock. Incomplete inventory data is omitted instead of guessed. No ratings, reviews, GTINs, shipping policies or return policies are invented. Missing required data for a particular Google rich result remains a validation warning to resolve with truthful data, not a fabricated default.

## Coverage beyond products

```tsx
import {
  buildHomeJsonLd, buildListingJsonLd, buildBreadcrumbJsonLd, buildPageJsonLd,
} from "medusa-nextjs-jsonld"

// Put on the actual localized homepage, not every layout or checkout page.
const home = buildHomeJsonLd({
  baseUrl: "https://shop.example.com",
  organization: { name: "Your legal/store name", url: "https://shop.example.com" },
}, { url: "/us", name: "Your storefront" })

// Collections, categories, and store/catalog pages use their REAL visible items.
const listing = buildListingJsonLd({
  name: "Summer collection",
  products: visibleProducts.map((p) => ({
    name: p.title,
    url: `/us/products/${encodeURIComponent(p.handle)}`,
  })),
}, { baseUrl: "https://shop.example.com" }, { url: "/us/collections/summer" })

const crumbs = buildBreadcrumbJsonLd([
  { name: "Home", url: "https://shop.example.com/us" },
  { name: "Summer", url: "https://shop.example.com/us/collections/summer" },
])

const about = buildPageJsonLd({
  name: "About us", url: "/us/about", type: "AboutPage",
}, { baseUrl: "https://shop.example.com" })
```

Render each with `<JsonLd data={...} />`. Use `CollectionPage` for collection/category pages without claiming a Google product carousel. ItemList describes only products actually shown on that page, in display order. Paginated and filtered pages should use their actual canonical URL and visible page subset, not every product in the collection. Do not guess nested category paths from one handle. The official starter's category route is `[...category]`; construct it from the resolved ancestor path. Breadcrumbs must match the navigable hierarchy. `buildPageJsonLd` also supports other explicitly typed informational pages according to its type declaration.

Do not add Product markup to cart, checkout, account, or order-confirmation pages. Avoid duplicating schemas from other SEO plugins. This package deliberately does not invent SearchAction endpoints, FAQ answers, articles, authors, product review aggregates or business addresses.

## Admin preview

See [the optional product details widget](examples/medusa-admin/README.md). It uses the same builder but is **a preview**, not proof of the regional storefront output. Admin products do not normally contain storefront calculated prices. The widget does not scrape your storefront, persist settings, or transmit catalog data to another service. Configuration remains explicit in your storefront code; the copy-in widget is not auto-discovered by installing the storefront package.

## Security, rendering and validation

`JsonLd` is server-component compatible and renders an ordinary `application/ld+json` script, without effects or client-only hydration. It accepts a CSP `nonce` and optional `id`. `stringifyJsonLd` escapes HTML-significant characters and Unicode line separators, preventing product text such as `</script>` from breaking out of the script. Use this serializer rather than raw JSON.stringify with dangerouslySetInnerHTML. Invalid mandatory canonical URLs throw; supply a trusted configured base URL rather than request headers. Malformed optional product image URLs are omitted so bad catalog assets do not break rendering. Invalid canonical, variant, organization, listing and breadcrumb URLs throw; validate configuration before deployment. URL validation does not prove same-origin, public reachability or canonical correctness: callers own those choices, including any fragment or query string. Don't fetch arbitrary storefront URLs from an admin/backend endpoint.

Development verification:

```sh
npm ci
npm run check
```

Tests cover builders, unsafe strings, missing prices, stock behavior, and the rendered React script. CI runs Node 20/22/24. Before production:

1. Render a real product server page in each region/currency, including zero price, out-of-stock, unknown inventory and variant states. Inspect **View Source** or the actual HTML response for `application/ld+json`; an admin preview is not this test.
2. Check offers against the visible price, currency, stock and canonical URL. Test cache invalidation after product/price/inventory edits. This package introduces no cache or webhook; use your storefront's existing Medusa revalidation.
3. Test the page with Google's [Rich Results Test](https://search.google.com/test/rich-results) and [Schema.org validator](https://validator.schema.org/). They serve different purposes; valid Schema.org data does not guarantee a Google rich result.
4. Verify production crawler access, canonical/noindex policy, script presence with CSP, and any existing SEO plugin duplication. Monitor Search Console after deployment.

No live store credentials or deployment are needed for unit tests. Local tests are not claims that Google crawled a store or that a rich result will appear.

## Integration basis

The implementation was based on the official [Medusa Next.js starter](https://github.com/medusajs/nextjs-starter-medusa/tree/9818886f06e493cb2249733d114d339aa216ef00): product server page, region-aware product fetch, money formatting and inventory UI. That snapshot uses Next 15.3.9, React 19, and Medusa v2. Other Next App Router versions may work, but have not been exercised in a full deployed storefront here. Follow [Next.js JSON-LD guidance](https://nextjs.org/docs/app/guides/json-ld) and [Google's Product guidance](https://developers.google.com/search/docs/appearance/structured-data/product).

## Reusable pagination helpers

Both helpers and their option interfaces are exported from the package root. They
have no Medusa, Next.js, or React dependency and do not invent merchant routes or
filter parameters.

```ts
import { parsePageNumber, buildPaginatedUrl } from 'medusa-nextjs-jsonld'

const config = { baseUrl: 'https://shop.example.com' } // trusted server configuration
const page = parsePageNumber(searchParams.page, { max: 10000, fallback: 1 })
const url = buildPaginatedUrl('/catalog?color=blue&sort=new', page, config)
// Page 2: https://shop.example.com/catalog?color=blue&sort=new&page=2
// Page 1: https://shop.example.com/catalog?color=blue&sort=new
const customUrl = buildPaginatedUrl('/catalog?color=blue', page, config, {
  pageParameter: 'p',
})
```

- `parsePageNumber(input: unknown, options?: ParsePageNumberOptions): number`
  accepts decimal digit strings representing positive safe integers (leading
  zeros are accepted). Missing values, arrays, numbers, whitespace, signs,
  fractions, exponent notation, unsafe integers, and values exceeding `max`
  return `fallback`. Defaults are `max: Number.MAX_SAFE_INTEGER` and
  `fallback: 1`. Both options must be positive safe integers and fallback must
  not exceed max; invalid options throw `RangeError`.
- `buildPaginatedUrl(path: string, page: number, config: Pick<JsonLdConfig, 'baseUrl'>,
  options?: PaginatedUrlOptions): string` resolves relative paths using standard
  URL semantics against the configured base URL. The default `pageParameter`
  is `page`; other query parameters, repeated filter values and fragments are
  retained. All instances of the selected page parameter are removed on page 1,
  or replaced by one value otherwise. URLSearchParams may normalize query
  encoding while preserving its decoded values. Pass actual route/filter
  parameters from the page, not fabricated facets.
- The URL helper requires a positive safe integer page, a nonempty query key
  without whitespace/control characters, and an absolute HTTP(S) base URL
  without credentials. Cross-origin URLs and credential-bearing URLs are
  rejected. Configure baseUrl on the server, never from request headers.
  These helpers do not impose an SEO filter/canonical policy: callers decide
  which real filters belong in canonical metadata and JSON-LD.

## Release preparation

The `release.yml` and `publish.yml` callers use the shared `abhi1693/actions@v1` workflows. Preparation runs CI, builds an exact committed version and creates a draft containing its archive, checksums and provenance. Publication verifies and publishes that same archive with npm OIDC. Normal CI does not publish.

**Release preparation is blocked until the owner selects a license and adds its LICENSE file.** This migration preserves the existing `UNLICENSED` declaration. The shared packager requires a LICENSE file; passing the ordinary test matrix does not clear this requirement. Before preparation, also commit matching package/lockfile versions and `docs/releases/VERSION.md` notes. Configure npm ownership and trusted publishing for repository `abhi1693/medusa-nextjs-jsonld`, workflow `publish.yml`, with no environment. No registry token or package release is created by this migration.
