"use client";

import { ChevronDown, LayoutDashboard, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { User } from "@supabase/supabase-js";
import {
  AuthDrawer,
  type AuthMode,
  type DrawerMode,
} from "@/components/AuthDrawer";
import { ProbixLogo } from "@/components/ProbixLogo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAIN_NAV = [
  { href: "/meciuri", label: "Meciuri" },
  { href: "/predictii", label: "Predicții" },
  { href: "/istoric", label: "Istoric" },
] as const;

const MOBILE_NAV_EXTRA = [
  { href: "/#cum-functioneaza", label: "Cum funcționează" },
] as const;

/** Aliniat la rândurile din `AuthDrawer` (nav cont / linkuri). */
const drawerRowLinkClass =
  "flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-3 text-left text-sm font-medium text-foreground transition hover:border-border hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const MOBILE_SHEET_NAV = [
  { href: "/", label: "Acasă" },
  ...MAIN_NAV,
  ...MOBILE_NAV_EXTRA,
] as const;

function navLinkActive(pathname: string, href: string) {
  if (href.startsWith("/#")) return pathname === "/";
  return pathname === href;
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const menuId = useId();
  const mobileMenuTitleId = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DrawerMode>("login");
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [portalMounted, setPortalMounted] = useState(false);
  /** Rămâne true ~o animație după `open === false`, ca portalul să poată finaliza translate și să nu rămână overlay „agățat”. */
  const [authDrawerInDom, setAuthDrawerInDom] = useState(false);
  const authDrawerWasOpened = useRef(false);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);

  const refreshUser = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setUser(null);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void refreshUser();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    startTransition(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    queueMicrotask(() => setPortalMounted(true));
  }, []);

  useEffect(() => {
    if (open) {
      authDrawerWasOpened.current = true;
      queueMicrotask(() => setAuthDrawerInDom(true));
      return;
    }
    if (!authDrawerWasOpened.current) return;
    const id = window.setTimeout(() => setAuthDrawerInDom(false), 320);
    return () => window.clearTimeout(id);
  }, [open]);

  const closeAuthDrawer = useCallback(() => {
    setOpen(false);
    setMode((m) =>
      m === "account-settings" || m === "account-billing" ? "account" : m,
    );
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen || !portalMounted) return;
    queueMicrotask(() => mobileMenuCloseRef.current?.focus());
  }, [mobileMenuOpen, portalMounted]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) startTransition(() => setMobileMenuOpen(false));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase?.auth.signOut();
    setUser(null);
    setOpen(false);
    setMode("login");
    router.refresh();
  }

  const openAuth = useCallback((nextMode: AuthMode) => {
    setMode(nextMode);
    setOpen(true);
  }, []);

  useEffect(() => {
    function onProbixAuthOpen(ev: Event) {
      const e = ev as CustomEvent<{ mode?: string }>;
      const m = e.detail?.mode;
      if (m === "login" || m === "register") {
        openAuth(m);
      }
    }
    window.addEventListener("probix-open-auth", onProbixAuthOpen as EventListener);
    return () =>
      window.removeEventListener(
        "probix-open-auth",
        onProbixAuthOpen as EventListener,
      );
  }, [openAuth]);

  const displayName =
    (typeof user?.user_metadata?.username === "string"
      ? user.user_metadata.username
      : null) ?? user?.email?.split("@")[0];

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-50 border-b px-4 py-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300 sm:px-5 md:px-10 md:py-3.5",
          scrolled
            ? "border-border/70 bg-background/[0.82] shadow-[0_1px_0_rgba(0,0,0,0.35)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/75"
            : "border-transparent bg-background/[0.38] backdrop-blur-md supports-[backdrop-filter]:bg-background/30",
        )}
      >
        <div className="mx-auto w-full max-w-none pb-shell-inner">
          <div className="flex min-w-0 items-center justify-between gap-2 md:gap-8">
            <Link
              href="/"
              className="min-w-0 shrink-0 transition-opacity duration-200 hover:opacity-90"
              aria-label="Probix - pagina principală"
              onClick={() => setMobileMenuOpen(false)}
            >
              <ProbixLogo />
            </Link>

            <nav
              aria-label="Navigare principală"
              className="hidden min-w-0 flex-1 items-center justify-center gap-6 text-[13px] font-medium text-foreground-muted md:flex md:gap-9"
            >
              {MAIN_NAV.map(({ href, label }) => {
                const active = navLinkActive(pathname, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "shrink-0 whitespace-nowrap transition-colors duration-200 hover:text-foreground",
                      active && "font-semibold text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex min-w-0 shrink-0 items-center justify-end gap-2">
              <div className="hidden items-center gap-2 sm:gap-3 md:flex">
                {user ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 min-h-10 max-w-[min(14.5rem,calc(100vw-8rem))] min-w-0 shrink justify-start gap-2 px-3"
                    onClick={() => {
                      setMode("account");
                      setOpen(true);
                    }}
                    title={
                      user.email
                        ? `${displayName} (${user.email}) - deschide panoul Cont`
                        : `${displayName ?? ""} - deschide panoul Cont`
                    }
                    aria-label={`Deschide panoul de cont (${displayName})`}
                  >
                    <LayoutDashboard
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-left">{displayName}</span>
                    <ChevronDown
                      className="size-4 shrink-0 text-muted-foreground opacity-90"
                      aria-hidden
                    />
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-10 cursor-pointer text-foreground-muted hover:text-foreground"
                      onClick={() => openAuth("login")}
                    >
                      Autentificare
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-10 min-h-10 cursor-pointer px-5 font-semibold shadow-sm transition-transform duration-200 hover:translate-y-[-1px]"
                      onClick={() => openAuth("register")}
                    >
                      Înregistrare
                    </Button>
                  </>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="size-11 min-h-11 min-w-11 shrink-0 text-foreground md:hidden"
                aria-expanded={mobileMenuOpen}
                aria-controls={mobileMenuOpen ? menuId : undefined}
                aria-label={mobileMenuOpen ? "Închide meniul" : "Deschide meniul"}
                onClick={() => setMobileMenuOpen((v) => !v)}
              >
                {mobileMenuOpen ? (
                  <X className="size-5" strokeWidth={2} aria-hidden />
                ) : (
                  <Menu className="size-5" strokeWidth={2} aria-hidden />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {portalMounted &&
        mobileMenuOpen &&
        createPortal(
          <div
            id={menuId}
            className="fixed inset-0 z-[100] flex justify-end md:hidden"
          >
            <button
              type="button"
              aria-label="Închide meniul"
              tabIndex={-1}
              className="absolute inset-0 bg-black/55 transition-opacity duration-300 ease-out motion-reduce:transition-none"
              onClick={() => setMobileMenuOpen(false)}
            />

            <aside
              role="dialog"
              aria-modal="true"
              aria-labelledby={mobileMenuTitleId}
              className="relative flex min-h-0 w-full max-w-none flex-col border-l border-border bg-card shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none max-lg:h-[100dvh] max-lg:max-h-[100dvh] max-lg:border-0 lg:h-full lg:max-w-md"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 pt-[max(1rem,env(safe-area-inset-top,0px))]">
                <h2
                  id={mobileMenuTitleId}
                  className="text-xl font-semibold tracking-tight text-foreground md:text-2xl"
                >
                  Meniu
                </h2>
                <button
                  ref={mobileMenuCloseRef}
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground ring-1 ring-border transition hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  aria-label="Închide meniul"
                >
                  <span aria-hidden className="text-xl leading-none">
                    ×
                  </span>
                </button>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
                  <nav aria-label="Navigare mobilă">
                    <ul className="flex flex-col gap-1.5">
                      {MOBILE_SHEET_NAV.map(({ href, label }) => {
                        const active = navLinkActive(pathname, href);
                        return (
                          <li key={href}>
                            <Link
                              href={href}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                drawerRowLinkClass,
                                "cursor-pointer",
                                active && "border-border bg-muted/50 font-semibold",
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              <span>{label}</span>
                              <span className="text-foreground-muted" aria-hidden>
                                →
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>

                <div className="shrink-0 space-y-3 border-t border-border px-5 pt-6 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))]">
                  {!user ? (
                    <>
                      <Button
                        type="button"
                        className="h-11 w-full cursor-pointer font-semibold shadow-sm"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuth("register");
                        }}
                      >
                        Înregistrare
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full cursor-pointer"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          openAuth("login");
                        }}
                      >
                        Autentificare
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full cursor-pointer justify-start gap-2"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        setMode("account");
                        setOpen(true);
                      }}
                    >
                      <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-left">Cont ({displayName})</span>
                    </Button>
                  )}
                </div>
              </div>
            </aside>
          </div>,
          document.body,
        )}

      {portalMounted &&
        authDrawerInDom &&
        createPortal(
          <AuthDrawer
            open={open}
            mode={mode}
            user={user}
            onClose={closeAuthDrawer}
            onModeChange={setMode}
            onAuthSuccess={async () => {
              await refreshUser();
              router.refresh();
            }}
            onAccountUpdated={async () => {
              await refreshUser();
              router.refresh();
            }}
            onSignOut={handleSignOut}
          />,
          document.body,
        )}
    </>
  );
}
