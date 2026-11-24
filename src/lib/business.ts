import type { Metadata } from "next";

function publicSiteUrl(): string {
  // Keep search and sharing URLs stable in local exports and preview builds.
  const value = process.env.NEXT_PUBLIC_SITE_URL || "https://getorvanta.xyz";
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
  hostingProvider: process.env.NEXT_PUBLIC_HOSTING_PROVIDER || "cloudflare",
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
  const image = { url: `${business.siteUrl}/brand/social-preview.png`, width: 1200, height: 630, alt: "Orvanta — AI receptionists and connected enquiry workflows" };
  return {
    title,
    description,
    alternates: { canonical: `${business.siteUrl}${path}` },
    openGraph: {
      title: `${title} | Orvanta`, description, type: "website", siteName: business.name,
      url: `${business.siteUrl}${path}`,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: `${title} | Orvanta`, description, images: [image] },
  };
}
