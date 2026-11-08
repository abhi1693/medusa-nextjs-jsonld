import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { AdminProduct, DetailWidgetProps } from "@medusajs/framework/types"
import { Container, Heading } from "@medusajs/ui"
import { useId, useMemo, useState } from "react"
import { buildProductJsonLd } from "@abhi1693/medusa-nextjs-jsonld"

// Copy into src/admin/widgets in your Medusa application. See ../README.md.
// This is a local preview, not a metadata editor or storefront injector.
const ProductJsonLdPreview = ({ product }: { product: AdminProduct }) => {
  const id = useId()
  const [baseUrl, setBaseUrl] = useState("")
  const [productPath, setProductPath] = useState(
    `/products/${encodeURIComponent(product.handle || product.id)}`
  )
  const preview = useMemo(() => {
    if (!baseUrl.trim()) return { message: "Enter your storefront base URL to preview." }
    try {
      const base = new URL(baseUrl.trim())
      if (!["https:", "http:"].includes(base.protocol) || base.username || base.password) {
        throw new Error("Use an HTTP(S) storefront URL without credentials.")
      }
      if (!productPath.trim()) throw new Error("Enter the canonical product URL or path.")
      const url = new URL(productPath.trim(), base)
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) {
        throw new Error("Use an HTTP(S) product URL without credentials.")
      }
      // Deliberately omit admin variants. They do not establish the active
      // storefront region, calculated prices, or sellable inventory context.
      const value = buildProductJsonLd(
        {
          id: product.id,
          title: product.title,
          description: product.description,
          thumbnail: product.thumbnail,
          images: product.images,
          metadata: product.metadata,
        },
        { baseUrl: base.href },
        { url: url.href }
      )
      return { json: JSON.stringify(value, null, 2) }
    } catch (error) {
      return { message: error instanceof Error ? error.message : "Unable to build this preview." }
    }
  }, [baseUrl, productPath, product])

  return (
    <Container className="flex flex-col gap-4">
      <Heading level="h2">Product structured data preview</Heading>
      <p className="text-ui-fg-subtle text-sm">
        Local preview using product details and supported metadata.jsonld overrides.
        Offers are omitted: this admin record has no active storefront region or
        calculated prices. These inputs are not saved and no URLs are fetched.
      </p>
      <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-base`}>
        Storefront base URL
        <input
          id={`${id}-base`}
          type="url"
          placeholder="https://store.example.com"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          className="rounded border p-2"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm" htmlFor={`${id}-product`}>
        Canonical product URL or path (include your country or locale prefix)
        <input
          id={`${id}-product`}
          type="text"
          value={productPath}
          onChange={(event) => setProductPath(event.target.value)}
          className="rounded border p-2"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      {preview.message ? <p role="status" className="text-sm">{preview.message}</p> : null}
      {preview.json ? (
        <pre aria-label="Product JSON-LD preview" className="max-h-96 overflow-auto rounded bg-ui-bg-subtle p-3 text-xs">
          {preview.json}
        </pre>
      ) : null}
      <details>
        <summary className="cursor-pointer text-sm">Saved metadata.jsonld (read-only)</summary>
        <pre className="max-h-64 overflow-auto rounded bg-ui-bg-subtle p-3 text-xs">
          {JSON.stringify(product.metadata?.jsonld ?? null, null, 2)}
        </pre>
      </details>
      <p className="text-ui-fg-subtle text-sm">
        This is not a Google eligibility check. Validate the actual public product
        page after installing the storefront component. Storefront config defaults
        and explicit overrides can also change the final output.
      </p>
    </Container>
  )
}

// Key by product ID so navigating between products resets the local URL inputs.
const ProductJsonLdWidget = ({ data }: DetailWidgetProps<AdminProduct>) => (
  <ProductJsonLdPreview key={data.id} product={data} />
)

// Medusa 2.17.2+. For older v2 releases, use "product.details.after".
export const config = defineWidgetConfig({ zone: "product.details" })

export default ProductJsonLdWidget
