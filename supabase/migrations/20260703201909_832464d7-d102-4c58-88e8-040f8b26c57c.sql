CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  _accion text,
  _entidad text,
  _entidad_id text,
  _detalle jsonb,
  _actor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_id uuid;
begin
  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (coalesce(_actor_id, auth.uid()), _accion, _entidad, _entidad_id, _detalle)
  returning id into v_id;
  return v_id;
end;
$function$;