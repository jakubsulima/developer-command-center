import { useStore } from "../app/useStore";
import { useWorkspaceInfinitePage } from "../hooks/useWorkspaceInfinitePage";
import type { KnowledgeItem } from "../domain/types";
import { Button } from "./ui";

export function KnowledgeSourceField({ id, value, label, onChange }: { id: string; value?: string; label?: string; onChange: (id: string | undefined) => void }) {
  const { state } = useStore();
  const page = useWorkspaceInfinitePage<KnowledgeItem>("knowledge", 50, { resourceFormat: "book" });
  const books = [...new Map([...(page.data?.items ?? []), ...state.knowledge].map((item) => [item.id, item])).values()].filter((item) => item.resourceFormat === "book" && !item.trashedAt && !item.archivedAt);
  return <><label className="field-label" htmlFor={id}>Źródłowa książka <span className="optional-label">opcjonalnie</span></label><select id={id} value={value ?? ""} onChange={(event) => onChange(event.target.value || undefined)}><option value="">Bez źródła</option>{value && !books.some((book) => book.id === value) ? <option value={value}>{label ?? state.knowledge.find((book) => book.id === value)?.title ?? `Wybrane źródło: ${value}`}</option> : null}{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select>{page.hasNextPage ? <Button type="button" variant="ghost" loading={page.isFetchingNextPage} onClick={() => void page.fetchNextPage()}>Załaduj kolejne książki</Button> : null}{page.isError ? <p role="alert">Nie udało się pobrać książek. <Button type="button" onClick={() => void page.refetch()}>Ponów pobranie książek</Button></p> : null}</>;
}
