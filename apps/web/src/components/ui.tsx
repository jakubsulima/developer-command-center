import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

export function Button({ className = "", variant = "secondary", loading, disabled, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger"; loading?: boolean }) {
  return (
    <button className={`button button-${variant} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <LoaderCircle className="spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function Panel({ className = "", children, ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`panel ${className}`} {...props}>{children}</section>;
}

export function Badge({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function StatusDot({ tone = "info" }: { tone?: "info" | "success" | "warning" | "danger" }) {
  return <span className={`status-dot status-${tone}`} aria-hidden="true" />;
}

export function EmptyState({ icon, title, detail, action }: { icon: ReactNode; title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}

export function ListSkeleton({ rows = 3, label = "Ładowanie listy" }: { rows?: number; label?: string }) {
  return <div className="list-skeleton" role="status" aria-label={label}>{Array.from({ length: rows }, (_, index) => <div key={index}><span /><span /><span /></div>)}</div>;
}
