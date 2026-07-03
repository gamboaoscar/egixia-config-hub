-- Lock down SECURITY DEFINER helpers so they cannot be invoked as RPC by
-- anonymous or signed-in users. They stay usable by RLS policy evaluation
-- (which does not require the caller to hold EXECUTE on the referenced
-- function) and by trusted server code running as service_role.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.destinatarios_notificacion(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.destinatarios_notificacion(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.validar_invitacion(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.validar_invitacion(text) TO service_role;

REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, jsonb) TO service_role;