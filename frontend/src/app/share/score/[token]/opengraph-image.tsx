import { OgImage } from "@/core/seo/OgImage";
import { ScoreShare } from "@/domains/mocks/server/ScoreShare";
import { MockGrader } from "@/domains/mocks/services/MockGrader";

export const alt = "Mock exam score";
export const size = OgImage.size;
export const contentType = OgImage.contentType;

/** The LinkedIn preview of a shared mock score: the percentage big, the mock under it. */
export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const s = ScoreShare.fromEnv()?.read((await params).token);
  if (!s) return OgImage.render({ eyebrow: "Mock exam", title: "Exam-style mocks", subtitle: "Finance in Practice" });
  return OgImage.render({
    eyebrow: "Mock exam score",
    title: `${MockGrader.percent(s.score, s.total)}% · ${s.score} / ${s.total}`,
    subtitle: s.title,
    titleSize: 96,
  });
}
