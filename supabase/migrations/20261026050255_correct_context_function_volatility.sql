-- JSON construction calls STABLE PostgreSQL functions. Keep the helper's
-- volatility consistent with its callees and the context-export RPC.
alter function private.bound_context_json(jsonb, integer) stable;
