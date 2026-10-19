import { OgImage } from "@/core/seo/OgImage";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";

export const alt = "CFA practice question";
export const size = OgImage.size;
export const contentType = OgImage.contentType;
export const revalidate = 3600;

/** The LinkedIn/WhatsApp preview of one question: level, topic and title. */
export default async function Image({ params }: { params: Promise<{ topic: string; slug: string }> }) {
  const { topic, slug } = await params;
  return OgImage.render(QuestionPages.ogCard(await QuestionPages.bySlug(topic, slug)));
}
