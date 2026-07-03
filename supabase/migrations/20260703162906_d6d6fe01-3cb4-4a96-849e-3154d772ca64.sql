-- Fix infinite recursion in RLS: has_role and is_project_member must be
-- SECURITY DEFINER so their internal SELECTs on profiles/proyecto_miembros
-- bypass RLS (otherwise profiles_select_project_peers -> proyecto_miembros
-- -> has_role -> profiles -> ... blows the stack).

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = _user_id
      AND rol = _role
      AND estado = 'activo'::public.user_estado
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_member(_uid uuid, _proyecto_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proyecto_miembros
    WHERE proyecto_id = _proyecto_id
      AND profile_id = _uid
      AND estado = 'activo'::public.miembro_estado
  );
$$;

CREATE OR REPLACE FUNCTION public.comparten_proyecto(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.proyecto_miembros ma
    JOIN public.proyecto_miembros mb ON mb.proyecto_id = ma.proyecto_id
    WHERE ma.profile_id = _a
      AND mb.profile_id = _b
      AND ma.estado = 'activo'
      AND mb.estado = 'activo'
  );
$$;

-- Keep EXECUTE restricted to server-side roles; RLS still evaluates as the
-- caller because these are used inside policies.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_project_member(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.comparten_proyecto(uuid, uuid) FROM anon, authenticated;