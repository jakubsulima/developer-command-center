import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { Button as ShadcnButton, type ButtonProps as ShadcnButtonProps } from "./ui/button";
import { Card } from "./ui/card";
import { Badge as ShadcnBadge } from "./ui/badge";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

type LegacyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & Omit<ShadcnButtonProps, "variant"> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean };

export function Button({ className = "", variant = "secondary", loading, disabled, children, ...props }: LegacyButtonProps) {
  const mappedVariant = variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant;
  return (
    <ShadcnButton className={cn(`button button-${variant}`, className)} variant={mappedVariant} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="spin" aria-hidden="true" />}
      {children}
    </ShadcnButton>
  );
}

export function Panel({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <Card className={cn("panel", className)} {...props}>{children}</Card>;
}

export function Badge({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  const variant = tone === "info" ? "default" : tone === "danger" ? "destructive" : tone === "neutral" ? "secondary" : tone;
  return <ShadcnBadge className={`badge badge-${tone}`} variant={variant}>{children}</ShadcnBadge>;
}

export function StatusDot({ tone = "info" }: { tone?: "info" | "success" | "warning" | "danger" }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

export function EmptyState({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state flex min-h-72 flex-col items-center justify-center p-8 text-center">
      <span className="empty-icon mb-3.5 grid size-14 place-items-center rounded-full bg-secondary text-ring">{icon}</span>
      <h3 className="mb-1.5 text-lg font-semibold">{title}</h3>
      <p className="max-w-[420px] text-sm text-muted-foreground">{detail}</p>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 3, label = "Ładowanie listy" }: { rows?: number; label?: string }) {
  return <div className="list-skeleton grid gap-3 py-3" role="status" aria-label={label}>{Array.from({ length: rows }, (_, index) => <div className="grid min-h-20 grid-cols-[38px_minmax(0,1fr)_110px] items-center gap-3.5 rounded-lg border border-border p-3.5" key={index}><Skeleton className="size-9 rounded-full" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-full" /></div>)}</div>;
}
