import type { JsonLdConfig } from './types.js';

export interface ParsePageNumberOptions {
  /** Largest accepted page (inclusive). Defaults to Number.MAX_SAFE_INTEGER. */
  max?: number;
  /** Returned for invalid input. Defaults to 1 and must be within [1, max]. */
  fallback?: number;
}
export interface PaginatedUrlOptions {
  /** Query parameter to replace or remove. Defaults to "page". */
  pageParameter?: string;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

/** Parse a decimal digit string. Invalid input, including arrays, uses fallback. */
export function parsePageNumber(input: unknown, options: ParsePageNumberOptions = {}): number {
  const max = options.max ?? Number.MAX_SAFE_INTEGER;
  const fallback = options.fallback ?? 1;
  if (!positiveInteger(max) || !positiveInteger(fallback) || fallback > max) {
    throw new RangeError('max and fallback must be positive safe integers, with fallback <= max.');
  }
  if (typeof input !== 'string' || !/^[0-9]+$/.test(input)) return fallback;
  const page = Number(input);
  return positiveInteger(page) && page <= max ? page : fallback;
}

/**
 * Resolve a path against a trusted configured base URL, preserving other query
 * parameters and fragments. Absolute URLs must have the configured origin.
 */
export function buildPaginatedUrl(
  path: string, page: number, config: Pick<JsonLdConfig, 'baseUrl'>,
  options: PaginatedUrlOptions = {},
): string {
  if (!positiveInteger(page)) throw new RangeError('page must be a positive safe integer.');
  const parameter = options.pageParameter ?? 'page';
  if (typeof parameter !== 'string' || !parameter.trim() || /[\s\u0000-\u001f\u007f]/.test(parameter)) {
    throw new TypeError('pageParameter must be a nonempty query key without whitespace or control characters.');
  }
  if (typeof config?.baseUrl !== 'string' || !config.baseUrl.trim()) {
    throw new TypeError('A trusted absolute HTTP(S) baseUrl is required.');
  }
  let base: URL;
  let url: URL;
  try {
    base = new URL(config.baseUrl);
    if (typeof path !== 'string' || !path.trim()) throw new TypeError();
    url = new URL(path, base);
  } catch {
    throw new TypeError('A valid path and absolute HTTP(S) baseUrl are required.');
  }
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password ||
      url.origin !== base.origin || url.username || url.password ||
      !['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Pagination URLs must use the configured HTTP(S) origin without credentials.');
  }
  if (page === 1) url.searchParams.delete(parameter);
  else url.searchParams.set(parameter, String(page));
  return url.href;
}
