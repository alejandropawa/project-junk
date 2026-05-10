import { cn } from "@/lib/utils";

type SectionProps = React.ComponentProps<"section"> & {
  size?: "default" | "lg";
  contained?: boolean;
  wide?: boolean;
};

export function Section({
  className,
  size = "default",
  contained = true,
  wide,
  ...props
}: SectionProps) {
  return (
    <section
      className={cn(
        size === "lg" ? "pb-section-y-lg" : "pb-section-y",
        contained &&
          cn("pb-container", wide && "pb-container-wide", "mx-auto @container"),
        className,
      )}
      {...props}
    />
  );
}
