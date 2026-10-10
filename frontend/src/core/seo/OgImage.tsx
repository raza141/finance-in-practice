import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { siteConfig } from "@/core/config/site";

/**
 * 1200×630 link-preview card (Open Graph: WhatsApp, LinkedIn, X, iMessage)
 * in the site's dark palette with the logo. One renderer for the site-wide
 * card and each course's card, so they always match.
 */
export class OgImage {
  static readonly size = { width: 1200, height: 630 };
  static readonly contentType = "image/png";

  static async render(card: { eyebrow: string; title: string; subtitle: string }): Promise<ImageResponse> {
    const logo = await readFile(join(process.cwd(), "public/brand/fip-logo.png"));
    const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
            background: "linear-gradient(135deg, #0b1120 0%, #151e32 60%, #1c2740 100%)",
            color: "#f8fafc",
            borderTop: "10px solid #d4af37",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain <img> only */}
          <img src={logoSrc} width={477} height={80} alt="" />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, letterSpacing: 6, color: "#22d3ee", textTransform: "uppercase" }}>{card.eyebrow}</div>
            <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.1, marginTop: 16 }}>{card.title}</div>
            <div style={{ fontSize: 34, color: "#94a3b8", marginTop: 20 }}>{card.subtitle}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
            <span style={{ color: "#d4af37", fontWeight: 700 }}>Book a free diagnostic session</span>
            <span style={{ color: "#94a3b8" }}>{siteConfig.domain}</span>
          </div>
        </div>
      ),
      OgImage.size,
    );
  }
}
