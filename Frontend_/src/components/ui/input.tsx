import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Text input, 44px tall (D.2 preferred target size). */
export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-base text-foreground placeholder:text-muted-foreground",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
