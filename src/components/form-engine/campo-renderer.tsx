import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type {
  CampoDefinicion,
  ColumnaTabla,
  OpcionCampo,
} from "@/lib/form-engine/tipos";

import { BotonAyudaCampo } from "./ayuda-campo";
import { CampoArchivo } from "./campo-archivo";
import { Checkbox } from "@/components/ui/checkbox";

interface Props {
  campo: CampoDefinicion;
  valor: unknown;
  error?: string;
  disabled?: boolean;
  proyectoId: string;
  moduloId: string;
  onChange: (valor: unknown) => void;
  onBlur?: () => void;
}

export function CampoRenderer({
  campo,
  valor,
  error,
  disabled,
  proyectoId,
  moduloId,
  onChange,
  onBlur,
}: Props) {
  const inputId = `campo-${campo.key}`;
  if (campo.tipo === "info") {
    return (
      <div
        data-campo-key={campo.key}
        className="rounded-xl border border-primary/20 bg-primary-soft/40 p-3 text-sm text-foreground"
      >
        <div className="font-medium">{campo.label}</div>
        {campo.aviso && (
          <p className="mt-1 text-xs text-muted-foreground">{campo.aviso}</p>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-1.5" data-campo-key={campo.key}>
      <div className="flex items-center gap-1.5">
        <Label
          htmlFor={inputId}
          className="text-sm font-medium text-foreground"
        >
          {campo.label}
          {campo.requerido && (
            <span className="ml-0.5 text-primary" aria-label="requerido">
              *
            </span>
          )}
          {!campo.requerido && (
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              (opcional)
            </span>
          )}
        </Label>
        {campo.guia && (
          <BotonAyudaCampo label={campo.label} guia={campo.guia} />
        )}
      </div>

      <CampoControl
        campo={campo}
        inputId={inputId}
        valor={valor}
        disabled={disabled}
        error={!!error}
        proyectoId={proyectoId}
        moduloId={moduloId}
        onChange={onChange}
        onBlur={onBlur}
      />

      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {campo.aviso && !error && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          {campo.aviso}
        </p>
      )}
    </div>
  );
}

function CampoControl({
  campo,
  inputId,
  valor,
  disabled,
  error,
  proyectoId,
  moduloId,
  onChange,
  onBlur,
}: {
  campo: CampoDefinicion;
  inputId: string;
  valor: unknown;
  disabled?: boolean;
  error?: boolean;
  proyectoId: string;
  moduloId: string;
  onChange: (v: unknown) => void;
  onBlur?: () => void;
}) {
  const invalidClass = error ? "border-red-400 focus-visible:ring-red-300" : "";

  switch (campo.tipo) {
    case "textarea":
      return (
        <Textarea
          id={inputId}
          value={typeof valor === "string" ? valor : ""}
          placeholder={campo.placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={cn("min-h-24", invalidClass)}
        />
      );

    case "numero":
      return (
        <Input
          id={inputId}
          type="number"
          value={
            typeof valor === "number"
              ? valor
              : typeof valor === "string"
                ? valor
                : ""
          }
          placeholder={campo.placeholder}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          onBlur={onBlur}
          className={invalidClass}
        />
      );

    case "email":
    case "url":
    case "texto":
      return (
        <Input
          id={inputId}
          type={campo.tipo === "email" ? "email" : campo.tipo === "url" ? "url" : "text"}
          value={typeof valor === "string" ? valor : ""}
          placeholder={
            campo.placeholder ??
            (campo.tipo === "url" ? "https://..." : undefined)
          }
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={invalidClass}
        />
      );

    case "select":
      return (
        <Select
          value={typeof valor === "string" ? valor : ""}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={inputId} className={invalidClass}>
            <SelectValue placeholder="Selecciona una opción" />
          </SelectTrigger>
          <SelectContent>
            {(campo.opciones ?? []).map((o) => (
              <SelectItem key={o.valor} value={o.valor}>
                {o.etiqueta}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "radio_tarjetas":
      return (
        <RadioTarjetas
          opciones={campo.opciones ?? []}
          valor={typeof valor === "string" ? valor : null}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "checkbox_multiple":
      return (
        <CheckboxMultiple
          opciones={campo.opciones ?? []}
          valor={Array.isArray(valor) ? (valor as string[]) : []}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "color":
      return (
        <SelectorColor
          opciones={campo.opciones ?? []}
          valor={typeof valor === "string" ? valor : null}
          disabled={disabled}
          onChange={onChange}
        />
      );

    case "archivo":
      if (!campo.archivo) {
        return (
          <p className="text-xs text-red-600">
            Campo mal configurado: falta `archivo`.
          </p>
        );
      }
      return (
        <CampoArchivo
          campoKey={campo.key}
          config={campo.archivo}
          valor={valor}
          disabled={disabled}
          proyectoId={proyectoId}
          moduloId={moduloId}
          onChange={onChange}
        />
      );

    case "tabla":
      return (
        <TablaDinamica
          campoKey={campo.key}
          columnas={campo.columnas ?? []}
          valor={Array.isArray(valor) ? (valor as Record<string, unknown>[]) : []}
          disabled={disabled}
          proyectoId={proyectoId}
          moduloId={moduloId}
          onChange={onChange}
        />
      );

    case "info":
      return null;
  }
}

function CheckboxMultiple({
  opciones,
  valor,
  disabled,
  onChange,
}: {
  opciones: OpcionCampo[];
  valor: string[];
  disabled?: boolean;
  onChange: (v: string[]) => void;
}) {
  const toggle = (v: string, checked: boolean) => {
    const set = new Set(valor);
    if (checked) set.add(v);
    else set.delete(v);
    onChange(Array.from(set));
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opciones.map((o) => {
        const seleccionada = valor.includes(o.valor);
        return (
          <label
            key={o.valor}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition",
              "hover:border-primary/40",
              disabled && "cursor-not-allowed opacity-60",
              seleccionada
                ? "border-primary ring-1 ring-primary/20 bg-primary-soft/30"
                : "border-border",
            )}
          >
            <Checkbox
              checked={seleccionada}
              disabled={disabled}
              onCheckedChange={(c) => toggle(o.valor, c === true)}
              className="mt-0.5"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-foreground">
                {o.etiqueta}
              </span>
              {o.descripcion && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {o.descripcion}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function RadioTarjetas({
  opciones,
  valor,
  disabled,
  onChange,
}: {
  opciones: OpcionCampo[];
  valor: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {opciones.map((o) => {
        const seleccionada = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            disabled={disabled}
            onClick={() => onChange(o.valor)}
            className={cn(
              "w-full rounded-xl border bg-card p-4 text-left transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              seleccionada
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40 hover:bg-primary-soft/40",
            )}
            aria-pressed={seleccionada}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  {o.etiqueta}
                </div>
                {o.descripcion && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.descripcion}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "mt-0.5 h-4 w-4 shrink-0 rounded-full border",
                  seleccionada
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 bg-background",
                )}
                aria-hidden
              />
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SelectorColor({
  opciones,
  valor,
  disabled,
  onChange,
}: {
  opciones: OpcionCampo[];
  valor: string | null;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const HEX_RE = /^#[0-9a-fA-F]{6}$/;
  const esPresetSel = valor
    ? opciones.some((o) => o.valor.toLowerCase() === valor.toLowerCase())
    : false;
  const personalizadoActivo = !!valor && !esPresetSel;
  const [modoPersonalizado, setModoPersonalizado] = useState(personalizadoActivo);
  const [hexInput, setHexInput] = useState(
    personalizadoActivo ? (valor as string) : "#000000",
  );
  const hexValido = HEX_RE.test(hexInput);

  const activarPersonalizado = () => {
    setModoPersonalizado(true);
    if (personalizadoActivo && valor) {
      setHexInput(valor);
    } else if (hexValido) {
      onChange(hexInput.toUpperCase());
    }
  };

  const commitHex = (v: string) => {
    const trimmed = v.trim();
    setHexInput(trimmed);
    if (HEX_RE.test(trimmed)) onChange(trimmed.toUpperCase());
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {opciones.map((o) => {
          const seleccionada = !modoPersonalizado && valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            disabled={disabled}
            onClick={() => {
              setModoPersonalizado(false);
              onChange(o.valor);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition",
              "disabled:cursor-not-allowed disabled:opacity-60",
              seleccionada
                ? "border-primary ring-2 ring-primary/20"
                : "border-border hover:border-primary/40",
            )}
            aria-pressed={seleccionada}
          >
            <span
              className="h-9 w-9 shrink-0 rounded-lg border border-border/60"
              style={{ backgroundColor: o.hex ?? o.valor }}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">
                {o.etiqueta}
              </span>
              <span className="block text-xs text-muted-foreground">
                {(o.hex ?? o.valor).toUpperCase()}
              </span>
            </span>
          </button>
        );
        })}
        <button
          type="button"
          disabled={disabled}
          onClick={activarPersonalizado}
          className={cn(
            "flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            modoPersonalizado
              ? "border-primary ring-2 ring-primary/20"
              : "border-dashed border-border hover:border-primary/40",
          )}
          aria-pressed={modoPersonalizado}
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/60"
            style={{
              background:
                "conic-gradient(from 0deg, #ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #6366f1, #d946ef, #ef4444)",
            }}
            aria-hidden
          >
            <Plus className="h-4 w-4 text-white drop-shadow" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">
              Color personalizado
            </span>
            <span className="block text-xs text-muted-foreground">
              Solicita un color a medida
            </span>
          </span>
        </button>
      </div>

      {modoPersonalizado && (
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">
            Color personalizado
          </Label>
          <div className="mt-2 flex items-center gap-3">
            <input
              type="color"
              disabled={disabled}
              value={hexValido ? hexInput : "#000000"}
              onChange={(e) => commitHex(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
              aria-label="Selector de color"
            />
            <Input
              value={hexInput}
              disabled={disabled}
              onChange={(e) => commitHex(e.target.value)}
              placeholder="#123ABC"
              maxLength={7}
              className="max-w-[10rem] uppercase"
            />
            <span
              className="h-10 flex-1 rounded-lg border border-border/60"
              style={{ backgroundColor: hexValido ? hexInput : "transparent" }}
              aria-hidden
            />
          </div>
          {!hexValido && (
            <p className="mt-2 text-xs text-amber-700">
              Ingresa un color en formato HEX de 6 dígitos, ej. #1A2B3C.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            El equipo de EGIXIA validará el color solicitado durante la revisión.
          </p>
        </div>
      )}
    </div>
  );
}

function TablaDinamica({
  campoKey,
  columnas,
  valor,
  disabled,
  proyectoId,
  moduloId,
  onChange,
}: {
  campoKey: string;
  columnas: ColumnaTabla[];
  valor: Record<string, unknown>[];
  disabled?: boolean;
  proyectoId: string;
  moduloId: string;
  onChange: (v: unknown) => void;
}) {
  const filas = valor;

  const setCelda = (i: number, key: string, v: unknown) => {
    const next = filas.map((f, idx) => (idx === i ? { ...f, [key]: v } : f));
    onChange(next);
  };
  const agregar = () =>
    onChange([...filas, Object.fromEntries(columnas.map((c) => [c.key, ""]))]);
  const eliminar = (i: number) => onChange(filas.filter((_, idx) => idx !== i));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {columnas.map((c) => (
                <th
                  key={c.key}
                  className="px-3 py-2 text-left font-medium"
                  scope="col"
                  style={c.ancho ? { minWidth: c.ancho } : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{c.label}</span>
                    {c.requerido && (
                      <span className="text-primary" aria-label="requerido">
                        *
                      </span>
                    )}
                    {c.guia && (
                      <BotonAyudaCampo label={c.label} guia={c.guia} />
                    )}
                  </div>
                </th>
              ))}
              <th className="w-10" aria-label="Acciones" />
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td
                  colSpan={columnas.length + 1}
                  className="px-3 py-6 text-center text-xs text-muted-foreground"
                >
                  Aún no hay filas. Añade la primera con el botón de abajo.
                </td>
              </tr>
            )}
            {filas.map((f, i) => (
              <tr key={i} className="border-t border-border align-top">
                {columnas.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    <CeldaTabla
                      columna={c}
                      valor={f[c.key]}
                      disabled={disabled}
                      proyectoId={proyectoId}
                      moduloId={moduloId}
                      celdaKey={`${campoKey}_${i}_${c.key}`}
                      onChange={(v) => setCelda(i, c.key, v)}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() => eliminar(i)}
                    aria-label={`Eliminar fila ${i + 1}`}
                    className="h-7 w-7 text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-border bg-muted/30 p-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={agregar}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Añadir fila
        </Button>
      </div>
    </div>
  );
}

function CeldaTabla({
  columna,
  valor,
  disabled,
  proyectoId,
  moduloId,
  celdaKey,
  onChange,
}: {
  columna: ColumnaTabla;
  valor: unknown;
  disabled?: boolean;
  proyectoId: string;
  moduloId: string;
  celdaKey: string;
  onChange: (v: unknown) => void;
}) {
  const base =
    "h-8 border-transparent bg-transparent focus-visible:border-border focus-visible:bg-background";

  if (columna.tipo === "select") {
    return (
      <Select
        value={typeof valor === "string" ? valor : ""}
        onValueChange={(v) => onChange(v)}
        disabled={disabled}
      >
        <SelectTrigger className={cn(base, "px-2")}>
          <SelectValue placeholder={columna.placeholder ?? "Selecciona"} />
        </SelectTrigger>
        <SelectContent>
          {(columna.opciones ?? []).map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (columna.tipo === "archivo" && columna.archivo) {
    return (
      <div className="min-w-[220px] py-1">
        <CampoArchivo
          campoKey={celdaKey}
          config={columna.archivo}
          valor={valor}
          disabled={disabled}
          proyectoId={proyectoId}
          moduloId={moduloId}
          onChange={onChange}
        />
      </div>
    );
  }

  const type =
    columna.tipo === "numero"
      ? "number"
      : columna.tipo === "email"
        ? "email"
        : columna.tipo === "url"
          ? "url"
          : "text";

  return (
    <Input
      type={type}
      value={
        typeof valor === "string" || typeof valor === "number"
          ? String(valor)
          : ""
      }
      placeholder={columna.placeholder}
      maxLength={columna.longitud}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          columna.tipo === "numero" && e.target.value !== ""
            ? Number(e.target.value)
            : e.target.value,
        )
      }
      className={base}
    />
  );
}