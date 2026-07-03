GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) TO anon, authenticated;