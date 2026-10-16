import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const canonicalOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim() ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

export const metadata: Metadata = {
  metadataBase: canonicalOrigin ? new URL(canonicalOrigin) : undefined,
  title: "NyumbaNest | Find a place to call yours",
  description:
    "Discover quality homes, apartments, land, and commercial properties across Tanzania.",
  openGraph: {
    type: "website",
    siteName: "NyumbaNest",
    title: "NyumbaNest | Find a place to call yours",
    description: "Discover quality homes, apartments, land, and commercial properties across Tanzania.",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} h-full antialiased`}
      data-scroll-behavior="smooth"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
