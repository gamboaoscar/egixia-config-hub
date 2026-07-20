-- Flujo de extensión de plazo (comportamiento `extension_implementador`).
-- El invitado puede solicitar una extensión cuando el módulo venció;
-- el implementador la "concede" ampliando la fecha límite, lo que
-- limpia estos campos (ver `actualizarConfigModulo`).
ALTER TABLE public.proyecto_modulos
  ADD COLUMN IF NOT EXISTS extension_solicitada_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS extension_solicitada_por uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;
