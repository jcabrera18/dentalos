'use client'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'
import { ImageViewer } from '@/components/ImageViewer'

type PatientFile = {
  name: string
  path: string
  signed_url: string | null
  metadata?: { size?: number }
  created_at?: string
}

export function PatientFilesSection({ patientId, showOdontogramPhoto = true }: { patientId: string; showOdontogramPhoto?: boolean }) {
  const [files, setFiles] = useState<PatientFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [fileToDelete, setFileToDelete] = useState<PatientFile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const supabase = createClient()

  // Solo imágenes, en el mismo orden que la grilla → navegación prev/next en el visor.
  const imageFiles = useMemo(
    () => files.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name) && f.signed_url)
      .map(f => ({ url: f.signed_url as string, name: f.name })),
    [files],
  )

  async function getToken(): Promise<string | undefined> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token
  }

  async function loadFiles() {
    const token = await getToken()
    const { data } = await apiFetch(`/patients/${patientId}/files`, { token })
    setFiles(data ?? [])
  }

  useEffect(() => {
    void (async () => {
      await loadFiles()
      setLoading(false)
    })()
  }, [patientId])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const token = await getToken()
      const isOdontograma = (e.target as any).dataset?.type === 'odontograma'
      const ext = file.name.split('.').pop()
      const uploadFile = isOdontograma
        ? new File([file], `foto_odontograma.${ext}`, { type: file.type })
        : file

      const formData = new FormData()
      formData.append('file', uploadFile)

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/patients/${patientId}/files`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })
      if (!res.ok) throw new Error('Error al subir el archivo')
      await loadFiles()
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function confirmDelete() {
    if (!fileToDelete) return
    const path = fileToDelete.path
    setDeleting(true)
    try {
      const token = await getToken()
      await apiFetch(`/patients/${patientId}/files`, {
        method: 'DELETE',
        token,
        body: JSON.stringify({ path }),
      })
      setFiles(prev => prev.filter(f => f.path !== path))
      setFileToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-surface border border-app rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-app flex items-center justify-between">
          <h3 className="font-semibold">Archivos y radiografías</h3>
          <div className="flex gap-2">
            {showOdontogramPhoto && (
              <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${uploading ? 'bg-surface2 border-app text-app3 opacity-50' : 'bg-surface2 border-app2 hover:bg-surface3 text-app2 hover:text-app'}`}>
                Foto odontograma
                <input type="file" className="hidden" accept="image/*" capture="environment" data-type="odontograma" onChange={handleUpload} disabled={uploading} />
              </label>
            )}
            <label className={`cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 ${uploading ? 'bg-surface3 text-app3' : 'bg-[#00C4BC] hover:bg-[#00aaa3] text-white shadow-sm shadow-[#00C4BC]/20'}`}>
              {uploading ? 'Subiendo...' : '+ Archivo'}
              <input type="file" className="hidden" accept="image/*,.pdf,.dcm" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-center animate-pulse">
            <div className="h-8 w-8 bg-surface2 rounded-full mx-auto mb-3" />
            <div className="h-3 bg-surface2 rounded w-32 mx-auto" />
          </div>
        ) : files.length === 0 ? (
          <div className="px-6 py-8 text-center">
            <div className="text-3xl mb-2">📁</div>
            <div className="text-app3 text-sm">Sin archivos adjuntos</div>
            <div className="text-app3 text-xs mt-1">Radiografías, fotos, documentos</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {files.map((file) => {
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
              const isPdf = /\.pdf$/i.test(file.name)
              const url = file.signed_url
              const size = file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(0)} KB` : ''
              const date = file.created_at
                ? new Date(file.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                : ''
              return (
                <div key={file.path} className="group relative bg-surface2 rounded-xl overflow-hidden border border-app">
                  <button
                    className="w-full aspect-square flex items-center justify-center overflow-hidden bg-surface3"
                    onClick={() => {
                      if (!url) return
                      if (isImage) {
                        const i = imageFiles.findIndex(img => img.url === url)
                        if (i >= 0) setViewerIndex(i)
                      } else {
                        window.open(url, '_blank')
                      }
                    }}
                  >
                    {isImage && url
                      ? <img src={url} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                      : <span className="text-4xl">{isPdf ? '📄' : '📁'}</span>
                    }
                  </button>
                  <div className="p-2">
                    <div className="text-xs font-medium truncate text-app">{file.name}</div>
                    <div className="text-xs text-app3">{date} {size}</div>
                    <button
                      onClick={() => setFileToDelete(file)}
                      className="mt-1.5 w-full text-xs bg-red-900/20 hover:bg-red-900/40 active:scale-95 cursor-pointer text-red-400 py-1 rounded-lg transition-all"
                    >
                      Borrar
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {viewerIndex !== null && imageFiles[viewerIndex] && (
        <ImageViewer
          images={imageFiles}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
        />
      )}

      {fileToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-end sm:items-center justify-center p-4"
          onClick={() => { if (!deleting) setFileToDelete(null) }}
        >
          <div className="bg-surface border border-app rounded-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-app">
              <h2 className="text-lg font-semibold">Eliminar archivo</h2>
              <p className="text-sm text-app3 mt-1">
                ¿Eliminar <span className="font-medium text-app2 break-all">{fileToDelete.name}</span> de forma definitiva? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="px-6 py-4">
              <div className="flex gap-2">
                <button
                  onClick={() => setFileToDelete(null)}
                  disabled={deleting}
                  className="flex-1 bg-surface2 hover:bg-surface3 border border-app rounded-xl text-sm font-semibold py-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold py-3 transition-all active:scale-95 disabled:opacity-50"
                >
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
