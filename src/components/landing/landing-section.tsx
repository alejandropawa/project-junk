import { cn } from "@/lib/utils";

type LandingSectionProps = React.ComponentProps<"section"> & {
  /** Extra vertical rhythm for major bands */
  band?: "default" | "hero" | "tight";
};

export function LandingSection({
  className,
  band = "default",
  children,
  ...props
}: LandingSectionProps) {
  return (
    <section
      className={cn(
        "mx-auto w-full max-w-none px-5 sm:px-6 md:px-10",
        band === "hero" && "pt-24 pb-16 md:pt-32 md:pb-24",
        band === "default" && "py-16 md:py-24",
        band === "tight" && "py-14 md:py-20",
        className,
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-[min(100%,max(72rem,58vw))]">{children}</div>
    </section>
  );
}
