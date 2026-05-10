import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const paths = [
    "",
    "/predictii",
    "/meciuri",
    "/istoric",
    "/autentificare",
    "/termeni",
    "/politica-confidentialitate",
    "/politica-cookies-disclaimer",
    "/resetare-parola",
  ] as const;

  return paths.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? ("weekly" as const) : ("weekly" as const),
    priority: path === "" ? 1 : 0.75,
  }));
}
