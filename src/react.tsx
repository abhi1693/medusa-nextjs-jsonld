import { createElement } from "react";
import { stringifyJsonLd } from "./core.js";

/** Render in a server page, next to the visible content. No client effect or fetch. */
export function JsonLd({ data, id, nonce }: {
  data: Parameters<typeof stringifyJsonLd>[0] | null | undefined;
  id?: string;
  nonce?: string;
}) {
  if (data == null) return null;
  return createElement("script", {
    type: "application/ld+json",
    id,
    nonce,
    dangerouslySetInnerHTML: { __html: stringifyJsonLd(data) },
  });
}
