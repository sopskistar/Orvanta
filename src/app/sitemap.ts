import type { MetadataRoute } from "next";
import { business } from "@/lib/business";
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/services/", "/demo/", "/contact/", "/privacy/"].map(route => ({ url: `${business.siteUrl}${route}` }));
}
