import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "button inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "button-primary border-primary bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "button-secondary border-border bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "button-ghost border-transparent bg-transparent text-secondary-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "button-danger border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
      },
      size: {
        default: "h-10",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-md px-5",
        icon: "size-10 px-0"
      }
    },
    defaultVariants: { variant: "secondary", size: "default" }
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  if (asChild) {
    const child = React.Children.only(props.children) as React.ReactElement<{ className?: string; ref?: React.Ref<HTMLElement> }>;
    return React.cloneElement(child, { className: cn(buttonVariants({ variant, size, className }), child.props.className), ref: ref as React.Ref<HTMLElement> });
  }
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
