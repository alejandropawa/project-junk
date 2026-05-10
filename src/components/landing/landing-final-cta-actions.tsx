"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingFinalCtaActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Button
        type="button"
        size="lg"
        className="h-12 min-w-[200px] px-10"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("probix-open-auth", { detail: { mode: "register" } }))
        }
      >
        Creează cont
      </Button>
      <Link
        href="/istoric"
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "h-12 min-w-[160px] border border-white/10 bg-white/5 px-8 backdrop-blur-sm hover:bg-white/10",
        )}
      >
        Vezi istoric
      </Link>
    </div>
  );
}
