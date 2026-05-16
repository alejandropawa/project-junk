"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const CONSENT_KEY = "probix_cookie_consent";
const CONSENT_VALUE = "accepted";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("probix-cookie-consent", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("probix-cookie-consent", onStoreChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(CONSENT_KEY) === CONSENT_VALUE;
  } catch {
    return false;
  }
}

export function CookieConsentBanner() {
  const accepted = useSyncExternalStore(subscribe, getSnapshot, () => true);

  function accept() {
    try {
      window.localStorage.setItem(CONSENT_KEY, CONSENT_VALUE);
      document.cookie = `${CONSENT_KEY}=${CONSENT_VALUE}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`;
    } finally {
      window.dispatchEvent(new Event("probix-cookie-consent"));
    }
  }

  if (accepted) return null;

  return (
    <section
      aria-label="Consimțământ cookie-uri"
      className="fixed inset-x-0 bottom-0 z-[80] border-t border-border bg-background/95 px-4 py-4 shadow-[0_-18px_40px_-24px_rgba(0,0,0,0.7)] backdrop-blur-xl sm:px-6"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-sm leading-relaxed text-foreground-secondary">
          Probix folosește cookie-uri necesare pentru autentificare, sesiuni și
          funcționarea platformei. Nu folosim cookie-uri pentru publicitate
          personalizată. Detalii în{" "}
          <Link
            href="/politica-cookies-disclaimer"
            className="font-medium text-accent-foreground underline underline-offset-4 hover:text-foreground"
          >
            politica de cookies
          </Link>
          .
        </p>
        <Button
          type="button"
          onClick={accept}
          className="h-11 shrink-0 cursor-pointer px-5 text-sm font-semibold"
        >
          Am înțeles
        </Button>
      </div>
    </section>
  );
}
