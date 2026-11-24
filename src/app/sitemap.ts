import type { MetadataRoute } from "next";
import { business } from "@/lib/business";
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // Never advertise a made-up production domain.
  if (!business.siteUrl) return [];
  return ["/", "/services/", "/demo/", "/contact/", "/privacy/"].map(route => ({ url: `${business.siteUrl}${route}` }));
}
