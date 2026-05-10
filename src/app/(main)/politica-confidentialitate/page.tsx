import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politică de confidențialitate · Probix",
  description:
    "Modul în care Probix colectează, utilizează și protejează datele utilizatorilor: cookie-uri, furnizori, drepturi și contact.",
};

export default function PoliticaConfidentialitatePage() {
  return (
    <article className="relative mx-auto w-full flex-1 px-6 py-16 pb-shell-inner md:px-10 md:py-24">
      <header>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground md:text-5xl">
          Politică de confidențialitate
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ultima actualizare:{" "}
          <time dateTime="2026-05-10">10 Mai 2026</time>
        </p>
      </header>

      <div className="mt-14 max-w-3xl space-y-11 text-[0.975rem] leading-relaxed text-foreground-secondary">
        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">1. Introducere</h2>
          <p className="mt-4">
            Această politică explică modul în care Probix colectează, utilizează și protejează datele utilizatorilor
            platformei.
          </p>
          <p className="mt-4">Prin utilizarea platformei, accepți practicile descrise mai jos.</p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">2. Ce date colectăm</h2>
          <p className="mt-4">În funcție de modul de utilizare a platformei, putem colecta:</p>
          <ul className="mt-4 list-disc space-y-3 pl-5">
            <li>adresă email;</li>
            <li>informații de autentificare;</li>
            <li>date tehnice despre dispozitiv și browser;</li>
            <li>adresă IP;</li>
            <li>date privind utilizarea platformei;</li>
            <li>cookie-uri și sesiuni de autentificare.</li>
          </ul>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">3. Cum folosim datele</h2>
          <p className="mt-4">Datele pot fi utilizate pentru:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>autentificare și securitate;</li>
            <li>funcționarea platformei;</li>
            <li>îmbunătățirea experienței utilizatorilor;</li>
            <li>analiză tehnică și performanță;</li>
            <li>prevenirea abuzurilor și activităților frauduloase.</li>
          </ul>
          <p className="mt-4">Nu vindem datele utilizatorilor către terți.</p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">4. Furnizori și servicii externe</h2>
          <p className="mt-4">Pentru operarea platformei putem utiliza servicii terțe precum:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>Supabase;</li>
            <li>Vercel;</li>
            <li>furnizori de statistici sportive;</li>
            <li>servicii de analiză tehnică și infrastructură.</li>
          </ul>
          <p className="mt-4">
            Aceste servicii pot procesa anumite date strict pentru funcționarea platformei.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">5. Cookie-uri și sesiuni</h2>
          <p className="mt-4">Probix utilizează cookie-uri și tehnologii similare pentru:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>autentificare;</li>
            <li>menținerea sesiunii active;</li>
            <li>funcționalitatea platformei;</li>
            <li>analiză tehnică și performanță.</li>
          </ul>
          <p className="mt-4">Poți controla cookie-urile din setările browserului tău.</p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">6. Securitatea datelor</h2>
          <p className="mt-4">
            Aplicăm măsuri tehnice și organizaționale rezonabile pentru protejarea datelor și securitatea platformei.
          </p>
          <p className="mt-4">Totuși, niciun sistem online nu poate garanta securitate absolută.</p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">7. Drepturile utilizatorilor</h2>
          <p className="mt-4">Conform legislației aplicabile, utilizatorii pot solicita:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>acces la datele personale;</li>
            <li>corectarea datelor;</li>
            <li>ștergerea contului;</li>
            <li>restricționarea prelucrării;</li>
            <li>exportul datelor unde este aplicabil.</li>
          </ul>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">8. Retenția datelor</h2>
          <p className="mt-4">Datele sunt păstrate doar atât timp cât este necesar pentru:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>funcționarea platformei;</li>
            <li>securitate;</li>
            <li>obligații legale;</li>
            <li>prevenirea abuzurilor.</li>
          </ul>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">9. Modificări ale politicii</h2>
          <p className="mt-4">
            Această politică poate fi actualizată periodic pentru a reflecta modificări tehnice, operaționale sau legale.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">10. Contact</h2>
          <p className="mt-4">Pentru întrebări privind confidențialitatea sau datele personale:</p>
          <p className="mt-3">
            <a
              href="mailto:contact@probix.ro"
              className="font-medium text-primary underline-offset-4 transition-colors hover:underline"
            >
              contact@probix.ro
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
