import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termeni și condiții · Probix",
  description:
    "Termenii de utilizare ai platformei Probix: analiză fotbalistică, predicții informative, conturi, limitări și contact.",
};

export default function TermeniPage() {
  return (
    <article className="relative mx-auto w-full flex-1 px-6 py-16 pb-shell-inner md:px-10 md:py-24">
      <header>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground md:text-5xl">
          Termeni și condiții
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Ultima actualizare:{" "}
          <time dateTime="2026-05-10">10 Mai 2026</time>
        </p>
      </header>

      <div className="mt-14 max-w-3xl space-y-11 text-[0.975rem] leading-relaxed text-foreground-secondary">
        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">1. Despre platformă</h2>
          <p className="mt-4">
            Probix este o platformă digitală de analiză fotbalistică ce afișează statistici live, informații despre meciuri
            și predicții generate pe baza unor modele statistice și reguli analitice.
          </p>
          <p className="mt-4">Conținutul publicat are caracter exclusiv informativ și analitic.</p>
          <p className="mt-4">
            Probix nu operează ca operator de jocuri de noroc și nu facilitează plasarea pariurilor.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">2. Acceptarea termenilor</h2>
          <p className="mt-4">Prin accesarea sau utilizarea platformei Probix, confirmi că:</p>
          <ul className="mt-4 list-disc space-y-3 pl-5">
            <li>ai cel puțin 18 ani;</li>
            <li>utilizezi platforma în mod legal conform jurisdicției aplicabile;</li>
            <li>ai citit și acceptat acești termeni.</li>
          </ul>
          <p className="mt-4">
            Dacă nu ești de acord cu termenii de mai jos, te rugăm să întrerupi utilizarea platformei.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">3. Natura informațiilor și predicțiilor</h2>
          <p className="mt-4">
            Predicțiile și analizele afișate în cadrul platformei sunt generate automat folosind date statistice sportive,
            informații contextuale și reguli interne de analiză.
          </p>
          <p className="mt-4">Conținutul publicat:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>nu reprezintă recomandări financiare;</li>
            <li>nu garantează rezultate;</li>
            <li>nu trebuie interpretat drept sfat personalizat;</li>
            <li>nu constituie invitație la participarea în activități de pariuri.</li>
          </ul>
          <p className="mt-4">
            Scorurile de încredere, indicatorii statistici și performanțele istorice sunt prezentate exclusiv în scop
            informativ.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">4. Conturi și acces</h2>
          <p className="mt-4">Pentru anumite funcționalități poate fi necesară crearea unui cont.</p>
          <p className="mt-4">Utilizatorii sunt responsabili pentru:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>securitatea datelor de autentificare;</li>
            <li>activitatea desfășurată prin contul propriu;</li>
            <li>păstrarea confidențialității parolelor și accesului asociat contului.</li>
          </ul>
          <p className="mt-4">
            Ne rezervăm dreptul de a suspenda sau limita accesul în cazul utilizării abuzive, automate sau frauduloase a
            platformei.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">5. Utilizare interzisă</h2>
          <p className="mt-4">Este interzisă:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>copierea automată masivă a conținutului platformei;</li>
            <li>utilizarea de scripturi sau metode automate pentru extragerea datelor;</li>
            <li>încercarea de compromitere a securității platformei;</li>
            <li>distribuirea neautorizată a conținutului Probix în scop comercial.</li>
          </ul>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">6. Date furnizate de terți</h2>
          <p className="mt-4">
            Anumite statistici, scoruri și informații afișate provin din surse și furnizori externi.
          </p>
          <p className="mt-4">Deși încercăm să menținem informațiile actualizate și corecte, nu garantăm:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>disponibilitatea permanentă a tuturor datelor;</li>
            <li>lipsa întârzierilor;</li>
            <li>acuratețea absolută a informațiilor furnizate de terți.</li>
          </ul>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">7. Limitarea răspunderii</h2>
          <p className="mt-4">În măsura permisă de legislația aplicabilă, Probix nu poate fi considerată responsabilă pentru:</p>
          <ul className="mt-3 list-disc space-y-3 pl-5">
            <li>pierderi financiare;</li>
            <li>decizii luate pe baza informațiilor afișate;</li>
            <li>indisponibilitatea temporară a serviciului;</li>
            <li>erori sau întârzieri ale datelor furnizate de terți.</li>
          </ul>
          <p className="mt-4">Utilizarea platformei se face exclusiv pe propria răspundere a utilizatorului.</p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">8. Proprietate intelectuală</h2>
          <p className="mt-4">
            Conținutul, designul, structura și elementele vizuale ale platformei Probix sunt protejate de legislația
            aplicabilă privind drepturile de autor și proprietatea intelectuală.
          </p>
          <p className="mt-4">
            Este interzisă reutilizarea sau redistribuirea conținutului fără acordul prealabil scris.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">9. Modificarea termenilor</h2>
          <p className="mt-4">
            Probix poate actualiza acești termeni periodic pentru a reflecta modificări ale produsului, infrastructurii sau
            cadrului legal.
          </p>
          <p className="mt-4">
            Continuarea utilizării platformei după actualizarea termenilor reprezintă acceptarea acestora.
          </p>
        </section>

        <hr className="border-border/50" />

        <section>
          <h2 className="pb-text-card-title text-lg text-foreground">10. Contact</h2>
          <p className="mt-4">
            Pentru întrebări legate de acești termeni sau de platformă, ne poți contacta la:{" "}
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
