import { cn } from "@/lib/utils";

export type SelectProps = React.ComponentProps<"select">;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "flex h-11 w-full min-w-0 appearance-none rounded-xl border border-input bg-background-secondary/80 px-3.5 py-2 text-sm text-foreground",
        "transition-[border-color,box-shadow] duration-200 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none",
        "disabled:opacity-45",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}
