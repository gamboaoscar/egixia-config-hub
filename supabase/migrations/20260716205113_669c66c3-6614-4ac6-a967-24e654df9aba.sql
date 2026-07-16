
ALTER TABLE public.proyecto_modulos ADD COLUMN IF NOT EXISTS updated_por uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.proyecto_modulos_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Auto-transición: sin_iniciar -> en_diligenciamiento cuando hay progreso.
  IF OLD.estado = 'sin_iniciar'::public.modulo_estado
     AND COALESCE(NEW.progreso, 0) > 0
     AND NEW.estado = OLD.estado THEN
    NEW.estado := 'en_diligenciamiento'::public.modulo_estado;
  END IF;

  -- Actualizar timestamp/autor cuando cambian campos relevantes.
  IF NEW.datos IS DISTINCT FROM OLD.datos
     OR NEW.progreso IS DISTINCT FROM OLD.progreso
     OR NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.updated_at := now();
    NEW.updated_por := COALESCE(auth.uid(), NEW.updated_por, OLD.updated_por);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS proyecto_modulos_before_update ON public.proyecto_modulos;
CREATE TRIGGER proyecto_modulos_before_update
BEFORE UPDATE ON public.proyecto_modulos
FOR EACH ROW EXECUTE FUNCTION public.proyecto_modulos_before_update();

-- Backfill: módulos con progreso > 0 pero aún en sin_iniciar.
UPDATE public.proyecto_modulos
SET estado = 'en_diligenciamiento'::public.modulo_estado
WHERE estado = 'sin_iniciar'::public.modulo_estado
  AND COALESCE(progreso, 0) > 0;
