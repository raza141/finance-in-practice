import { OgImage } from "@/core/seo/OgImage";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";

export const alt = "CFA Question of the Day";
export const size = OgImage.size;
export const contentType = OgImage.contentType;
export const revalidate = 300;

/** Today's question (LinkedIn caches previews for days, so posts should link the permanent page). */
export default async function Image() {
  return OgImage.render(QuestionPages.ogCard(await QuestionPages.latest()));
}
