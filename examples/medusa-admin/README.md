# Optional Medusa Admin preview

This is a **copy-in Medusa v2 Admin widget**, not an installable backend plugin.
The storefront JSON-LD package does not need this widget to work. Installing it
only provides a local, read-only Product preview on the Admin product details
page. It does not inject scripts into a Next.js storefront.

## Install

1. Build/package this repository with `npm pack`. Install the resulting
   `medusa-nextjs-jsonld-0.1.0.tgz` in your **Medusa application** (in addition to
   installing it in the separate Next.js storefront), for example:

   ```sh
   npm install /absolute/path/to/medusa-nextjs-jsonld-0.1.0.tgz
   ```

   This source package is not assumed to be published to npm. Use the tarball
   filename actually generated if the version changes.

2. Copy `widgets/product-jsonld.tsx` to
   `src/admin/widgets/product-jsonld.tsx` in your Medusa application.
3. The example uses `product.details`, the current injection zone for Medusa
   **2.17.2+**. For older Medusa v2 installations, replace that zone with
   `product.details.after`. Follow your installed Medusa release's documentation.
4. Restart the application/Admin dev server, or rebuild your deployed Admin.
   Open a product details page and enter the public storefront base URL and
   actual canonical product path. Correct the suggested `/products/{handle}`
   path if your storefront uses country/locale prefixes or a different router.

The host Medusa application supplies React, `@medusajs/admin-sdk`,
`@medusajs/framework`, and `@medusajs/ui`. Keep those packages aligned with your
Medusa installation rather than independently upgrading them for this widget.

## What the preview means

- The widget calls the **same `buildProductJsonLd` implementation** as the
  storefront. It passes the current Admin product's title, description,
  thumbnail, images, and metadata, plus the URLs entered locally.
- Admin variants are deliberately omitted. An Admin product record does not
  establish the visitor's region, current calculated prices, tax context, or
  sellable inventory context. Therefore this preview has **no offers** and is
  **not a complete product-rich-result eligibility test**.
- Saved `metadata.jsonld` is shown separately as read-only source data. Only
  supported, validated fields are used by the builder. Arbitrary raw JSON-LD,
  ratings, reviews, offers, availability, and JSON-LD control keys are not
  accepted as overrides. Consult the package README for the supported fields.
- This example passes only `baseUrl` as global config. To match a real store,
  pass your public `productDefaults` too. Do not import a server config module
  that contains secrets into the Admin browser bundle. Storefront per-page
  overrides, breadcrumbs, and region-specific prices can change the final
  output; inspect the actual storefront page for the authoritative result.
- The suggested URL is a convenience, not a claim that the product is published
  or that the route exists. Nothing checks availability at that address.

## Safety and scope

URLs and preview state stay in the current browser component. They are reset
when switching products or reloading. There is no network fetch, metadata write,
backend endpoint, persistent setting, or server-side URL fetch in this example.
React renders preview JSON as text in a `pre` element; it is never inserted as
HTML or as an executable script. The widget is not a metadata editor.

If you change saved product metadata through your existing Medusa workflow,
refresh the details page if its data has not updated. Adding a dedicated editor
would require normal authenticated Admin API writes and explicit handling of
validation, concurrent changes, and permissions; this example does not implement
that API or imply that saving metadata alone installs storefront rendering.

## Validation and references

The widget was strict-TypeScript-checked against actual installed packages:
`@medusajs/admin-sdk@2.22.4`, `@medusajs/framework@2.22.4`, React 18 types, and
`@medusajs/ui@4.2.11`, using this repository's builder types. No running Medusa instance
or browser end-to-end integration was available, so test placement and styling
in your own application before deploying.

Official sources checked:

- [Admin widgets, props, and placement](https://docs.medusajs.com/learn/fundamentals/admin/widgets)
- [Medusa Admin customization](https://docs.medusajs.com/learn/fundamentals/admin)

The widget guide documents `defineWidgetConfig`, arrow-function default widget
components, `DetailWidgetProps<AdminProduct>`, and the 2.17.2 placement change.

Manual acceptance checks:

1. Product details shows the widget and the saved `metadata.jsonld` value.
2. Valid public base/product URLs produce a Product preview without offers.
3. Unsupported protocols and URLs with embedded credentials show a message.
4. Changing URL inputs changes only the preview; it sends no requests and does
   not change product metadata.
5. Navigating to another product resets the local URL inputs.
6. Validate the deployed storefront page using Google's Rich Results Test and
   Schema.org's validator. Their results apply to the real page, not this Admin
   preview, and valid markup does not guarantee a search enhancement.
