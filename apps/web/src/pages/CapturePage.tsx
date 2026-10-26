import { ArrowLeft, ArrowUpRight, Inbox, Plus, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { QuickCapture } from "../components/QuickCapture";

export function CapturePage() {
  return <main className="capture-page">
    <header><Link className="capture-back" to="/"><ArrowLeft />Command</Link><Link to="/knowledge?section=inbox"><Inbox />Skrzynka</Link></header>
    <section className="capture-workspace" aria-labelledby="capture-title">
      <div className="capture-heading"><span className="capture-heading-icon" aria-hidden="true"><Plus /></span><h1 id="capture-title">Szybki zapis</h1><p>Myśl, link, pomysł. Zapisz, zanim umknie.</p></div>
      <QuickCapture />
      <p className="capture-hint"><Inbox />Znajdziesz go później w Skrzynce lub wyszukiwaniu.</p>
    </section>
    <Link className="capture-setup-link" to="/settings#quick-capture"><Smartphone /><span>Dodaj skrót na iPhonie</span><ArrowUpRight /></Link>
  </main>;
}
