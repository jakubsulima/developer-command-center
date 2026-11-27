import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useAuth } from "./useAuth";
import { Button } from "../components/ui";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { runtimeConfig } from "../lib/runtime";
import { AuthLayout } from "./AuthLayout";

function AccountRecoveryHelp() {
  const projectRef = runtimeConfig.supabase
    ? new URL(runtimeConfig.supabase.url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1]
    : undefined;
  const dashboard = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/auth/users` : "https://supabase.com/dashboard/projects";

  return (
    <details className="auth-help">
      <summary>Nie pamiętam hasła</summary>
      <p>Skontaktuj się z administratorem Command i podaj adres e-mail używany do logowania.</p>
      {runtimeConfig.authSupportEmail && <a href={`mailto:${runtimeConfig.authSupportEmail}`}>Napisz do administratora</a>}
      <details>
        <summary>Dla administratora</summary>
        <p>Odszukaj konto użytkownika według adresu e-mail w sekcji Authentication → Users.</p>
        <a href={dashboard}>Otwórz panel Supabase</a>
      </details>
    </details>
  );
}

export function AuthPage({ unavailableReset = false }: { unavailableReset?: boolean }) {
  const { mode: authMode, signIn, signUp, continueInDemo } = useAuth();
  const [mode, setMode] = useState<"sign-in" | "sign-up" | "recover">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("Osobiste");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const emailInput = useRef<HTMLInputElement>(null);
  const recoveryButton = useRef<HTMLButtonElement>(null);
  const restoreRecoveryFocus = useRef(false);

  useEffect(() => {
    if (mode === "recover") emailInput.current?.focus();
    if (mode === "sign-in" && restoreRecoveryFocus.current) {
      recoveryButton.current?.focus();
      restoreRecoveryFocus.current = false;
    }
  }, [mode]);

  const changeMode = (next: typeof mode) => {
    if (next === mode) return;
    if (mode === "recover") restoreRecoveryFocus.current = true;
    if (next === "recover") {
      setPassword("");
      setShowPassword(false);
    }
    setMode(next);
    setError("");
    setSuccess("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      if (mode === "recover") {
        const { requestPasswordReset } = await import("./passwordRecovery");
        await requestPasswordReset(email.trim());
        setSuccess("Jeśli ten adres jest przypisany do konta, otrzymasz link do ustawienia nowego hasła. Otwórz go w tej samej przeglądarce.");
        return;
      }
      const result = mode === "sign-in"
        ? await signIn(email, password)
        : await signUp({ email, password, name, workspaceName });
      if (result.error) setError(result.error);
      else if (result.confirmationRequired) setSuccess("Sprawdź skrzynkę e-mail i potwierdź rejestrację.");
    } catch {
      setError(mode === "recover"
        ? "Nie udało się wysłać linku. Sprawdź połączenie i spróbuj ponownie za chwilę."
        : "Nie udało się połączyć. Spróbuj ponownie.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
        <form className="auth-form" onSubmit={submit}>
          {runtimeConfig.signupEnabled && mode !== "recover" && <div className="auth-tabs" role="tablist" aria-label="Sposób uwierzytelnienia">
            <button type="button" role="tab" disabled={loading} aria-selected={mode === "sign-in"} className={mode === "sign-in" ? "active" : ""} onClick={() => changeMode("sign-in")}>Logowanie</button>
            <button type="button" role="tab" disabled={loading} aria-selected={mode === "sign-up"} className={mode === "sign-up" ? "active" : ""} onClick={() => changeMode("sign-up")}>Nowe konto</button>
          </div>}
          <div className="auth-heading">
            <h2>{mode === "recover" ? "Odzyskaj dostęp" : mode === "sign-in" ? "Witaj ponownie" : "Utwórz prywatną przestrzeń pracy"}</h2>
            <p>{mode === "recover" ? "Podaj adres e-mail używany do logowania w Command." : mode === "sign-in" ? "Wróć dokładnie tam, gdzie przerwałeś." : "Zacznij od jednego odizolowanego miejsca na własną pracę."}</p>
          </div>

          {mode === "sign-up" && <>
            <Label htmlFor="auth-name">Imię i nazwisko</Label>
            <Input id="auth-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            <Label htmlFor="workspace-name">Nazwa przestrzeni pracy</Label>
            <Input id="workspace-name" value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} required />
          </>}
          <Label htmlFor="auth-email">Adres e-mail</Label>
          <div className="input-with-icon"><Mail /><Input ref={emailInput} id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
          {mode !== "recover" && <>
            <Label htmlFor="auth-password">Hasło</Label>
            <div className="input-with-icon"><LockKeyhole /><Input id="auth-password" type={showPassword ? "text" : "password"} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /><button type="button" onClick={() => setShowPassword((shown) => !shown)} aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
          </>}

          {unavailableReset && <p className="auth-message error" role="alert">Odzyskiwanie hasła przez link jest wyłączone dla tej przestrzeni. Skorzystaj z pomocy „Nie pamiętam hasła”.</p>}
          {error && <p className="auth-message error" role="alert">{error}</p>}
          {success && <p className="auth-message success" role="status">{success}</p>}
          <Button type="submit" variant="primary" className="auth-submit" loading={loading}>{mode === "recover" ? "Wyślij link do zmiany hasła" : mode === "sign-in" ? "Zaloguj się" : "Utwórz konto"}<ArrowRight /></Button>
          {mode === "sign-in" && authMode === "supabase" && ((runtimeConfig.passwordResetEnabled ?? runtimeConfig.signupEnabled)
            ? <button ref={recoveryButton} type="button" className="auth-help" disabled={loading} onClick={() => changeMode("recover")}>Nie pamiętam hasła</button>
            : <AccountRecoveryHelp />)}
          {mode === "recover" && <Button type="button" variant="ghost" className="auth-help" disabled={loading} onClick={() => changeMode("sign-in")}>Wróć do logowania</Button>}
          {mode !== "recover" && runtimeConfig.demoEnabled && <>
            <div className="auth-divider"><span>lub</span></div>
            <Button type="button" onClick={continueInDemo}>Otwórz wersję demonstracyjną</Button>
            <p className="auth-footnote">Wersja demo zapisuje dane wyłącznie w tej przeglądarce.</p>
          </>}
        </form>
    </AuthLayout>
  );
}
