
-- a) Auditoría de cambios en proyecto_modulos.datos (solo cuando hay auth.uid)
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

DROP TRIGGER IF EXISTS proyecto_modulos_auditar_datos ON public.proyecto_modulos;
CREATE TRIGGER proyecto_modulos_auditar_datos
AFTER UPDATE ON public.proyecto_modulos
FOR EACH ROW
WHEN (OLD.datos IS DISTINCT FROM NEW.datos)
EXECUTE FUNCTION public.auditar_datos_modulo();

-- b) Auditoría de archivos subidos
CREATE OR REPLACE FUNCTION public.auditar_archivo_subido()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (
    coalesce(auth.uid(), new.created_by),
    'archivo_subido',
    'archivo',
    new.id::text,
    jsonb_build_object(
      'nombre_original', new.nombre_original,
      'campo_key', new.campo_key,
      'proyecto_modulo_id', new.proyecto_modulo_id,
      'tamano', new.tamano
    )
  );
  return new;
end;
$$;

DROP TRIGGER IF EXISTS archivos_auditar_subida ON public.archivos;
CREATE TRIGGER archivos_auditar_subida
AFTER INSERT ON public.archivos
FOR EACH ROW
EXECUTE FUNCTION public.auditar_archivo_subido();

-- c) Auditoría de actas generadas
CREATE OR REPLACE FUNCTION public.auditar_acta_generada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.auditoria (actor_id, accion, entidad, entidad_id, detalle)
  values (
    coalesce(auth.uid(), new.generada_por),
    'acta_generada',
    'acta',
    new.id::text,
    jsonb_build_object(
      'proyecto_modulo_id', new.proyecto_modulo_id,
      'version', new.version,
      'archivo_url', new.archivo_url
    )
  );
  return new;
end;
$$;

DROP TRIGGER IF EXISTS actas_auditar_generacion ON public.actas;
CREATE TRIGGER actas_auditar_generacion
AFTER INSERT ON public.actas
FOR EACH ROW
EXECUTE FUNCTION public.auditar_acta_generada();
