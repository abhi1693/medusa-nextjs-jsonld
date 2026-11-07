import type {
  BreadcrumbItem, HomeJsonLdOptions, JsonLdConfig, JsonLdDocument, JsonLdObject,
  JsonValue, ListingInput, ListingJsonLdOptions, MedusaProduct,
  MedusaProductVariant, PageInput, ProductJsonLdOptions,
} from './types.js';

const CONTEXT = 'https://schema.org';
const PRODUCT_TEXT_FIELDS = [
  'name', 'description', 'sku', 'mpn', 'gtin', 'gtin8', 'gtin12', 'gtin13',
  'gtin14', 'color', 'material', 'size', 'category', 'model',
] as const;

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Only HTTP(S) URLs without embedded credentials may reach the output. */
function absoluteUrl(value: unknown, base?: string): string {
  if (!nonempty(value)) throw new TypeError('A nonempty HTTP(S) URL is required.');
  let parsed: URL;
  try { parsed = base ? new URL(value, base) : new URL(value); }
  catch { throw new TypeError(`Invalid URL: ${value}`); }
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new TypeError('URLs must use HTTP(S) and must not contain credentials.');
  }
  return parsed.href;
}

function baseUrl(config: JsonLdConfig): string {
  return absoluteUrl(config.baseUrl);
}
function idFor(url: string, fragment: string): string {
  const result = new URL(url);
  result.hash = fragment;
  return result.href;
}
function text(target: JsonLdObject, key: string, value: unknown): void {
  if (nonempty(value)) target[key] = value;
}
function productFields(input: unknown): JsonLdObject {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const fields: JsonLdObject = {};
  for (const key of PRODUCT_TEXT_FIELDS) text(fields, key, source[key]);
  const brand = source.brand;
  if (nonempty(brand)) fields.brand = { '@type': 'Brand', name: brand };
  else if (brand && typeof brand === 'object' && !Array.isArray(brand)) {
    const name = (brand as Record<string, unknown>).name;
    if (nonempty(name)) fields.brand = { '@type': 'Brand', name };
  }
  return fields;
}
function availability(variant: MedusaProductVariant): string | undefined {
  if (variant.manage_inventory === false) return `${CONTEXT}/InStock`;
  if (variant.manage_inventory !== true) return undefined;
  const count = variant.inventory_quantity;
  if (typeof count !== 'number' || !Number.isFinite(count)) return undefined;
  if (count > 0) return `${CONTEXT}/InStock`;
  if (variant.allow_backorder === true) return `${CONTEXT}/BackOrder`;
  if (variant.allow_backorder === false) return `${CONTEXT}/OutOfStock`;
  return undefined;
}

/** Build Product from a priced Medusa v2 response. Unknown prices and stock are omitted. */
export function buildProductJsonLd(
  product: MedusaProduct, config: JsonLdConfig, options: ProductJsonLdOptions,
): JsonLdDocument {
  const base = baseUrl(config);
  const url = absoluteUrl(options.url, base);
  const result: JsonLdObject = {
    '@context': CONTEXT, '@type': 'Product', '@id': idFor(url, 'product'), url,
  };
  Object.assign(result, productFields(config.productDefaults));
  text(result, 'name', product.title);
  text(result, 'description', product.description);
  Object.assign(result, productFields(product.metadata?.jsonld), productFields(options.overrides));
  // Catalog assets are optional: a malformed image must not break the page.
  const images = [product.thumbnail, ...(product.images ?? []).map((image) => image.url)]
    .filter(nonempty).flatMap((image) => {
      try { return [absoluteUrl(image, base)]; } catch { return []; }
    });
  if (images.length) result.image = [...new Set(images)];
  const offers: JsonLdObject[] = [];
  for (const variant of product.variants ?? []) {
    const price = variant.calculated_price?.calculated_amount;
    const currency = variant.calculated_price?.currency_code;
    if (typeof price !== 'number' || !Number.isFinite(price) || price < 0 ||
        typeof currency !== 'string' || !/^[a-z]{3}$/i.test(currency)) continue;
    const suppliedUrl = variant.id && options.variantUrls &&
      Object.prototype.hasOwnProperty.call(options.variantUrls, variant.id)
      ? options.variantUrls[variant.id] : undefined;
    const offer: JsonLdObject = {
      '@type': 'Offer', url: suppliedUrl === undefined ? url : absoluteUrl(suppliedUrl, base),
      price, priceCurrency: currency.toUpperCase(),
    };
    text(offer, 'sku', variant.sku);
    text(offer, 'name', variant.title);
    const stock = availability(variant);
    if (stock) offer.availability = stock;
    offers.push(offer);
  }
  if (offers.length) result.offers = offers;
  if (options.breadcrumbs?.length) {
    return { '@context': CONTEXT, '@graph': [withoutContext(result), withoutContext(buildBreadcrumbJsonLd(options.breadcrumbs))] };
  }
  return result;
}
function withoutContext(document: JsonLdObject): JsonLdObject {
  const { '@context': _context, ...node } = document;
  return node;
}

