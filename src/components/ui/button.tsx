import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        secondary: "bg-surface text-fg border border-line hover:bg-raised",
        ghost: "text-muted hover:text-fg hover:bg-raised",
        danger: "bg-danger text-white hover:opacity-90",
        link: "text-accent underline-offset-2 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-7 rounded-md px-2.5 text-sm",
        md: "h-9 rounded-md px-3.5 text-base",
        lg: "h-11 rounded-lg px-5 text-base",
        icon: "size-8 rounded-md",
        iconSm: "size-7 rounded-md",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
