-- B1: guard de tipo jsonb en auditar_datos_modulo.
-- `jsonb_object_keys` lanza error si OLD.datos o NEW.datos no son un
-- objeto JSON (p. ej. un escalar o un array guardado por error), lo que
-- haría fallar el UPDATE completo del módulo. Si `datos` no es un objeto,
-- se retorna NEW sin auditar.
CREATE OR REPLACE FUNCTION public.auditar_datos_modulo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_actor uuid := auth.uid();
  v_campos text[];
begin
  -- Guard: si OLD.datos o NEW.datos no son objetos jsonb, no auditamos.
  if jsonb_typeof(coalesce(OLD.datos, '{}'::jsonb)) <> 'object'
     or jsonb_typeof(coalesce(NEW.datos, '{}'::jsonb)) <> 'object' then
    return new;
  end if;

  if v_actor is null then
    return new;
  end if;

  select coalesce(array_agg(k order by k), array[]::text[])
    into v_campos
  from (
    select k
    from (
      select jsonb_object_keys(coalesce(old.datos, '{}'::jsonb)) as k
      union
      select jsonb_object_keys(coalesce(new.datos, '{}'::jsonb)) as k
    ) s
    where coalesce(old.datos, '{}'::jsonb)->k is distinct from coalesce(new.datos, '{}'::jsonb)->k
  ) t;

  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (
    v_actor,
    'modulo_datos_actualizados',
    'proyecto_modulo',
    new.id::text,
    jsonb_build_object(
      'proyecto_id', new.proyecto_id,
      'modulo_key', new.modulo_key,
      'campos_modificados', v_campos,
      'progreso', new.progreso
    )
  );
  return new;
end;
$$;
