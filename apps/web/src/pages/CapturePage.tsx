import { ArrowLeft, Inbox, Plus, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { CommandBrand } from "../components/CommandBrand";
import { QuickCapture } from "../components/QuickCapture";
import { useState } from "react";

export function CapturePage() {
  const [saving, setSaving] = useState(false);
  return <main className="capture-page" aria-busy={saving} onClickCapture={(event) => { if (saving && event.target instanceof Element && event.target.closest("a")) { event.preventDefault(); event.stopPropagation(); } }}>
    <header><Link className="capture-back" to="/"><CommandBrand /></Link><Link to="/knowledge?section=inbox"><Inbox />Skrzynka</Link></header>
    <section className="capture-workspace" aria-labelledby="capture-title">
      <div className="capture-heading"><span className="capture-heading-icon" aria-hidden="true"><Plus /></span><h1 id="capture-title">Szybki zapis</h1><p>Myśl, link, pomysł. Zapisz, zanim umknie.</p></div>
      <QuickCapture onSavingChange={setSaving} />
      <p className="capture-hint"><Inbox />Zapisane myśli znajdziesz w Skrzynce i w wynikach wyszukiwania.</p>
    </section>
    <Link className="capture-setup-link" to="/"><ArrowLeft aria-hidden="true" /><span>Wróć do Startu</span></Link>
    <Link className="capture-setup-link" to="/settings#quick-capture"><Smartphone /><span>Dodaj skrót na iPhonie</span></Link>
  </main>;
}
