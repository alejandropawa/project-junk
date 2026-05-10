import { getSiteUrl } from "@/lib/site-url";

/** Schema.org WebSite pentru SEO și agenți (conținut static, fără date sensibile). */
export function SiteJsonLd() {
  const url = getSiteUrl();
  const data = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Probix",
    url,
    description:
      "Platformă analitică pentru fotbal: meciuri live, predicții pre-meci transparente și claritate orientată pe date.",
    inLanguage: "ro-RO",
    publisher: {
      "@type": "Organization",
      name: "Probix",
      url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
