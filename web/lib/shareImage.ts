// lib/shareImage.ts — compartir una imagen generada (PNG) por WhatsApp & co.
//
// Mobile: hoja de compartir nativa con SOLO el archivo (agregar title/text junto
// a files hace que WhatsApp pegue la imagen dos veces). Desktop: el caller muestra
// una vista previa con Copiar / Descargar.

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

export function canShareFiles(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return false
  try {
    const probe = new File([new Blob()], 'x.png', { type: 'image/png' })
    return navigator.canShare?.({ files: [probe] }) ?? false
  } catch {
    return false
  }
}

export async function shareImageFile(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: 'image/png' })
  if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] })) return 'unsupported'
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch {
    return 'cancelled' // el usuario cerró la hoja de compartir
  }
}

export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function safeFileSlug(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || 'paciente'
}
