"use client";

import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingHeroActions({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      <Button
        type="button"
        size="lg"
        className="h-12 min-w-[168px] px-8"
        onClick={() =>
          window.dispatchEvent(new CustomEvent("probix-open-auth", { detail: { mode: "register" } }))
        }
      >
        Începe gratuit
      </Button>
      <Link
        href="/predictii"
        className={cn(
          buttonVariants({ variant: "secondary", size: "lg" }),
          "h-12 min-w-[168px] border border-border/70 bg-background-secondary/70 px-8 backdrop-blur-sm",
        )}
      >
        Vezi predicțiile
      </Link>
    </div>
  );
}
