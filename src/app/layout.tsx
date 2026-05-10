import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { getSiteUrl } from "@/lib/site-url";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0b1020" }],
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Probix - Analytics fotbal & predicții",
    template: "%s · Probix",
  },
  description:
    "Platformă analitică pentru fotbal: meciuri live, predicții transparente și claritate pentru utilizatori care iau decizii pe date.",
  applicationName: "Probix",
  keywords: [
    "fotbal",
    "predicții",
    "meciuri live",
    "statistici",
    "analiză sportivă",
    "Probix",
    "Superliga",
  ],
  authors: [{ name: "Probix" }],
  creator: "Probix",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "ro_RO",
    siteName: "Probix",
    title: "Probix - Analytics fotbal & predicții",
    description:
      "Instrument analitic pentru meciuri live, predicții pre-meci și istoric transparent orientat pe date.",
    url: getSiteUrl(),
  },
  twitter: {
    card: "summary_large_image",
    title: "Probix - Analytics fotbal & predicții",
    description:
      "Meciuri live, predicții transparente și flux analitic modern pentru fotbal.",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "sports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ro" className={cn("dark h-full", inter.variable)} style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
