import { Button } from "./ui";

export function DraftConflictNotice({ onCopy, onOpenCurrent }: { onCopy: () => void; onOpenCurrent: () => void }) {
  return <div className="draft-conflict" role="alert">
    <strong>Ten rekord zmienił się na serwerze.</strong>
    <p>Twój lokalny szkic pozostał zachowany. Porównaj go z aktualnym rekordem i zdecyduj ręcznie — nie scalimy ani nie nadpiszemy treści automatycznie.</p>
    <div className="draft-conflict-actions"><Button type="button" onClick={onCopy}>Kopiuj mój szkic</Button><Button type="button" variant="ghost" onClick={onOpenCurrent}>Otwórz aktualny rekord</Button></div>
  </div>;
}
