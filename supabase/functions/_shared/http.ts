export const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
  "access-control-allow-methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" } });
}

export function errorResponse(code: string, message: string, status: number, retryAfter?: number) {
  const response = jsonResponse({ error: { code, message } }, status);
  if (retryAfter) response.headers.set("retry-after", String(retryAfter));
  return response;
}
