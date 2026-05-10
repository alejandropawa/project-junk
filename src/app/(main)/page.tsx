import type { Metadata } from "next";
import { Brain, LineChart, Radar, Sparkles } from "lucide-react";
import { MotionFadeIn, MotionFadeUp } from "@/components/ds/motion";
import { LandingFinalCtaActions } from "@/components/landing/landing-final-cta-actions";
import { LandingHeroActions } from "@/components/landing/landing-hero-actions";
import { LandingHeroDashboard } from "@/components/landing/landing-hero-dashboard";
import { LandingSection } from "@/components/landing/landing-section";
import { LandingStatCounters } from "@/components/landing/landing-stat-counters";
import { LandingTrustBadges } from "@/components/landing/landing-trust-badges";
import {
  getLandingLiveTodayMeta,
  getLandingMetricsPublic,
} from "@/lib/landing/server-metrics";

export const metadata: Metadata = {
  title: "Probix - analiză fotbal și predicții pre-meci",
  description:
    "Platformă inteligentă de insights fotbal: predicții transparente, istoric verificabil și flux live analitic - nu o experiență de pariuri.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Probix - analiză fotbal și predicții pre-meci",
    description:
      "Predicții pre-meci pe date reale, meciuri live și istoric verificabil într-o interfață analitică modernă.",
    url: "/",
  },
};

const PASI = [
  {
    icon: LineChart,
    titlu: "Analizăm datele meciului",
    text: "Forma recentă, statisticile echipelor, profilul ofensiv și defensiv, loturile și consistența din ultimele meciuri sunt analizate pentru a construi contextul general al partidei.",
  },
  {
    icon: Radar,
    titlu: "Verificăm cotele relevante",
    text: "Selectăm doar cotele care apar frecvent pe platformele importante și care sunt susținute de datele statistice și de ritmul estimat al meciului.",
  },
  {
    icon: Brain,
    titlu: "Evaluăm contextul real",
    text: "Luăm în calcul factori precum stilul de joc, absențele importante, istoricul direct și alte elemente care pot influența desfășurarea meciului.",
  },
  {
    icon: Sparkles,
    titlu: "Generăm o predicție pre-meci",
    text: "Pentru fiecare meci analizat este generată o singură combinație pre-meci, însoțită de un scor de încredere și o explicație clară înainte de start.",
  },
];

export default async function Home() {
  const [metrics, liveMeta] = await Promise.all([
    getLandingMetricsPublic(),
    getLandingLiveTodayMeta(),
  ]);

  return (
    <main className="relative flex w-full flex-1 flex-col">
      {/* Hero */}
      <LandingSection band="hero" aria-labelledby="landing-hero-title" className="border-b border-border/60">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:gap-16">
          <MotionFadeUp className="min-w-0">
            <h1
              id="landing-hero-title"
              className="max-w-[22ch] text-[clamp(2.1rem,5.2vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground md:max-w-none"
            >
              Predicții construite pe date reale și analiză statistică.
            </h1>
            <p className="mt-7 max-w-2xl text-[1.0625rem] leading-[1.65] text-foreground-secondary md:text-[1.08rem]">
              Probix urmărește forma echipelor, statisticile și contextul fiecărui meci pentru a evidenția cele mai
              relevante scenarii pre-meci.
            </p>
            <LandingHeroActions className="mt-10" />
            <LandingTrustBadges />
          </MotionFadeUp>
          <MotionFadeUp className="min-w-0 w-full overflow-visible">
            <LandingHeroDashboard />
          </MotionFadeUp>
        </div>
      </LandingSection>

      {/* Social proof */}
      <LandingSection id="dovada-incredere" aria-labelledby="social-proof-title">
        <MotionFadeIn>
          <h2 id="social-proof-title" className="max-w-2xl pb-text-section">
            Încredere măsurată în date, nu în sloganuri
          </h2>
          <p className="mt-4 max-w-2xl pb-text-body text-[1rem] leading-relaxed">
            Performanța predicțiilor este urmărită și afișată transparent, împreună cu istoricul complet al analizelor și
            rezultatelor.
          </p>
          <div className="mt-12 w-full max-w-none">
            <LandingStatCounters metrics={metrics} liveMeta={liveMeta} />
          </div>
        </MotionFadeIn>
      </LandingSection>

      {/* How it works */}
      <LandingSection
        id="cum-functioneaza"
        className="border-t border-border/50 bg-background-secondary/[0.35]"
        aria-labelledby="cum-functioneaza-title"
      >
        <MotionFadeUp>
          <h2 id="cum-functioneaza-title" className="pb-text-section">
            Cum funcționează?
          </h2>
          <p className="mt-4 max-w-2xl pb-text-body text-[1rem] leading-relaxed">
            De la statistici și context real de meci până la o singură predicție publicată înainte de start. Totul într-un
            proces transparent și ușor de urmărit.
          </p>
          <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:gap-8">
            {PASI.map(({ icon: Icon, titlu, text }) => (
              <li
                key={titlu}
                className="rounded-2xl border border-border/50 bg-elevated/35 p-6 transition-[border-color,box-shadow] duration-300 hover:border-border hover:shadow-[var(--shadow-pb-card)] md:p-7"
              >
                <div className="flex size-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/[0.08] text-primary">
                  <Icon className="size-5" strokeWidth={1.5} aria-hidden />
                </div>
                <h3 className="mt-5 pb-text-card-title text-[1.05rem]">{titlu}</h3>
                {text ? (
                  <p className="mt-2 pb-text-body text-[0.9375rem] leading-relaxed">{text}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-10 max-w-2xl text-[13px] leading-relaxed text-foreground-muted">
            Factori luați în calcul în funcție de disponibilitate: formă, cornere, cartonașe, loturi, condiții meteo când
            influențează stilul de joc, profil ofensiv/defensiv și serii istorice relevante pentru contextul competiției.
          </p>
        </MotionFadeUp>
      </LandingSection>

      {/* Final CTA */}
      <LandingSection band="tight" className="border-t border-border/50 pb-28 md:pb-24" id="cta-final-landing">
        <MotionFadeIn>
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border/55 bg-elevated/50 px-6 py-14 shadow-[var(--shadow-pb-card)] backdrop-blur-md md:px-14 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.05] via-transparent to-transparent"
              aria-hidden
            />
            <div className="relative max-w-2xl">
              <h2 className="pb-text-section text-[clamp(1.45rem,3vw,2rem)]">
                Încearcă gratuit timp de 7 zile
              </h2>
              <p className="mt-5 pb-text-body text-[1.02rem] leading-relaxed text-foreground-secondary">
                Descoperă meciurile live, statisticile și predicțiile pre-meci într-o platformă construită pentru
                claritate și analiză sportivă.
              </p>
              <LandingFinalCtaActions className="mt-10" />
            </div>
          </div>
        </MotionFadeIn>
      </LandingSection>

    </main>
  );
}
