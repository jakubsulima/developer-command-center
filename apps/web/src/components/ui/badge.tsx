import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("badge inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors", {
  variants: {
    variant: {
      default: "badge-info border-transparent bg-primary/15 text-primary",
      secondary: "badge-neutral border-transparent bg-secondary text-secondary-foreground",
      destructive: "badge-danger border-transparent bg-destructive/15 text-destructive",
      outline: "border-border text-foreground",
      success: "badge-success border-transparent bg-success/15 text-success",
      warning: "badge-warning border-transparent bg-warning/15 text-warning"
    }
  },
  defaultVariants: { variant: "default" }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}
export function Badge({ className, variant, ...props }: BadgeProps) { return <div className={cn(badgeVariants({ variant }), className)} {...props} />; }
