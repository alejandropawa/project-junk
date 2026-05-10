import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteJsonLd } from "@/components/site-json-ld";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden">
      <div
        className="probix-grid pointer-events-none absolute inset-0 opacity-[0.65]"
        aria-hidden
      />
      <div
        className="probix-ambient pointer-events-none absolute inset-0"
        aria-hidden
      />

      <SiteJsonLd />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:border focus:border-border focus:bg-background focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring/60"
      >
        Sari la conținut
      </a>
      <SiteHeader />

      <div id="main-content" className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>

      <SiteFooter />
    </div>
  );
}
