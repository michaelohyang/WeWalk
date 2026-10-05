import type { MetadataRoute } from "next";

/** Private crew app: nothing to index. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
