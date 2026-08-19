import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(({ className, ...props }, ref) => <select ref={ref} className={cn("flex h-10 w-full items-center rounded-md border border-input bg-secondary px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50", className)} {...props} />);
Select.displayName = "Select";
export const SelectTrigger = Select;
export const SelectValue = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export const SelectItem = ({ children, value, ...props }: React.OptionHTMLAttributes<HTMLOptionElement>) => <option value={value} {...props}>{children}</option>;
