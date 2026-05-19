'use client'

import { useState } from 'react'
import { X, FileText, AlertCircle, Download, CheckCircle2, Plus, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const IVA_CONDITIONS = [
  { value: 'CF', label: 'Consumidor Final' },
  { value: 'RI', label: 'Responsable Inscripto' },
  { value: 'M',  label: 'Monotributista' },
  { value: 'E',  label: 'Exento' },
]

const SALE_CONDITIONS = [
  'Contado',
  'Transferencia Bancaria',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Cheque',
  'Cuenta Corriente',
]

const INVOICE_TYPE_LABELS: Record<string, string> = {
  A: 'Factura A',
  B: 'Factura B',
  C: 'Factura C',
}

function resolveInvoiceType(emisorIva: string, receptorIva: string): string {
  if (emisorIva === 'MO') return 'C'
  if (emisorIva === 'EX') return 'B'
  if (emisorIva === 'RI') return receptorIva === 'RI' ? 'A' : 'B'
  return 'C'
}

interface InvoiceItemInput {
  code:         string
  description:  string
  quantity:     string
  unit:         string
  unit_price:   string
  discount_pct: string
}

function emptyItem(description = '', unit_price = ''): InvoiceItemInput {
  return { code: '', description, quantity: '1', unit: 'unidades', unit_price, discount_pct: '0' }
}

function computeSubtotal(item: InvoiceItemInput): number {
  const qty   = parseFloat(item.quantity)   || 0
  const price = parseFloat(item.unit_price) || 0
  const disc  = parseFloat(item.discount_pct) || 0
  return Math.round(qty * price * (1 - disc / 100) * 100) / 100
}

function computeTotal(items: InvoiceItemInput[]): number {
  return Math.round(items.reduce((s, i) => s + computeSubtotal(i), 0) * 100) / 100
}

interface Props {
  payment: {
    id: string
    amount: number
    total_amount?: number
    patient_name?: string
    patient_id?: string
    concept?: string
  }
  profesionalIvaCondition: string  // 'RI' | 'MO' | 'EX'
  token: string
  onClose: () => void
  onSuccess: (invoice: any) => void
}

export function InvoiceModal({ payment, profesionalIvaCondition, token, onClose, onSuccess }: Props) {
  const [receptorName, setReceptorName]       = useState(payment.patient_name ?? '')
  const [receptorCuit, setReceptorCuit]       = useState('')
  const [receptorAddress, setReceptorAddress] = useState('')
  const [receptorIva, setReceptorIva]         = useState('CF')
  const [condicionVenta, setCondicionVenta]   = useState('')
  const [items, setItems]                     = useState<InvoiceItemInput[]>([
    emptyItem(payment.concept ?? '', String(payment.amount ?? '')),
  ])
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')
  const [invoice, setInvoice]         = useState<any>(null)
  const [downloadingPdf, setDownloadingPdf] = useState(false)

  const invoiceType = resolveInvoiceType(profesionalIvaCondition, receptorIva)
  const total       = computeTotal(items)

  // ── Item helpers ─────────────────────────────────────────────────────────────

  function updateItem(idx: number, field: keyof InvoiceItemInput, value: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))
  }

  function addItem() {
    setItems(prev => [...prev, emptyItem()])
  }

  function removeItem(idx: number) {
    setItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev)
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!receptorName.trim()) { setError('El nombre del receptor es obligatorio'); return }
    const invalidItems = items.filter(it => !it.description.trim() || !parseFloat(it.unit_price))
    if (invalidItems.length > 0) { setError('Todos los ítems deben tener descripción y precio'); return }

    setSubmitting(true)
    setError('')
    try {
      const res = await apiFetch('/invoices', {
        method: 'POST',
        token,
        body: JSON.stringify({
          payment_id:             payment.id,
          receptor_name:          receptorName.trim(),
          receptor_cuit:          receptorCuit.replace(/\D/g, '') || undefined,
          receptor_address:       receptorAddress.trim() || undefined,
          receptor_iva_condition: receptorIva,
          condicion_venta:        condicionVenta || undefined,
          items: items.map(it => ({
            code:         it.code.trim() || undefined,
            description:  it.description.trim(),
            quantity:     parseFloat(it.quantity) || 1,
            unit:         it.unit.trim() || 'unidades',
            unit_price:   parseFloat(it.unit_price) || 0,
            discount_pct: parseFloat(it.discount_pct) || 0,
          })),
        }),
      })
      setInvoice(res.data)
      onSuccess(res.data)
    } catch (err: any) {
      setError(err.message ?? 'Error al facturar')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Download PDF ─────────────────────────────────────────────────────────────

  async function handleDownloadPdf() {
    if (!invoice) return
    setDownloadingPdf(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${apiUrl}/invoices/${invoice.id}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `factura-${invoice.invoice_type}-${invoice.id.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      setError(err.message ?? 'Error al descargar PDF')
    } finally {
      setDownloadingPdf(false)
    }
  }

  function formatARS(n: number) {
    return '$ ' + n.toLocaleString('es-AR', { minimumFractionDigits: 2 })
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={!invoice ? onClose : undefined} />
      <div className="relative bg-surface border border-app rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-[#00C4BC]" />
            <h2 className="font-semibold text-app">
              {invoice ? `${INVOICE_TYPE_LABELS[invoice.invoice_type] ?? 'Factura'} emitida` : 'Emitir factura electrónica'}
            </h2>
          </div>
          <button onClick={onClose} className="text-app3 hover:text-app transition-colors p-1 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* ── Success state ─────────────────────────────────────────── */}
        {invoice ? (
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-app text-sm">Factura autorizada por AFIP</p>
                <p className="text-xs text-app3 mt-0.5">{INVOICE_TYPE_LABELS[invoice.invoice_type]} Nro {String(invoice.numero ?? invoice.afip_numero).padStart(8, '0')}</p>
              </div>
            </div>

            <div className="bg-surface2 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-app3">CAE</span>
                <span className="font-mono font-semibold text-app">{invoice.afip_cae}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app3">Vto. CAE</span>
                <span className="text-app">{invoice.afip_cae_vto?.split('-').reverse().join('/')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-app3">Total</span>
                <span className="font-bold text-app">{formatARS(Number(invoice.total_amount))}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
              </div>
            )}

            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
            >
              <Download size={16} />
              {downloadingPdf ? 'Generando PDF...' : 'Descargar PDF'}
            </button>

            <button onClick={onClose} className="w-full py-3 rounded-xl border border-app text-app2 text-sm font-medium hover:bg-surface2 transition-all">
              Cerrar
            </button>
          </div>

        ) : (
          /* ── Form state ─────────────────────────────────────────── */
          <div className="p-5 space-y-5">

            {/* Invoice type + total preview */}
            <div className="flex items-center justify-between p-3 bg-[#00C4BC]/10 border border-[#00C4BC]/20 rounded-xl">
              <span className="text-sm text-app3">Se emitirá</span>
              <span className="font-bold text-[#00C4BC]">{INVOICE_TYPE_LABELS[invoiceType]}</span>
              <span className="font-bold text-app">{formatARS(total)}</span>
            </div>

            {/* Receptor name */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Nombre / Razón Social</label>
              <input
                type="text"
                value={receptorName}
                onChange={e => setReceptorName(e.target.value)}
                placeholder="Juan García"
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
              />
            </div>

            {/* Receptor IVA */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Condición IVA del receptor</label>
              <div className="flex flex-wrap gap-2">
                {IVA_CONDITIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setReceptorIva(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      receptorIva === c.value
                        ? 'bg-[#00C4BC] text-white border-[#00C4BC]'
                        : 'bg-surface2 text-app2 border-app hover:border-[#00C4BC]/50'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* CUIT/DNI */}
            {(invoiceType === 'A' || receptorIva !== 'CF') && (
              <div>
                <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">
                  CUIT / DNI {invoiceType === 'A' ? '(requerido)' : '(opcional)'}
                </label>
                <input
                  type="text"
                  value={receptorCuit}
                  onChange={e => setReceptorCuit(e.target.value)}
                  placeholder={receptorIva === 'RI' ? '20-12345678-9' : '12345678'}
                  className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                />
              </div>
            )}

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Domicilio <span className="font-normal text-app3">(opcional)</span></label>
              <input
                type="text"
                value={receptorAddress}
                onChange={e => setReceptorAddress(e.target.value)}
                placeholder="Av. Corrientes 1234, CABA"
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
              />
            </div>

            {/* Condición de venta */}
            <div>
              <label className="block text-xs font-semibold text-app3 uppercase tracking-wider mb-1.5">Condición de venta <span className="font-normal text-app3">(opcional)</span></label>
              <select
                value={condicionVenta}
                onChange={e => setCondicionVenta(e.target.value)}
                className="w-full bg-surface2 border border-app rounded-xl px-3 py-2.5 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
              >
                <option value="">Sin especificar</option>
                {SALE_CONDITIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* ── Items ───────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-app3 uppercase tracking-wider">Ítems de la factura</label>
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1 text-xs text-[#00C4BC] hover:text-[#00aaa3] font-medium transition-colors"
                >
                  <Plus size={13} />
                  Agregar ítem
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="bg-surface2 border border-app rounded-xl p-3 space-y-2.5">
                    {/* Row 1: description + delete */}
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">Descripción *</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={e => updateItem(idx, 'description', e.target.value)}
                          placeholder="Restauración con resina..."
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="mt-5 p-1.5 rounded-lg text-app3 hover:text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Row 2: code + quantity + unit */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">Código</label>
                        <input
                          type="text"
                          value={item.code}
                          onChange={e => updateItem(idx, 'code', e.target.value)}
                          placeholder="—"
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">Cantidad *</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">U. Medida</label>
                        <input
                          type="text"
                          value={item.unit}
                          onChange={e => updateItem(idx, 'unit', e.target.value)}
                          placeholder="unidades"
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                    </div>

                    {/* Row 3: price + discount + subtotal */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">Precio Unit. *</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                          placeholder="0.00"
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">% Bonif.</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={item.discount_pct}
                          onChange={e => updateItem(idx, 'discount_pct', e.target.value)}
                          placeholder="0"
                          className="w-full bg-surface border border-app rounded-lg px-2.5 py-2 text-app text-sm focus:outline-none focus:border-[#00C4BC]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-app3 uppercase tracking-wider mb-1">Subtotal</label>
                        <div className="w-full bg-surface border border-app/50 rounded-lg px-2.5 py-2 text-app text-sm font-semibold text-right tabular-nums">
                          {formatARS(computeSubtotal(item))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div className="mt-3 flex items-center justify-between px-4 py-2.5 bg-[#00C4BC]/10 border border-[#00C4BC]/20 rounded-xl">
                <span className="text-sm font-medium text-app3">Total a facturar</span>
                <span className="font-bold text-[#00C4BC] tabular-nums">{formatARS(total)}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />{error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl border border-app text-app2 text-sm font-medium hover:bg-surface2 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-[#00C4BC] hover:bg-[#00aaa3] text-white font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
              >
                {submitting ? 'Enviando a AFIP...' : 'Emitir factura'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
