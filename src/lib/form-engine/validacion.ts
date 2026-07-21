import type {
  CampoDefinicion,
  DatosModulo,
  ModuloDefinicion,
} from "./tipos";

/** ¿El campo cuenta para la UI (activo por configuración)? */
export function campoActivo(campo: CampoDefinicion): boolean {
  return campo.activo !== false;
}

/** ¿El campo es visible según su regla `mostrarSi` y los datos actuales? */
export function campoVisible(
  campo: CampoDefinicion,
  datos: DatosModulo,
): boolean {
  if (!campo.mostrarSi) return true;
  const v = datos[campo.mostrarSi.campo];
  const esperado = campo.mostrarSi.igualA;
  if (Array.isArray(esperado)) return typeof v === "string" && esperado.includes(v);
  return v === esperado;
}

/** ¿El campo tiene un valor "no vacío"? */
export function valorLleno(valor: unknown): boolean {
  if (valor === null || valor === undefined) return false;
  if (typeof valor === "string") return valor.trim().length > 0;
  if (typeof valor === "number") return !Number.isNaN(valor);
  if (Array.isArray(valor)) return valor.length > 0;
  if (typeof valor === "object") return Object.keys(valor as object).length > 0;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Valida un campo. Devuelve un mensaje de error en español o `null` si
 * el valor es válido. La validación de "requerido" solo se aplica cuando
 * `exigirRequeridos` es `true` (envío a revisión); durante el
 * diligenciamiento normal solo validamos formatos.
 */
export function validarCampo(
  campo: CampoDefinicion,
  valor: unknown,
  exigirRequeridos = false,
): string | null {
  const lleno = valorLleno(valor);

  if (!lleno) {
    if (exigirRequeridos && campo.requerido) {
      return "Este campo es obligatorio para enviar el módulo.";
    }
    return null;
  }

  const reglas = campo.validacion ?? {};

  if (campo.tipo === "email" || reglas.email) {
    if (typeof valor !== "string" || !EMAIL_RE.test(valor.trim())) {
      return "Ingresa un correo con formato válido (ej. nombre@empresa.com).";
    }
  }

  if (campo.tipo === "url" || reglas.url_https) {
    if (typeof valor !== "string" || !/^https:\/\//i.test(valor.trim())) {
      return "La dirección debe comenzar con https://";
    }
  }

  if (campo.tipo === "numero") {
    const num = typeof valor === "number" ? valor : Number(valor);
    if (Number.isNaN(num)) return "Ingresa un número válido.";
    if (typeof reglas.min === "number" && num < reglas.min)
      return `El valor debe ser mayor o igual a ${reglas.min}.`;
    if (typeof reglas.max === "number" && num > reglas.max)
      return `El valor debe ser menor o igual a ${reglas.max}.`;
  } else if (typeof valor === "string") {
    const len = valor.trim().length;
    if (typeof reglas.longitud === "number" && len !== reglas.longitud)
      return `Debe tener exactamente ${reglas.longitud} caracteres.`;
    if (typeof reglas.min === "number" && len < reglas.min)
      return `Debe tener al menos ${reglas.min} caracteres.`;
    if (typeof reglas.max === "number" && len > reglas.max)
      return `Debe tener máximo ${reglas.max} caracteres.`;
  }

  return null;
}

/** Recorre el módulo y devuelve `{ campoKey: mensaje }` de errores. */
export function validarModulo(
  modulo: ModuloDefinicion,
  datos: DatosModulo,
  exigirRequeridos = false,
): Record<string, string> {
  const errores: Record<string, string> = {};
  for (const s of modulo.secciones) {
    for (const c of s.campos) {
      if (!campoActivo(c)) continue;
      if (c.tipo === "info") continue;
      if (!campoVisible(c, datos)) continue;
      const msg = validarCampo(c, datos[c.key], exigirRequeridos);
      if (msg) errores[c.key] = msg;
    }
  }
  return errores;
}

/**
 * Devuelve los `campo.key` de todos los campos obligatorios (activos y
 * visibles) que aún no tienen valor, en el orden en que aparecen en el
 * formulario. Útil para llevar al usuario al primer campo faltante.
 */
export function camposRequeridosFaltantes(
  modulo: ModuloDefinicion,
  datos: DatosModulo,
): string[] {
  const faltantes: string[] = [];
  for (const s of modulo.secciones) {
    for (const c of s.campos) {
      if (!campoActivo(c)) continue;
      if (c.tipo === "info") continue;
      if (!campoVisible(c, datos)) continue;
      if (!c.requerido) continue;
      if (c.tipo === "tabla" && c.columnas) {
        const reqCols = c.columnas.filter((col) => col.requerido);
        if (reqCols.length > 0) {
          const filas = Array.isArray(datos[c.key])
            ? (datos[c.key] as Record<string, unknown>[])
            : [];
          const completo =
            filas.length > 0 &&
            filas.every((fila) => reqCols.every((col) => valorLleno(fila[col.key])));
          if (!completo) faltantes.push(c.key);
          continue;
        }
      }
      if (!valorLleno(datos[c.key])) faltantes.push(c.key);
    }
  }
  return faltantes;
}

/** Resumen de diligenciamiento de una sección (para el repaso pre-envío). */
export interface ResumenSeccion {
  seccionKey: string;
  titulo: string;
  /** Campos activos, visibles y no-info de la sección. */
  total: number;
  /** De esos, cuántos tienen valor ("completo", mismo criterio del progreso). */
  completos: number;
  /** Solo los campos REQUERIDOS que aún están vacíos. */
  faltantes: Array<{ key: string; label: string }>;
}

/** ¿El campo está "completo"? Mismo criterio que `camposRequeridosFaltantes`
 *  para tablas con columnas requeridas; `valorLleno` para el resto. */
function campoCompleto(campo: CampoDefinicion, datos: DatosModulo): boolean {
  if (campo.tipo === "tabla" && campo.columnas) {
    const reqCols = campo.columnas.filter((col) => col.requerido);
    if (reqCols.length > 0) {
      const filas = Array.isArray(datos[campo.key])
        ? (datos[campo.key] as Record<string, unknown>[])
        : [];
      return (
        filas.length > 0 &&
        filas.every((fila) => reqCols.every((col) => valorLleno(fila[col.key])))
      );
    }
  }
  return valorLleno(datos[campo.key]);
}

/**
 * Resumen por sección para la pantalla de repaso previa al envío.
 * Cuenta solo campos activos, visibles según `mostrarSi` y no-info.
 * Las secciones sin campos contables se omiten.
 */
export function resumenPorSeccion(
  definicion: ModuloDefinicion,
  datos: DatosModulo,
): ResumenSeccion[] {
  const resumen: ResumenSeccion[] = [];
  for (const s of definicion.secciones) {
    const contables = s.campos.filter(
      (c) => campoActivo(c) && c.tipo !== "info" && campoVisible(c, datos),
    );
    if (contables.length === 0) continue;
    let completos = 0;
    const faltantes: Array<{ key: string; label: string }> = [];
    for (const c of contables) {
      const completo = campoCompleto(c, datos);
      if (completo) completos += 1;
      else if (c.requerido) faltantes.push({ key: c.key, label: c.label });
    }
    resumen.push({
      seccionKey: s.key,
      titulo: s.titulo,
      total: contables.length,
      completos,
      faltantes,
    });
  }
  return resumen;
}

/**
 * % de avance de un módulo:
 * (campos requeridos + activos con valor) ÷ (total requeridos + activos) × 100.
 * Si no hay campos requeridos activos, se calcula sobre todos los campos activos.
 */
export function calcularProgreso(
  modulo: ModuloDefinicion,
  datos: DatosModulo,
): number {
  const activos = modulo.secciones
    .flatMap((s) => s.campos)
    .filter(
      (c) => campoActivo(c) && c.tipo !== "info" && campoVisible(c, datos),
    );
  const requeridos = activos.filter((c) => c.requerido);
  const usarRequeridos = requeridos.length > 0;
  const campos = usarRequeridos ? requeridos : activos;
  if (campos.length === 0) return 0;

  let base = 0;
  let llenos = 0;

  for (const c of campos) {
    // Tabla con columnas requeridas: cada celda requerida cuenta como 1.
    if (c.tipo === "tabla" && c.columnas) {
      const reqCols = c.columnas.filter((col) => col.requerido);
      if (reqCols.length > 0) {
        const filas = Array.isArray(datos[c.key])
          ? (datos[c.key] as Record<string, unknown>[])
          : [];
        if (filas.length === 0) {
          // Aún no se ha añadido ninguna fila: cuenta como 1 unidad sin llenar.
          base += 1;
        } else {
          base += filas.length * reqCols.length;
          for (const fila of filas) {
            for (const col of reqCols) {
              if (valorLleno(fila[col.key])) llenos += 1;
            }
          }
        }
        continue;
      }
    }
    base += 1;
    if (valorLleno(datos[c.key])) llenos += 1;
  }

  return base === 0 ? 0 : Math.round((llenos / base) * 100);
}