import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
      <h1 className="font-[family-name:var(--font-bebas)] text-5xl text-foreground">
        Pagina nu a fost găsită
      </h1>
      <p className="max-w-md text-muted-foreground">
        Adresa pe care ai ajuns nu există sau a fost mutată.
      </p>
      <Link
        href="/"
        className={cn(buttonVariants({ size: "lg" }), "min-h-12 px-8")}
      >
        Înapoi la pagina principală
      </Link>
    </div>
  );
}
