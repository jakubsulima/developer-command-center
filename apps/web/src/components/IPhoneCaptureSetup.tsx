import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Panel } from "./ui";
export function IPhoneCaptureSetup() {
  const [message, setMessage] = useState("");
  const url = `${window.location.origin}/capture`;
  return <Panel id="quick-capture"><h2>Szybki zapis na iPhonie</h2><p>Dodaj Command do ekranu początkowego z menu Udostępnij w Safari. Otwieraj jako aplikację.</p><details><summary>Osobny skrót prosto do zapisu</summary><ol><li>W aplikacji Skróty utwórz skrót z adresem poniżej i akcją Otwórz adresy URL.</li><li>Nazwij go „Zapisz w Command”.</li><li>W szczegółach skrótu wybierz Dodaj do ekranu początkowego.</li></ol><p>Przy pierwszym otwarciu może być potrzebne logowanie w Safari.</p></details><p><Link to="/capture">Otwórz szybki zapis</Link></p><input aria-label="Adres szybkiego zapisu" readOnly value={url} onFocus={(event) => event.target.select()} /><Button onClick={() => void (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error("clipboard_unavailable"))).then(() => setMessage("Skopiowano adres.")).catch(() => setMessage("Zaznacz i skopiuj adres z pola."))}>Kopiuj adres</Button>{message ? <p role="status">{message}</p> : null}</Panel>;
}
