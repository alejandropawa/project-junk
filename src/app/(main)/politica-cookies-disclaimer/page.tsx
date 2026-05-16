import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politică cookies și disclaimer informativ · Probix",
  description:
    "Cookie-uri utilizate de Probix și disclaimer: conținut informativ, predicții automate, fără operator de jocuri de noroc.",
};

export default function PoliticaCookiesDisclaimerPage() {
  return (
    <article className="relative mx-auto w-full flex-1 px-6 py-16 pb-shell-inner md:px-10 md:py-24">
      <header>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground md:text-5xl">
          Politică cookies și disclaimer informativ
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ultima actualizare:{" "}
          <time dateTime="2026-05-10">10 Mai 2026</time>
        </p>
      </header>

      <div className="mt-14 max-w-3xl space-y-11 text-[0.975rem] leading-relaxed text-foreground-secondary">
        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">Cookie-uri</h2>
          <p className="mt-4">Probix utilizează cookie-uri și tehnologii similare pentru:</p>
          <ul className="mt-4 list-disc space-y-3 pl-5">
            <li>autentificare;</li>
            <li>menținerea sesiunilor active;</li>
            <li>funcționalitatea platformei;</li>
            <li>analiză tehnică și performanță.</li>
          </ul>
          <p className="mt-4">
            Cookie-urile utilizate nu sunt destinate profilării agresive sau publicității personalizate.
          </p>
          <p className="mt-4">
            La prima vizită afișăm un banner de informare pentru cookie-uri. Poți confirma informarea din banner; cookie-urile
            strict necesare pot fi folosite pentru funcționarea serviciului și pentru menținerea sesiunii.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">Disclaimer informativ</h2>
          <p className="mt-4">
            Conținutul publicat în cadrul platformei Probix are scop exclusiv informativ și analitic.
          </p>
          <p className="mt-4">Predicțiile și analizele:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>sunt generate automat pe baza unor date statistice și contextuale;</li>
            <li>nu reprezintă recomandări financiare;</li>
            <li>nu garantează rezultate;</li>
            <li>nu constituie sfaturi personalizate.</li>
          </ul>
          <p className="mt-4">
            Performanțele istorice și indicatorii statistici afișați nu reprezintă garanții privind rezultate viitoare.
          </p>
          <p className="mt-4">
            Probix nu operează ca operator de jocuri de noroc și nu facilitează plasarea pariurilor.
          </p>
          <p className="mt-4">
            Utilizatorii sunt singurii responsabili pentru modul în care aleg să utilizeze informațiile disponibile în
            platformă.
          </p>
        </section>
      </div>
    </article>
  );
}
