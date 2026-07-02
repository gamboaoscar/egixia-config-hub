-- Trigger de autocompletado: cuando un módulo pasa a 'aprobado' y todos los
-- demás módulos del proyecto también lo están, el proyecto pasa a 'completado'
-- (a menos que ya esté 'cerrado'). Usa la función existente
-- public.autocompletar_proyecto().

drop trigger if exists trg_autocompletar_proyecto on public.proyecto_modulos;

create trigger trg_autocompletar_proyecto
after update of estado on public.proyecto_modulos
for each row
when (new.estado = 'aprobado' and old.estado is distinct from new.estado)
execute function public.autocompletar_proyecto();