import Link from "next/link";
import { ProbixLogo } from "@/components/ProbixLogo";

const PLATFORM = [
  { href: "/predictii", label: "Predicții" },
  { href: "/meciuri", label: "Meciuri live" },
  { href: "/istoric", label: "Istoric" },
  { href: "/#cum-functioneaza", label: "Cum funcționează" },
] as const;

const LEGAL = [
  { href: "/termeni", label: "Termeni și condiții" },
  { href: "/politica-confidentialitate", label: "Politică de confidențialitate" },
  { href: "/politica-cookies-disclaimer", label: "Politică cookies" },
] as const;

function FooterNavLink({ href, children }: { href: string; children: string }) {
  return (
    <li>
      <Link
        href={href}
        className="block min-h-11 rounded-md px-1 py-2 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
      >
        {children}
      </Link>
    </li>
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
      {children}
    </h2>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative z-10 mt-auto border-t border-border/60 bg-background-secondary/40 backdrop-blur-sm supports-[backdrop-filter]:bg-background-secondary/35">
      <div className="mx-auto w-full max-w-none px-5 pb-12 pt-16 pb-shell-inner sm:px-6 md:px-10 md:pb-14 md:pt-20 lg:pt-24">
        <div className="grid grid-cols-1 gap-14 sm:grid-cols-2 sm:gap-x-12 sm:gap-y-16 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-12 xl:gap-x-14">
          {/* Brand */}
          <div className="flex min-w-0 flex-col sm:col-span-2 lg:col-span-1 lg:max-w-[min(100%,22rem)]">
            <p className="mb-5 text-[11px] font-medium uppercase tracking-wide text-foreground-muted">
              Analiză fotbalistică
            </p>
            <Link
              href="/"
              className="inline-flex w-fit rounded-md pb-focus-ring transition-opacity duration-200 hover:opacity-90"
              aria-label="Probix - pagina principală"
            >
              <ProbixLogo
                markClassName="h-10 w-10 md:h-11 md:w-11"
                wordmarkClassName="text-[1.875rem] tracking-[0.1em] text-foreground md:text-[2.25rem]"
              />
            </Link>
            <p className="mt-8 max-w-[36ch] pb-text-body md:mt-10">
              Platformă de analiză fotbalistică construită în jurul statisticilor live, contextului de meci și
              transparenței fiecărei predicții publicate.
            </p>
          </div>

          {/* Platformă */}
          <nav aria-label="Navigare platformă" className="flex min-w-0 flex-col">
            <SectionLabel>Platformă</SectionLabel>
            <ul className="mt-6 flex flex-col gap-0.5 sm:mt-7">
              {PLATFORM.map(({ href, label }) => (
                <FooterNavLink key={href} href={href}>
                  {label}
                </FooterNavLink>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Navigare legală" className="flex min-w-0 flex-col">
            <SectionLabel>Legal</SectionLabel>
            <ul className="mt-6 flex flex-col gap-0.5 sm:mt-7">
              {LEGAL.map(({ href, label }) => (
                <FooterNavLink key={href} href={href}>
                  {label}
                </FooterNavLink>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div className="flex min-w-0 flex-col sm:col-span-2 sm:max-w-md lg:col-span-1 lg:max-w-none">
            <SectionLabel>Contact</SectionLabel>
            <p className="mt-6 min-h-11 select-text py-2 text-sm font-medium text-muted-foreground sm:mt-7">
              contact@probix.ro
            </p>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Răspundem în general în 24–48h.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center gap-4 border-t border-border/50 pt-10 text-center md:mt-20 md:flex-row md:items-center md:justify-between md:gap-8 md:pt-12 md:text-left">
          <p className="text-sm leading-relaxed text-muted-foreground">
            © {year} Probix. Toate drepturile rezervate.
          </p>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-right">
            Conținutul platformei are scop informativ și analitic.
          </p>
        </div>
      </div>
    </footer>
  );
}
