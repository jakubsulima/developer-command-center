import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsContextValue { value?: string; onValueChange?: (value: string) => void; }
const TabsContext = React.createContext<TabsContextValue>({});

export function Tabs({ value, defaultValue, onValueChange, className, children, ...props }: React.HTMLAttributes<HTMLDivElement> & { value?: string; defaultValue?: string; onValueChange?: (value: string) => void }) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const selectedValue = value ?? internalValue;
  const change = (nextValue: string) => { if (value === undefined) setInternalValue(nextValue); onValueChange?.(nextValue); };
  return <TabsContext.Provider value={{ value: selectedValue, onValueChange: change }}><div className={className} {...props}>{children}</div></TabsContext.Provider>;
}

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" className={cn("inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-border bg-secondary/70 p-1 text-muted-foreground", className)} {...props} />;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string; role?: "tab" | "button" }>(({ className, value, role = "tab", onClick, children, ...props }, ref) => {
  const context = React.useContext(TabsContext);
  const active = context.value === value;
  return <button ref={ref} type="button" role={role} aria-selected={role === "tab" ? active : undefined} aria-pressed={role === "button" ? active : undefined} data-state={active ? "active" : "inactive"} className={cn("inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm", className)} onClick={(event) => { context.onValueChange?.(value); onClick?.(event); }} {...props}>{children}</button>;
});
TabsTrigger.displayName = "TabsTrigger";

export function TabsContent({ value, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { value: string }) {
  const context = React.useContext(TabsContext);
  if (context.value !== value) return null;
  return <div role="tabpanel" className={cn("mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)} {...props} />;
}
