import { OgImage } from "@/core/seo/OgImage";

export const alt = "Finance in Practice: CFA® Level I & finance tutoring in the UAE";
export const size = OgImage.size;
export const contentType = OgImage.contentType;

export default function Image() {
  return OgImage.render({
    eyebrow: "CFA® · FRM® · University Finance",
    title: "CFA® & Finance Tutor in the UAE",
    subtitle: "1-on-1 online coaching · Dubai · Abu Dhabi · worldwide",
  });
}
