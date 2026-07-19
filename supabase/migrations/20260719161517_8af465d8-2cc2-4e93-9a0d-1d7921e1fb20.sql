
-- CRÍTICO 3
DROP POLICY IF EXISTS co_ins_internos ON public.catalogo_overrides;
DROP POLICY IF EXISTS co_upd_internos ON public.catalogo_overrides;
DROP POLICY IF EXISTS co_ins_admin ON public.catalogo_overrides;
DROP POLICY IF EXISTS co_upd_admin ON public.catalogo_overrides;
CREATE POLICY co_ins_admin ON public.catalogo_overrides
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY co_upd_admin ON public.catalogo_overrides
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS cos_insert_internos ON public.catalogo_overrides_seccion;
DROP POLICY IF EXISTS cos_update_internos ON public.catalogo_overrides_seccion;
DROP POLICY IF EXISTS cos_insert_admin ON public.catalogo_overrides_seccion;
DROP POLICY IF EXISTS cos_update_admin ON public.catalogo_overrides_seccion;
CREATE POLICY cos_insert_admin ON public.catalogo_overrides_seccion
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY cos_update_admin ON public.catalogo_overrides_seccion
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- CRÍTICO 4
CREATE OR REPLACE FUNCTION public.profiles_guard_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then
    return new;
  end if;
  v_is_admin := public.has_role(v_uid, 'admin');
  if not v_is_admin then
    if new.email is distinct from old.email then
      raise exception 'No puedes modificar tu correo';
    end if;
    if new.rol is distinct from old.rol then
      raise exception 'No puedes modificar tu rol';
    end if;
    if new.estado is distinct from old.estado then
      raise exception 'No puedes modificar tu estado';
    end if;
  end if;
  return new;
end;
$function$;
