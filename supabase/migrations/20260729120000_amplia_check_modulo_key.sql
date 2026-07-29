-- Amplia el CHECK de proyecto_modulos.modulo_key para incluir los 9 modulos del catalogo (Fase 2)
-- Antes solo permitia: imagen, sociedades, seguridad
ALTER TABLE public.proyecto_modulos DROP CONSTRAINT IF EXISTS proyecto_modulos_modulo_key_check;
ALTER TABLE public.proyecto_modulos ADD CONSTRAINT proyecto_modulos_modulo_key_check
  CHECK (modulo_key = ANY (ARRAY['imagen','sociedades','seguridad','usuarios_internos','matriz_documental','maestros_compras','integracion_erp','notificaciones','verificacion_cumplimiento']::text[]));
