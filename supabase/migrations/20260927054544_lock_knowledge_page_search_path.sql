-- Keep the invoker function's name resolution independent of caller-writable schemas.
alter function public.get_knowledge_page(uuid, integer, text, uuid, text, text, text, text)
  set search_path = '';
