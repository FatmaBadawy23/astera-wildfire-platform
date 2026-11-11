import type { ComponentProps } from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Sizes: default/lg meet the 44px preferred target; sm/icon-sm meet the 24px WCAG 2.5.8 minimum (D.2 §9).
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-colors duration-[var(--aw-duration-fast)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border border-border-strong bg-surface text-foreground hover:bg-surface-raised",
        ghost: "text-foreground hover:bg-surface-raised",
        danger: "bg-danger text-white hover:bg-danger/90 dark:text-background",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 text-sm",
        sm: "h-8 px-3 text-sm",
        lg: "h-12 px-6 text-base",
        icon: "size-11",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
