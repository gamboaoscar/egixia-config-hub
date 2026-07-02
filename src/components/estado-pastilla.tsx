import { cn } from "@/lib/utils";
import { ESTADO_CLASSES, ESTADO_LABEL, type ModuloEstado } from "@/lib/modulo-estado";

interface Props {
  estado: ModuloEstado;
  className?: string;
  size?: "sm" | "md";
}

export function EstadoPastilla({ estado, className, size = "md" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        ESTADO_CLASSES[estado],
        className,
      )}
    >
      {ESTADO_LABEL[estado]}
    </span>
  );
}