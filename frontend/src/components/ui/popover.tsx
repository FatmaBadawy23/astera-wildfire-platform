import type { ComponentProps } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;

/**
 * Non-modal popover (Radix): opens on click/Enter/Space, closes on Esc or outside click and returns focus
 * to its trigger. Rendered in a portal on the popover layer.
 */
export function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "z-[var(--aw-z-overlay)] w-80 max-w-[calc(100vw-24px)] rounded-lg border border-border-strong bg-surface p-4 text-sm text-foreground shadow-lg",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
