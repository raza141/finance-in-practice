import { StructuredData, type JsonLdNode } from "@/core/seo/StructuredData";

/** Renders one JSON-LD block; content comes from StructuredData, never from user HTML. */
export function JsonLd({ data }: { data: JsonLdNode }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: StructuredData.serialize(data) }} />;
}
