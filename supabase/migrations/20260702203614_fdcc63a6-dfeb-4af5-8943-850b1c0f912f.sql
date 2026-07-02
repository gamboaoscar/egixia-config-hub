
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.registrar_auditoria(text, text, text, jsonb) from public, anon;
-- profiles_guard_privileged_fields is a trigger function; no direct callers
revoke execute on function public.profiles_guard_privileged_fields() from public, anon;
