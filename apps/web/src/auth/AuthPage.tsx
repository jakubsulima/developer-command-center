import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Sparkles, TerminalSquare } from "lucide-react";
import { useAuth } from "./useAuth";
import { Button } from "../components/ui";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { runtimeConfig } from "../lib/runtime";

export function AuthPage() {
  const { signIn, signUp, continueInDemo } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Osobiste");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    const result = mode === "sign-in"
      ? await signIn(email, password)
      : await signUp({ email, password, name, workspaceName });
    setLoading(false);
    if (result.error) setError(result.error);
    else if (result.confirmationRequired) setSuccess("Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span><TerminalSquare /></span>Command</div>
        <div>
          <span className="auth-kicker"><Sparkles />Developer Command Center</span>
          <h1>Odzyskaj kontekst.<br />Doprowadzaj rzeczy do wyniku.</h1>
          <p>Jedno spokojne centrum dla Celów, Działań i Wiedzy — bez konkurujących list i produktywnościowej grywalizacji.</p>
          <ol>
            <li><Check />Przechwyć bez klasyfikowania</li>
            <li><Check />Wybierz jeden konkretny krok</li>
            <li><Check />Zapisuj postęp i wiedzę przy swoich Celach</li>
          </ol>
        </div>
        <small>Dane każdego Workspace są odizolowane przez PostgreSQL RLS.</small>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          {runtimeConfig.signupEnabled && <div className="auth-tabs" role="tablist" aria-label="Sposób uwierzytelnienia">
            <button type="button" role="tab" aria-selected={mode === "sign-in"} className={mode === "sign-in" ? "active" : ""} onClick={() => { setMode("sign-in"); setError(""); }}>Logowanie</button>
            <button type="button" role="tab" aria-selected={mode === "sign-up"} className={mode === "sign-up" ? "active" : ""} onClick={() => { setMode("sign-up"); setError(""); }}>Nowe konto</button>
          </div>}
          <div className="auth-heading"><h2>{mode === "sign-in" ? "Witaj ponownie" : "Utwórz prywatny Workspace"}</h2><p>{mode === "sign-in" ? "Wróć dokładnie tam, gdzie przerwałeś." : "Zacznij od jednego odizolowanego miejsca na własną pracę."}</p></div>

          {mode === "sign-up" && <>
            <Label htmlFor="auth-name">Imię i nazwisko</Label>
            <Input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Label htmlFor="workspace-name">Nazwa Workspace</Label>
            <Input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required />
          </>}
          <Label htmlFor="auth-email">Adres e-mail</Label>
          <div className="input-with-icon"><Mail /><Input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          <Label htmlFor="auth-password">Hasło</Label>
          <div className="input-with-icon"><LockKeyhole /><Input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>

          {error && <p className="auth-message error" role="alert">{error}</p>}
          {success && <p className="auth-message success" role="status">{success}</p>}
          <Button variant="primary" className="auth-submit" loading={loading}>{mode === "sign-in" ? "Zaloguj się" : "Utwórz konto"}<ArrowRight /></Button>
          {runtimeConfig.demoEnabled && <>
            <div className="auth-divider"><span>lub</span></div>
            <Button type="button" onClick={continueInDemo}>Otwórz wersję demonstracyjną</Button>
            <p className="auth-footnote">Wersja demo zapisuje dane wyłącznie w tej przeglądarce.</p>
          </>}
        </form>
      </section>
    </main>
  );
}