export function buildHomeJsonLd(config: JsonLdConfig, options: HomeJsonLdOptions = {}): JsonLdDocument {
  const base = baseUrl(config);
  const url = absoluteUrl(options.url ?? base, base);
  const website: JsonLdObject = { '@type': 'WebSite', '@id': idFor(url, 'website'), url };
  text(website, 'name', options.name ?? config.siteName);
  text(website, 'description', options.description);
  text(website, 'inLanguage', options.inLanguage);
  if (!config.organization) return { '@context': CONTEXT, ...website };
  const organizationUrl = absoluteUrl(config.organization.url ?? base, base);
  if (!nonempty(config.organization.name)) throw new TypeError('Organization name is required.');
  const organization: JsonLdObject = {
    '@type': 'Organization', '@id': idFor(organizationUrl, 'organization'),
    name: config.organization.name, url: organizationUrl,
  };
  if (config.organization.logo) organization.logo = absoluteUrl(config.organization.logo, base);
  if (config.organization.sameAs?.length) {
    organization.sameAs = config.organization.sameAs.map((link) => absoluteUrl(link));
  }
  website.publisher = { '@id': organization['@id']! };
  return { '@context': CONTEXT, '@graph': [website, organization] };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdDocument {
  return {
    '@context': CONTEXT, '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => {
      if (!nonempty(item.name)) throw new TypeError('Breadcrumb name is required.');
      return { '@type': 'ListItem', position: index + 1, name: item.name, item: absoluteUrl(item.url) };
    }),
  };
}

export function buildListingJsonLd(
  listing: ListingInput, config: JsonLdConfig, options: ListingJsonLdOptions,
): JsonLdDocument {
  const base = baseUrl(config);
  const url = absoluteUrl(options.url, base);
  if (!nonempty(listing.name)) throw new TypeError('Listing name is required.');
  const result: JsonLdObject = {
    '@context': CONTEXT, '@type': 'CollectionPage', '@id': idFor(url, 'webpage'),
    url, name: listing.name,
    mainEntity: {
      '@type': 'ItemList', numberOfItems: listing.products.length,
      itemListElement: listing.products.map((product, index) => {
        const item: JsonLdObject = { '@type': 'ListItem', position: index + 1, url: absoluteUrl(product.url, base) };
        text(item, 'name', product.name);
        return item;
      }),
    },
  };
  text(result, 'description', listing.description);
  text(result, 'inLanguage', options.inLanguage);
  const breadcrumbs = options.breadcrumbs ?? listing.breadcrumbs;
  if (breadcrumbs?.length) result.breadcrumb = withoutContext(buildBreadcrumbJsonLd(breadcrumbs));
  return result;
}

export function buildPageJsonLd(page: PageInput, config: JsonLdConfig): JsonLdDocument {
  const base = baseUrl(config);
  const url = absoluteUrl(page.url, base);
  if (!nonempty(page.name)) throw new TypeError('Page name is required.');
  const type = page.type ?? 'WebPage';
  if (!['WebPage', 'AboutPage', 'ContactPage'].includes(type)) throw new TypeError('Unsupported page type.');
  const result: JsonLdObject = {
    '@context': CONTEXT, '@type': type, '@id': idFor(url, 'webpage'), url, name: page.name,
  };
  text(result, 'description', page.description);
  text(result, 'inLanguage', page.inLanguage);
  if (page.breadcrumbs?.length) result.breadcrumb = withoutContext(buildBreadcrumbJsonLd(page.breadcrumbs));
  return result;
}

/** Escape HTML-significant characters to make JSON safe inside an inline script element. */
export function stringifyJsonLd(value: JsonValue): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new TypeError('A JSON value is required.');
  const escapes: Record<string, string> = {
    '<': '\\u003c', '>': '\\u003e', '&': '\\u0026', '\u2028': '\\u2028', '\u2029': '\\u2029',
  };
  return serialized.replace(/[<>&\u2028\u2029]/g, (character) => escapes[character]!);
}
