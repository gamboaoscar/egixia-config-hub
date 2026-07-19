/**
 * Abre un PDF servido en base64 como Blob same-origin. Evita URLs de
 * Storage bloqueadas por ad-blockers (ERR_BLOCKED_BY_CLIENT).
 */
export function abrirPdfBlob(base64: string, filename?: string | null): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  // window.open con "noopener" retorna null por especificación en muchos
  // navegadores, aunque la pestaña sí se abra. Abrimos sin ese flag y
  // limpiamos manualmente `opener`; el fallback de descarga solo actúa
  // si el navegador realmente bloqueó el popup.
  const win = window.open(url, "_blank");
  if (win) {
    try {
      win.opener = null;
    } catch {
      // Algunos navegadores lanzan al escribir opener; irrelevante.
    }
  } else {
    // Popup bloqueado: forzar descarga.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "acta.pdf";
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Fuerza la descarga del PDF sin abrir pestañas ni previews.
 */
export function descargarPdfBlob(
  base64: string,
  filename?: string | null,
): void {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? "acta.pdf";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}