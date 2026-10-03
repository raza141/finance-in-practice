import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  // -mt-20 cancels the root <main> padding reserved for the (hidden) site navbar.
  return <div className="-mt-20 min-h-screen bg-canvas">{children}</div>;
}
