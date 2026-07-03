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
  const win = window.open(url, "_blank", "noopener");
  if (!win) {
    // Popup bloqueado: forzar descarga.
    const a = document.createElement("a");
    a.href = url;
    a.download = filename ?? "acta.pdf";
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}