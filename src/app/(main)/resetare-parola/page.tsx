"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NewPasswordForm } from "@/components/auth/new-password-form";

export default function ResetareParolaPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    if (!supabase) {
      queueMicrotask(() => {
        if (!cancelled) {
          setError(
            "Autentificarea nu este configurată. Adaugă variabilele Supabase în mediu.",
          );
          setChecking(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && !cancelled) {
        setReady(true);
        setChecking(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) {
        setReady(true);
      }
      setChecking(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  function handlePasswordUpdated() {
    setSuccess(true);
    router.refresh();
    setTimeout(() => router.push("/"), 2000);
  }

  if (error) {
    return (
      <main className="relative mx-auto w-full max-w-md flex-1 px-6 py-16 md:px-10 md:py-24">
        <p className="text-destructive" role="alert">
          {error}
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-primary underline-offset-4 hover:underline"
        >
          Înapoi la pagina principală
        </Link>
      </main>
    );
  }

  if (checking) {
    return (
      <main className="relative mx-auto w-full max-w-md flex-1 px-6 py-16 md:px-10 md:py-24">
        <p className="text-muted-foreground">Se încarcă…</p>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="relative mx-auto w-full max-w-md flex-1 px-6 py-16 md:px-10 md:py-24">
        <h1 className="font-[family-name:var(--font-bebas)] text-3xl text-foreground">
          Link expirat sau invalid
        </h1>
        <p className="mt-4 text-muted-foreground">
          Solicită un nou link de resetare din fereastra de autentificare
          („Ai uitat parola?”).
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-primary underline-offset-4 hover:underline"
        >
          Înapoi la pagina principală
        </Link>
      </main>
    );
  }

  if (success) {
    return (
      <main className="relative mx-auto w-full max-w-md flex-1 px-6 py-16 md:px-10 md:py-24">
        <p className="rounded-lg border border-primary/35 bg-primary/10 px-4 py-3 text-foreground">
          Parola a fost actualizată. Te redirecționăm către pagina principală…
        </p>
      </main>
    );
  }

  return (
    <main className="relative mx-auto w-full max-w-md flex-1 px-6 py-16 md:px-10 md:py-24">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide text-foreground">
        Parolă nouă
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Alege o parolă nouă pentru contul tău.
      </p>

      <NewPasswordForm onSuccess={handlePasswordUpdated} />
    </main>
  );
}
