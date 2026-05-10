"use client";

import { ChevronLeft } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import type { User } from "@supabase/supabase-js";
import { AccountBillingPanel, AccountSettingsPanel } from "@/components/auth/account-drawer-panels";
import { LoginForm } from "@/components/auth/login-form";
import { RegisterForm } from "@/components/auth/register-form";
import { ResetPasswordRequestForm } from "@/components/auth/reset-password-request-form";
import { Button } from "@/components/ui/button";

export type AuthMode = "login" | "register" | "reset";
export type DrawerMode = AuthMode | "account" | "account-settings" | "account-billing";

type AuthDrawerProps = {
  open: boolean;
  mode: DrawerMode;
  user: User | null;
  onClose: () => void;
  onModeChange: (mode: DrawerMode) => void;
  onAuthSuccess?: () => void | Promise<void>;
  /** După actualizări în Setări cont (nume, parolă etc.). */
  onAccountUpdated?: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
};

function accountTitle(mode: DrawerMode): string {
  if (mode === "login") return "Autentificare";
  if (mode === "register") return "Înregistrare";
  if (mode === "reset") return "Resetare parolă";
  if (mode === "account-settings") return "Setări cont";
  if (mode === "account-billing") return "Abonament și facturare";
  return "Cont";
}

function isAccountSubPanel(mode: DrawerMode): boolean {
  return mode === "account-settings" || mode === "account-billing";
}

export function AuthDrawer({
  open,
  mode,
  user,
  onClose,
  onModeChange,
  onAuthSuccess,
  onAccountUpdated,
  onSignOut,
}: AuthDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  async function handleAuthSuccess() {
    await Promise.resolve(onAuthSuccess?.());
    onModeChange("account");
  }

  const displayName =
    (typeof user?.user_metadata?.username === "string"
      ? user.user_metadata.username
      : null) ?? user?.email?.split("@")[0];

  const title = accountTitle(mode);

  const accountNavLinkClass =
    "flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-3 text-left text-sm font-medium text-foreground transition hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer";

  return (
    <div
      className={`fixed inset-0 z-[110] flex justify-end overflow-x-hidden ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Închide"
        tabIndex={-1}
        className={`absolute inset-0 z-0 bg-black/55 transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        } ${open ? "pointer-events-auto" : "pointer-events-none"}`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        inert={!open ? true : undefined}
        aria-labelledby={titleId}
        className={`relative z-10 flex min-h-0 flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none max-md:h-[100dvh] max-md:max-h-[100dvh] max-md:w-full max-md:max-w-none max-md:border-0 md:h-dvh md:max-h-dvh md:w-[min(28rem,calc(100vw-2rem))] md:flex-none md:shrink-0 ${
          open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2 border-b border-border px-5 py-4">
          {isAccountSubPanel(mode) ? (
            <button
              type="button"
              onClick={() => onModeChange("account")}
              className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Înapoi la cont"
            >
              <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
          <h2
            id={titleId}
            className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-foreground md:text-2xl"
          >
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <span aria-hidden className="text-xl leading-none">
              ×
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {mode === "account" && (
            <>
              {!user ? (
                <p className="pb-text-body text-muted-foreground">
                  Se încarcă contul…
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="rounded-2xl border border-border bg-background-secondary/50 px-4 py-4 backdrop-blur-sm">
                    <p className="pb-text-label">Conectat ca</p>
                    <p
                      className="mt-1 truncate text-base font-medium text-foreground"
                      title={user.email ?? undefined}
                    >
                      {displayName}
                    </p>
                    {user.email ? (
                      <p className="mt-1 truncate pb-text-caption text-foreground-muted">
                        {user.email}
                      </p>
                    ) : null}
                  </div>

                  <nav
                    aria-label="Cont utilizator"
                    className="flex flex-col gap-1.5"
                  >
                    <button
                      type="button"
                      className={accountNavLinkClass}
                      onClick={() => onModeChange("account-settings")}
                    >
                      Setări cont
                      <span className="text-foreground-muted" aria-hidden>
                        →
                      </span>
                    </button>
                    <button
                      type="button"
                      className={accountNavLinkClass}
                      onClick={() => onModeChange("account-billing")}
                    >
                      Abonament și facturare
                      <span className="text-foreground-muted" aria-hidden>
                        →
                      </span>
                    </button>
                  </nav>

                  <div className="border-t border-border pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full cursor-pointer"
                      onClick={() => void onSignOut?.()}
                    >
                      Deconectare
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {mode === "account-settings" && user ? (
            <AccountSettingsPanel
              user={user}
              onUserUpdated={onAccountUpdated}
              onSignOut={onSignOut}
            />
          ) : null}

          {mode === "account-billing" && user ? (
            <AccountBillingPanel />
          ) : null}

          {mode === "login" && (
            <>
              {!user ? (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onForgotPassword={() => onModeChange("reset")}
                />
              ) : null}
              {user ? (
                <p className="pb-text-body text-muted-foreground">
                  Ești deja autentificat. Deschide panoul din dreapta sus.
                </p>
              ) : null}
            </>
          )}

          {mode === "register" && !user && (
            <RegisterForm onSuccess={handleAuthSuccess} />
          )}

          {mode === "reset" && !user && <ResetPasswordRequestForm />}

          {!isAccountSubPanel(mode) &&
          mode !== "account" &&
          (mode === "reset" ||
            (mode === "login" && !user) ||
            (mode === "register" && !user)) ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              {mode === "login" && !user && (
                <>
                  Nu ai cont?{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-semibold text-primary hover:underline"
                    onClick={() => onModeChange("register")}
                  >
                    Creează un cont
                  </button>
                </>
              )}
              {mode === "register" && !user && (
                <>
                  Ai deja cont?{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-semibold text-primary hover:underline"
                    onClick={() => onModeChange("login")}
                  >
                    Autentifică-te
                  </button>
                </>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  className="cursor-pointer font-semibold text-primary hover:underline"
                  onClick={() => onModeChange("login")}
                >
                  Înapoi la autentificare
                </button>
              )}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
