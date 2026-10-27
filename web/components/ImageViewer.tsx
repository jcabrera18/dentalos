'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, ZoomIn, ZoomOut, RotateCw, Contrast, Maximize2, Download,
  ChevronLeft, ChevronRight,
} from 'lucide-react'

export type ViewerImage = { url: string; name: string }

const MIN_SCALE = 1
const MAX_SCALE = 8
const ZOOM_STEP = 1.4

/**
 * Visor de imágenes a pantalla completa para radiografías y fotos clínicas.
 * Se monta vía portal en <body> para no quedar atrapado por ancestros con
 * `transform` (p. ej. animaciones de entrada) que rompen `position: fixed`.
 *
 * Interacción: zoom con rueda/doble-click/botones, pan arrastrando, rotar,
 * invertir (útil en radiografías), navegar entre imágenes y atajos de teclado.
 */
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: ViewerImage[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [inverted, setInverted] = useState(false)
  const [prevIndex, setPrevIndex] = useState(index)

  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  const current = images[index]
  const hasPrev = index > 0
  const hasNext = index < images.length - 1

  const resetTransform = useCallback(() => {
    setScale(1); setTx(0); setTy(0); setRotation(0); setInverted(false)
  }, [])

  // Reset al cambiar de imagen (ajuste de estado en render: patrón recomendado)
  if (index !== prevIndex) {
    setPrevIndex(index)
    setScale(1); setTx(0); setTy(0); setRotation(0); setInverted(false)
  }

  // Bloquear scroll del body mientras el visor está abierto
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const goPrev = useCallback(() => { if (hasPrev) onIndexChange(index - 1) }, [hasPrev, index, onIndexChange])
  const goNext = useCallback(() => { if (hasNext) onIndexChange(index + 1) }, [hasNext, index, onIndexChange])

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s))

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    setScale(prev => {
      const next = clampScale(prev * factor)
      if (next === prev) return prev
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect && originX != null && originY != null) {
        // Mantener el punto bajo el cursor fijo durante el zoom
        const cx = rect.width / 2
        const cy = rect.height / 2
        const px = originX - rect.left - cx
        const py = originY - rect.top - cy
        const ratio = next / prev
        setTx(t => px - (px - t) * ratio)
        setTy(t => py - (py - t) * ratio)
      }
      if (next === MIN_SCALE) { setTx(0); setTy(0) }
      return next
    })
  }, [])

  // Atajos de teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      switch (e.key) {
        case 'Escape': onClose(); break
        case 'ArrowLeft': goPrev(); break
        case 'ArrowRight': goNext(); break
        case '+': case '=': zoomBy(ZOOM_STEP); break
        case '-': case '_': zoomBy(1 / ZOOM_STEP); break
        case '0': resetTransform(); break
        case 'r': case 'R': setRotation(r => (r + 90) % 360); break
        case 'i': case 'I': setInverted(v => !v); break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, goPrev, goNext, zoomBy, resetTransform])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, e.clientX, e.clientY)
  }

  function onDoubleClick(e: React.MouseEvent) {
    if (scale > 1) resetTransform()
    else zoomBy(2.5, e.clientX, e.clientY)
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { x: e.clientX, y: e.clientY, tx, ty }
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    setTx(dragRef.current.tx + (e.clientX - dragRef.current.x))
    setTy(dragRef.current.ty + (e.clientY - dragRef.current.y))
  }

  function onPointerUp(e: React.PointerEvent) {
    dragRef.current = null
    setDragging(false)
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* noop */ }
  }

  if (typeof document === 'undefined' || !current) return null

  const btn = 'flex items-center justify-center w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed backdrop-blur-sm'

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col select-none"
      onClick={onClose}
    >
      {/* Barra superior */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 shrink-0 bg-gradient-to-b from-black/80 to-transparent"
        onClick={e => e.stopPropagation()}
      >
        <div className="min-w-0 flex items-center gap-3">
          <span className="text-white/90 text-sm font-medium truncate max-w-[40vw]" title={current.name}>
            {current.name}
          </span>
          {images.length > 1 && (
            <span className="text-white/50 text-xs font-mono shrink-0">{index + 1} / {images.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button className={btn} onClick={() => zoomBy(1 / ZOOM_STEP)} title="Alejar ( - )"><ZoomOut size={18} /></button>
          <span className="text-white/60 text-xs font-mono w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button className={btn} onClick={() => zoomBy(ZOOM_STEP)} title="Acercar ( + )"><ZoomIn size={18} /></button>
          <div className="w-px h-6 bg-white/15 mx-1" />
          <button className={btn} onClick={() => setRotation(r => (r + 90) % 360)} title="Rotar ( R )"><RotateCw size={18} /></button>
          <button
            className={`${btn} ${inverted ? 'bg-[#00C4BC]/80 hover:bg-[#00C4BC]' : ''}`}
            onClick={() => setInverted(v => !v)}
            title="Invertir colores ( I )"
          ><Contrast size={18} /></button>
          <button className={btn} onClick={resetTransform} title="Restablecer ( 0 )"><Maximize2 size={18} /></button>
          <div className="w-px h-6 bg-white/15 mx-1" />
          <a
            href={current.url} target="_blank" rel="noopener noreferrer"
            className={btn} title="Abrir / descargar original"
            onClick={e => e.stopPropagation()}
          ><Download size={18} /></a>
          <button className={`${btn} hover:bg-red-500/80`} onClick={onClose} title="Cerrar ( Esc )"><X size={18} /></button>
        </div>
      </div>

      {/* Lienzo */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden flex items-center justify-center"
        onWheel={onWheel}
        onDoubleClick={onDoubleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={e => e.stopPropagation()}
        style={{ cursor: scale > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.name}
          draggable={false}
          className="max-w-[92vw] max-h-[82vh] object-contain will-change-transform"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rotation}deg)`,
            transition: dragging ? 'none' : 'transform 0.12s ease-out',
            filter: inverted ? 'invert(1)' : 'none',
          }}
        />

        {/* Navegación entre imágenes */}
        {images.length > 1 && (
          <>
            <button
              className={`absolute left-3 top-1/2 -translate-y-1/2 ${btn} w-12 h-12`}
              onClick={(e) => { e.stopPropagation(); goPrev() }}
              disabled={!hasPrev}
              title="Anterior ( ← )"
            ><ChevronLeft size={24} /></button>
            <button
              className={`absolute right-3 top-1/2 -translate-y-1/2 ${btn} w-12 h-12`}
              onClick={(e) => { e.stopPropagation(); goNext() }}
              disabled={!hasNext}
              title="Siguiente ( → )"
            ><ChevronRight size={24} /></button>
          </>
        )}
      </div>

      {/* Pie: ayuda */}
      <div
        className="shrink-0 py-2.5 text-center bg-gradient-to-t from-black/80 to-transparent"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/40 text-[11px]">
          Rueda para zoom · doble click para acercar · arrastrá para mover · <kbd>R</kbd> rotar · <kbd>I</kbd> invertir · <kbd>Esc</kbd> cerrar
        </span>
      </div>
    </div>,
    document.body,
  )
}
