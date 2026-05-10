import { cn } from "@/lib/utils";

export type InputProps = React.ComponentProps<"input">;

/** Analytical input - matches glass card system */
export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full min-w-0 rounded-xl border border-input bg-background-secondary/80 px-3.5 py-2 text-sm text-foreground",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        "placeholder:text-foreground-muted transition-[border-color,box-shadow] duration-200",
        "focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-45",
        className,
      )}
      {...props}
    />
  );
}
