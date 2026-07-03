GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.destinatarios_notificacion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_auditoria(text, text, text, jsonb) TO authenticated;