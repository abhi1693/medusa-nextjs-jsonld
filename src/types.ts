/** Values that can be safely represented in JSON. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export interface JsonLdObject { [key: string]: JsonValue }
export type JsonLdDocument = JsonLdObject;

/** A structural subset of Medusa v2 StoreProduct; no Medusa runtime dependency. */
export interface MedusaProductVariant {
  id?: string;
  title?: string | null;
  sku?: string | null;
  barcode?: string | null;
  manage_inventory?: boolean | null;
  allow_backorder?: boolean | null;
  inventory_quantity?: number | null;
  calculated_price?: {
    /** Medusa v2 calculated amounts are major currency units. Do not divide by 100. */
    calculated_amount?: number | null;
    currency_code?: string | null;
  } | null;
}
export interface MedusaProduct {
  id?: string;
  handle?: string | null;
  title?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  images?: Array<{ url?: string | null }> | null;
  variants?: MedusaProductVariant[] | null;
  metadata?: Record<string, unknown> | null;
}

/** Deliberately excludes ratings, reviews, offers, availability, and JSON-LD control keys. */
export interface ProductFields {
  name?: string;
  description?: string;
  brand?: string | { name: string };
  sku?: string;
  mpn?: string;
  gtin?: string;
  gtin8?: string;
  gtin12?: string;
  gtin13?: string;
  gtin14?: string;
  color?: string;
  material?: string;
  size?: string;
  category?: string;
  model?: string;
}
export interface OrganizationConfig {
  name: string;
  url?: string;
  logo?: string;
  sameAs?: string[];
}
export interface JsonLdConfig {
  /** Absolute HTTP(S) public store root. Never derived from request headers. */
  baseUrl: string;
  siteName?: string;
  organization?: OrganizationConfig;
  productDefaults?: ProductFields;
}
export interface BreadcrumbItem { name: string; /** Absolute HTTP(S) URL. */ url: string }
export interface ProductJsonLdOptions {
  /** Actual canonical product URL, including locale when applicable. Relative URLs resolve against baseUrl. */
  url: string;
  /** Actual URLs for individual variants, keyed by variant ID. No variant routes are invented. */
  variantUrls?: Record<string, string>;
  overrides?: ProductFields;
  breadcrumbs?: BreadcrumbItem[];
}
export interface HomeJsonLdOptions {
  url?: string;
  name?: string;
  description?: string;
  inLanguage?: string;
}
export interface ListingProduct { name?: string; /** Actual visible product destination. */ url: string }
export interface ListingInput {
  name: string;
  description?: string;
  products: ListingProduct[];
  breadcrumbs?: BreadcrumbItem[];
}
export interface ListingJsonLdOptions {
  url: string;
  inLanguage?: string;
  breadcrumbs?: BreadcrumbItem[];
}
export interface PageInput {
  name: string;
  url: string;
  description?: string;
  type?: 'WebPage' | 'AboutPage' | 'ContactPage';
  inLanguage?: string;
  breadcrumbs?: BreadcrumbItem[];
}
