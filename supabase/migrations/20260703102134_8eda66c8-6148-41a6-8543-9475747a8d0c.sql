DROP POLICY IF EXISTS auditoria_insert_self ON public.auditoria;
REVOKE EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, jsonb) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.destinatarios_notificacion(uuid) FROM authenticated, anon, public;