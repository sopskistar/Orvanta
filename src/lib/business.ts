import type { Metadata } from "next";

function publicSiteUrl(): string | undefined {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const pages = process.env.CF_PAGES === "1" ? process.env.CF_PAGES_URL : undefined;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const value = configured || pages || (vercel ? `https://${vercel}` : undefined);
  if (!value) return undefined;
  const parsed = new URL(value);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an http(s) URL.");
  }
  return parsed.origin;
}

export const business = {
  name: "Orvanta",
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "julianahonour@gmail.com",
  siteUrl: publicSiteUrl(),
  hostingProvider: process.env.NEXT_PUBLIC_HOSTING_PROVIDER || (process.env.CF_PAGES === "1" ? "cloudflare" : "unspecified"),
  description: "Custom AI receptionist setup for cleaning companies, business websites and connected enquiry workflows.",
  demo: {
    path: "/demo/Orvanta_Receptionist_Demo.mp4",
    poster: "/demo/poster.jpg",
    title: "Mia — cleaning enquiry demo",
    description: "Watch Mia collect a cleaning request and see the captured enquiry.",
  },
} as const;

export const emailHref = `mailto:${business.email}?subject=${encodeURIComponent("Discuss my Orvanta setup")}`;

export function pageMetadata(title: string, description: string, path: string): Metadata {
  return {
    title,
    description,
    alternates: business.siteUrl ? { canonical: `${business.siteUrl}${path}` } : undefined,
    openGraph: {
      title: `${title} | Orvanta`, description, type: "website",
      ...(business.siteUrl ? { url: `${business.siteUrl}${path}` } : {}),
      images: business.siteUrl ? [{ url: `${business.siteUrl}/brand/social-preview.png`, width: 1200, height: 630, alt: "Orvanta — AI receptionists and connected enquiry workflows" }] : [],
    },
  };
}
