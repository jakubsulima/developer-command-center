import { cva, type VariantProps } from "class-variance-authority";

export const mobileSheetVariants = cva("w-full overflow-y-auto rounded-t-2xl border border-border bg-popover shadow-2xl", {
  variants: { side: { bottom: "max-h-[calc(100dvh-1rem)]", top: "max-h-[calc(100dvh-1rem)] rounded-b-2xl rounded-t-none" } },
  defaultVariants: { side: "bottom" }
});

export const entityCardVariants = cva("relative min-w-0 rounded-xl border border-border bg-card", {
  variants: { density: { default: "p-4", compact: "p-3" } },
  defaultVariants: { density: "default" }
});

export const stickyFormActionsVariants = cva("sticky z-10 flex gap-2 border-t border-border bg-popover/95", {
  variants: { align: { end: "justify-end", stretch: "[&>.button]:flex-1" } },
  defaultVariants: { align: "end" }
});

export const compactTabsVariants = cva("flex min-w-0 gap-1 overflow-x-auto", {
  variants: { fullWidth: { true: "[&>button]:flex-1", false: "" } },
  defaultVariants: { fullWidth: false }
});

export type MobileSheetVariantProps = VariantProps<typeof mobileSheetVariants>;
