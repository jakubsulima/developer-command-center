import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { AuthLayout } from "./AuthLayout";
import { passwordResetPath } from "./auth-context";
import { openPasswordRecovery } from "./passwordRecovery";

type Recovery = Awaited<ReturnType<typeof openPasswordRecovery>>;
type RecoveryState = "opening" | "ready" | "invalid" | "saved";

export default function PasswordResetPage() {
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const [callback] = useState(() => {
    const params = new URLSearchParams(search);
    return { code: params.get("code"), flowId: params.get("sb_flow_id") ?? undefined, hasParameters: Boolean(search || hash) };
  });
  const [status, setStatus] = useState<RecoveryState>(callback.code ? "opening" : "invalid");
  const incomingRecovery = useRef<Promise<Recovery> | null>(null);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const passwordInput = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (callback.hasParameters) void navigate(passwordResetPath, { replace: true });
  }, [callback, navigate]);

  useEffect(() => {
    if (!callback.code) return;
    let active = true;
    incomingRecovery.current ??= openPasswordRecovery(callback.code, callback.flowId);
    void incomingRecovery.current.then((session) => {
      if (!active) return;
      setRecovery(session);
      setStatus("ready");
    }, () => { if (active) setStatus("invalid"); });
    return () => { active = false; };
  }, [callback]);

  useEffect(() => {
    if (status === "ready") passwordInput.current?.focus();
    else heading.current?.focus();
  }, [status]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!recovery || busy) return;
    if (password !== confirmation) {
      setError("Wpisane hasła muszą być takie same.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await recovery.updatePassword(password);
      if (result === "password") setError("Wybierz nowe, silniejsze hasło.");
      if (result === "retry") setError("Nie udało się zapisać hasła. Spróbuj ponownie.");
      if (result === "saved" || result === "expired") {
        setRecovery(null);
        setPassword("");
        setConfirmation("");
        setStatus(result === "saved" ? "saved" : "invalid");
      }
    } catch {
      setError("Nie udało się zapisać hasła. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={(event) => void submit(event)}>
        <div className="auth-heading">
          <h2 ref={heading} tabIndex={-1}>{status === "saved" ? "Hasło zostało zmienione" : "Ustaw nowe hasło"}</h2>
          {status === "ready" && <p>Wpisz nowe hasło. Użyj co najmniej 8 znaków.</p>}
          {status === "saved" && <p>Zaloguj się do Command przy użyciu nowego hasła.</p>}
        </div>
        {status === "opening" && <p role="status">Sprawdzanie linku do zmiany hasła…</p>}
        {status === "invalid" && <p className="auth-message error" role="alert">Link wygasł, został użyty lub pochodzi z innej przeglądarki. Poproś o nowy link na ekranie logowania.</p>}
        {status === "ready" && <>
          <Label htmlFor="new-password">Nowe hasło</Label>
          <Input ref={passwordInput} id="new-password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
          <Label htmlFor="confirm-password">Powtórz nowe hasło</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required />
          {error && <p className="auth-message error" role="alert">{error}</p>}
          <Button type="submit" variant="primary" className="auth-submit" loading={busy}>Zapisz nowe hasło</Button>
        </>}
        {status !== "opening" && <Link className="auth-help" to="/" replace>Wróć do logowania</Link>}
      </form>
    </AuthLayout>
  );
}
