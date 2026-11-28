import type { ReactNode } from "react";
import { Check, Sparkles, TerminalSquare } from "lucide-react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span><TerminalSquare /></span>Command</div>
        <div>
          <span className="auth-kicker"><Sparkles />Developer Command Center</span>
          <h1>Odzyskaj kontekst.<br />Doprowadzaj rzeczy do wyniku.</h1>
          <p>Projekty, grupy działań, działania i wiedza w jednej przestrzeni.</p>
          <ol>
            <li><Check />Przechwyć bez klasyfikowania</li>
            <li><Check />Wybierz jeden konkretny krok</li>
            <li><Check />Zapisuj postęp i wiedzę przy swoich grupach działań</li>
          </ol>
        </div>
        <small>Dane każdej przestrzeni pracy są odizolowane przez PostgreSQL RLS.</small>
      </section>
      <section className="auth-form-wrap">{children}</section>
    </main>
  );
}
