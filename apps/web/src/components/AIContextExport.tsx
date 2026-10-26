import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { buildContextBundle, renderContextMarkdown, type ContextRequest } from "../../../../packages/ai-context/src/index";
import { useStore } from "../app/useStore";
import { loadContextData } from "../data/aiContextRepository";
import { contextBundleFromData } from "../domain/aiContext";
import { createSupabaseWorkspaceRepository } from "../data/supabaseWorkspaceRepository";
import { Modal } from "./Modal";
import { Button } from "./ui";
export function AIContextExport({ target }: { target: ContextRequest["target"] }) {
  const [open,setOpen] = useState(false);
  return <><Button variant="ghost" onClick={() => setOpen(true)}>Przekaż kontekst do AI</Button><Modal open={open} title="Kontekst do AI" onClose={() => setOpen(false)} className="ai-context-modal">{open ? <AIContextPanel target={target} /> : null}</Modal></>;
}
function AIContextPanel({ target }: { target: ContextRequest["target"] }) {
    const { state, mode } = useStore();
    const [intent,setIntent] = useState("");
    const [selection,setSelection] = useState<ContextRequest["selection"]>({ includeProject:true,includeGoal:true,includeProgress:true,includeKnowledge:true,extraKnowledgeIds:[],excludedSourceIds:[] });
    const [excluded,setExcluded] = useState<string[]>([]);
    const [format,setFormat] = useState<"markdown" | "json">("markdown");
    const [message,setMessage] = useState("");
    const [search,setSearch] = useState("");
    const [searchText,setSearchText] = useState("");
    const request = useMemo<ContextRequest>(() => ({ target: { type: target.type, id: target.id }, selection }), [selection, target.id, target.type]);
    const query = useQuery({ queryKey:["ai-context",mode,state.workspaceId,target.type,target.id,selection], queryFn:()=>loadContextData(state,mode,request), staleTime:0 });
    const results = useQuery({ queryKey:["ai-context-knowledge-search",mode,state.workspaceId,searchText], enabled:searchText.trim().length>=2, queryFn:async () => mode === "demo" ? state.knowledge.filter((item) => !item.archivedAt && !item.trashedAt && `${item.title} ${item.detail}`.toLocaleLowerCase().includes(searchText.trim().toLocaleLowerCase())).slice(0,10).map((item)=>({ id:item.id,title:item.title,type:"knowledge" })) : (await createSupabaseWorkspaceRepository().search(searchText,20)).filter((item)=>item.type==="knowledge") });
    const { bundle, text, error, allSources } = useMemo(() => {
      try {
        if (!query.data) return { bundle: undefined, text: "", error: "", allSources: [] };
        const original = contextBundleFromData(query.data,{ ...request,intent },new Date(query.dataUpdatedAt).toISOString());
        const bundle = buildContextBundle({ ...request,intent,selection:{ ...request.selection,excludedSourceIds:excluded } },{ workspaceId:original.workspaceId,sections:original.sections,omissions:original.omissions },original.generatedAt);
        const text = format === "markdown" ? renderContextMarkdown(bundle) : JSON.stringify(bundle,null,2);
        if (new TextEncoder().encode(text).byteLength > 256*1024) throw new Error("Pakiet przekracza limit 256 KiB. Zmniejsz wybór źródeł.");
        return { bundle, text, error: "", allSources: original.sources };
      } catch (cause) {
        return { bundle: undefined, text: "", error: cause instanceof Error ? cause.message : "Nie udało się zbudować pakietu.", allSources: [] };
      }
    }, [query.data, query.dataUpdatedAt, request, intent, excluded, format]);
    const download = () => {
      if (!text) return;
      const url = URL.createObjectURL(new Blob([text],{type:format==="markdown"?"text/markdown;charset=utf-8":"application/json"}));
      const anchor = document.createElement("a"); anchor.href=url; anchor.download=`command-${target.type}-${target.id}.${format==="markdown"?"md":"json"}`; anchor.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    };
    return <div className="ai-context-body" data-modal-scroll-body><p>Wybierz źródła i sprawdź podgląd. Kopiowanie lub pobranie tworzy pakiet, który możesz przekazać wybranemu AI.</p><label className="field-label" htmlFor="ai-context-intent">Co AI ma pomóc zrobić?</label><textarea id="ai-context-intent" maxLength={2000} rows={2} value={intent} onChange={(event)=>setIntent(event.target.value)} />
      <fieldset><legend>Zakres źródeł</legend>{([['includeProject','Projekt'],['includeGoal','Cele'],['includeProgress','Postęp'],['includeKnowledge','Wiedza']] as const).map(([key,label])=><label className="checkbox-field" key={key}><input type="checkbox" checked={selection[key]} disabled={key==="includeProject"&&target.type==="project"||key==="includeGoal"&&target.type==="goal"} onChange={(event)=>setSelection((current)=>({ ...current,[key]:event.target.checked }))}/>{label}</label>)}</fieldset>
      {selection.includeKnowledge ? <details><summary>Dodaj inne źródło z Biblioteki ({selection.extraKnowledgeIds.length}/10)</summary><label htmlFor="ai-context-search">Tytuł lub treść</label><div className="button-row"><input id="ai-context-search" value={search} onChange={(event)=>setSearch(event.target.value)}/><Button onClick={()=>setSearchText(search)}>Szukaj</Button></div>{results.isError?<p role="alert">Nie udało się wyszukać źródeł. <Button onClick={()=>void results.refetch()}>Ponów</Button></p>:null}{results.data?.map((item)=><label className="checkbox-field" key={item.id}><input type="checkbox" checked={selection.extraKnowledgeIds.includes(item.id)} disabled={selection.extraKnowledgeIds.length>=10&&!selection.extraKnowledgeIds.includes(item.id)} onChange={(event)=>setSelection((current)=>({ ...current,extraKnowledgeIds:event.target.checked?[...current.extraKnowledgeIds,item.id]:current.extraKnowledgeIds.filter((id)=>id!==item.id) }))}/>{item.title}</label>)}</details>:null}
      {query.isPending?<p role="status">Wczytywanie aktualnych źródeł…</p>:null}{query.isError?<p role="alert">{query.error.message} <Button onClick={()=>void query.refetch()}>Spróbuj ponownie</Button></p>:null}{error?<p role="alert">{error}</p>:null}
      {bundle&&!error?<><details><summary>Źródła pakietu ({bundle.sources.length})</summary>{allSources.map((source)=><label className="checkbox-field" key={source.key}><input type="checkbox" disabled={source.key===`${target.type}:${target.id}`} checked={!excluded.includes(source.key)} onChange={(event)=>setExcluded((current)=>event.target.checked?current.filter((key)=>key!==source.key):[...current,source.key])}/>{source.title}</label>)}</details><p role="status">{bundle.completeness==="limited"?"Pakiet ograniczony — sprawdź pominięcia w podglądzie.":"Kompletny pakiet w wybranym zakresie."}</p><label className="field-label" htmlFor="ai-context-format">Format</label><select id="ai-context-format" value={format} onChange={(event)=>setFormat(event.target.value as "markdown"|"json")}><option value="markdown">Markdown</option><option value="json">JSON</option></select><label className="field-label" htmlFor="ai-context-preview">Podgląd finalnej treści</label><textarea id="ai-context-preview" className="ai-context-preview" readOnly rows={10} value={text}/><div className="button-row"><Button disabled={!text||query.isFetching} onClick={()=>void (async()=>{ try { if (!navigator.clipboard) throw new Error("clipboard_unavailable"); await navigator.clipboard.writeText(text); setMessage("Skopiowano pakiet."); } catch { setMessage("Schowek jest niedostępny. Pobierz plik lub zaznacz treść podglądu."); } })()}>Kopiuj</Button><Button disabled={!text||query.isFetching} onClick={download}>Pobierz plik</Button><Button variant="ghost" onClick={()=>void query.refetch()}>Odśwież źródła</Button></div></>:null}{message?<p role="status">{message}</p>:null}
    </div>;
  }
