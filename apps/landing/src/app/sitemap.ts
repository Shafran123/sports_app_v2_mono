import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const PATHS = ["/", "/faq", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PATHS.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5
  }));
}
