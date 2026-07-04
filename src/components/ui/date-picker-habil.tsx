import * as React from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  esFestivoCO,
  esFinDeSemana,
  esNoHabil,
  parseISOLocal,
  toISODateLocal,
} from "@/lib/festivos-co";

interface DatePickerHabilProps {
  value: string; // "YYYY-MM-DD" o ""
  onChange: (v: string) => void;
  min?: string; // "YYYY-MM-DD"
  bloquearNoHabiles?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
}

/**
 * Selector de fecha con:
 * - Fines de semana en amarillo pastel.
 * - Festivos de Colombia en rojo pastel.
 * - Bloqueo opcional de sábados, domingos y festivos.
 */
export function DatePickerHabil({
  value,
  onChange,
  min,
  bloquearNoHabiles = false,
  disabled,
  placeholder = "Selecciona una fecha",
  className,
  id,
}: DatePickerHabilProps) {
  const [open, setOpen] = React.useState(false);
  const selected = value ? parseISOLocal(value) : undefined;
  const minDate = min ? parseISOLocal(min) : undefined;

  const disabledMatcher = React.useCallback(
    (d: Date) => {
      if (minDate && d < minDate) return true;
      if (bloquearNoHabiles && esNoHabil(d)) return true;
      return false;
    },
    [minDate, bloquearNoHabiles],
  );

  const modifiers = React.useMemo(
    () => ({
      finDeSemana: (d: Date) => esFinDeSemana(d),
      festivo: (d: Date) => esFestivoCO(d),
    }),
    [],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected
            ? format(selected, "PPP", { locale: es })
            : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={es}
          selected={selected}
          onSelect={(d) => {
            if (d) {
              onChange(toISODateLocal(d));
              setOpen(false);
            } else {
              onChange("");
            }
          }}
          defaultMonth={selected ?? minDate}
          disabled={disabledMatcher}
          modifiers={modifiers}
          modifiersClassNames={{
            finDeSemana:
              "bg-yellow-100 text-yellow-900 dark:bg-yellow-500/20 dark:text-yellow-100",
            festivo:
              "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-100",
          }}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-200" />
            Fin de semana
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-200" />
            Festivo CO
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}