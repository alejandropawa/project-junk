import { cn } from "@/lib/utils";

type CardProps = React.ComponentProps<"div"> & {
  hover?: boolean;
  staticSurface?: boolean;
};

export function Card({
  className,
  hover = true,
  staticSurface,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        hover && !staticSurface ? "pb-card" : "pb-card-static",
        className,
      )}
      {...props}
    />
  );
}
