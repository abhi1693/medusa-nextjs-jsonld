// Adapt inside the existing App Router product page; keep your own metadata,
// static params, region lookup, 404 handling, and visible ProductTemplate.
import { buildProductJsonLd } from "@abhi1693/medusa-nextjs-jsonld"
import { JsonLd } from "@abhi1693/medusa-nextjs-jsonld/react"

// In ProductPage, after loading pricedProduct with the SAME region/customer
// context used by the visible page and checking it exists:
export function ProductStructuredData({ product, countryCode, baseUrl }: {
  product: Parameters<typeof buildProductJsonLd>[0]
  countryCode: string
  baseUrl: string
}) {
  if (!product.handle) return null
  const url = `/${encodeURIComponent(countryCode)}/products/${encodeURIComponent(product.handle)}`
  const data = buildProductJsonLd(product, { baseUrl }, { url })
  return <JsonLd id="product-jsonld" data={data} />
}
// Render <ProductStructuredData product={pricedProduct} countryCode={params.countryCode}
// baseUrl={process.env.NEXT_PUBLIC_BASE_URL!} /> alongside <ProductTemplate ... />.
// Set baseUrl to your real public store origin, never a request Host header.
