import type { Metadata } from "next";
import "@fontsource/bebas-neue";
import "@fontsource/work-sans/400.css";
import "@fontsource/work-sans/500.css";
import "@fontsource/work-sans/600.css";
import "@/app/globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SmoothScroll } from "@/components/smooth-scroll";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Mask Born Order", template: "%s — Mask Born Order" },
  description: "A pre-launch pixel collection shaped with its community.",
  icons: {
    icon: [{ url: "/collection/legends/13-circle.svg", type: "image/svg+xml" }],
    shortcut: "/collection/legends/13-circle.svg",
    apple: "/dps.png",
  },
  openGraph: {
    type: "website",
    title: "Mask Born Order",
    description: "A pre-launch pixel collection shaped with its community.",
    images: [{ url: "/dps.png", width: 1600, height: 1600, alt: "The Circle — Mask Born Order" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Mask Born Order",
    description: "A pre-launch pixel collection shaped with its community.",
    images: ["/dps.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SmoothScroll />
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer shell">
            <span>Mask Born Order</span>
            <p>Built in public, one mask at a time.</p>
            <span>Onchain pixel collection © 2026</span>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
