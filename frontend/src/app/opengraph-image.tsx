import { siteConfig } from "@/core/config/site";
import { OgImage } from "@/core/seo/OgImage";

export const alt = "Finance in Practice: CFA® Level I tutoring in Abu Dhabi and online in Dubai";
export const size = OgImage.size;
export const contentType = OgImage.contentType;

export default function Image() {
  return OgImage.render({
    eyebrow: "CFA® · FRM® · University Finance",
    title: "CFA® Tutor in Abu Dhabi & Dubai",
    subtitle: siteConfig.delivery.short,
  });
}
