"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function AutentificareClient() {
  const sp = useSearchParams();
  const raw = sp.get("next")?.trim();
  const next = raw && raw.startsWith("/") ? raw : "/predictii";

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("probix-open-auth", { detail: { mode: "login" } }),
    );
  }, []);

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 py-16 text-center md:py-24">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border/60 bg-muted/25 text-primary">
        <Lock className="size-7" strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="mt-8 pb-text-section text-2xl">Autentificare</h1>
      <p className="mt-4 pb-text-body text-[0.98rem] leading-relaxed">
        Panoul de conectare ar trebui să fie deschis. Folosește butonul „Autentificare” din antet dacă nu apare.
      </p>
      <p className="mt-10">
        <Link
          href={next}
          className="text-sm text-foreground-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          ← Înapoi
        </Link>
      </p>
    </main>
  );
}

export default function AutentificarePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex flex-1 flex-col items-center px-6 py-20">
          <p className="text-sm text-muted-foreground">Se încarcă…</p>
        </main>
      }
    >
      <AutentificareClient />
    </Suspense>
  );
}
