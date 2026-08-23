import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@myslot/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none disabled:opacity-50 press",
  {
    variants: {
      variant: {
        primary: "bg-primary text-white hover:bg-primary-hover shadow-soft",
        secondary: "bg-surface text-ink border border-border hover:bg-surface-2",
        ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
        destructive: "bg-error text-white hover:bg-error/90",
        outline: "border border-primary text-primary hover:bg-primary-light",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-6 text-sm",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
        block: "h-12 w-full px-6 text-base"
      }
    },
    defaultVariants: { variant: "primary", size: "md" }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({ className, variant, size, loading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

export { buttonVariants };