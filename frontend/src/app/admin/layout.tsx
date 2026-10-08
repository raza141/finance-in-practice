import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar. Print removes that padding
  // itself, so the offset and the full-height canvas are dropped there (they clipped printed PDFs' headers).
  return <div className="-mt-20 min-h-screen bg-canvas print:mt-0 print:min-h-0 print:bg-transparent">{children}</div>;
}
