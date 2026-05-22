'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'

export function PatientFilesSection({ patientId }: { patientId: string }) {
  const [files, setFiles] = useState<any[]>([])
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null)
  const supabase = createClient()

  useEffect(() => {
    void (async () => {
      const { data: fileList } = await supabase.storage.from('patient-files').list(`${patientId}/`)
      const list = fileList ?? []
      setFiles(list)
      await loadUrls(list)
      setLoading(false)
    })()
  }, [patientId])

  async function loadUrls(fileList: any[]) {
    if (fileList.length === 0) { setFileUrls({}); return }
    const paths = fileList.map(f => `${patientId}/${f.name}`)
    const { data } = await supabase.storage.from('patient-files').createSignedUrls(paths, 3600)
    const urls: Record<string, string> = {}
    data?.forEach((item: { path?: string; signedUrl: string }) => {
      const name = item.path?.split('/').pop()
      if (name && item.signedUrl) urls[name] = item.signedUrl
    })
    setFileUrls(urls)
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const isOdontograma = (e.target as any).dataset?.type === 'odontograma'
      const fileName = isOdontograma ? `foto_odontograma_${Date.now()}.${ext}` : `${Date.now()}.${ext}`
      await supabase.storage.from('patient-files').upload(`${patientId}/${fileName}`, file)
      const { data: fileList } = await supabase.storage.from('patient-files').list(`${patientId}/`)
      const list = fileList ?? []
      setFiles(list)
      await loadUrls(list)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileName: string) {
    await supabase.storage.from('patient-files').remove([`${patientId}/${fileName}`])
    const { data: fileList } = await supabase.storage.from('patient-files').list(`${patientId}/`)
    const list = fileList ?? []
    setFiles(list)
    await loadUrls(list)
  }

  return (
    <>
      <div className="bg-surface border border-app rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-app flex items-center justify-between">
          <h3 className="font-semibold">Archivos y radiografías</h3>
          <div className="flex gap-2">
            <label className={`cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all active:scale-95 ${uploading ? 'bg-surface2 border-app text-app3 opacity-50' : 'bg-surface2 border-app2 hover:bg-surface3 text-app2 hover:text-app'}`}>
              Foto odontograma
              <input type="file" className="hidden" accept="image/*" capture="environment" data-type="odontograma" onChange={handleUpload} disabled={uploading} />
            </label>
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
            {files.map((file: any) => {
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
              const isPdf = /\.pdf$/i.test(file.name)
              const url = fileUrls[file.name]
              const size = file.metadata?.size ? `${(file.metadata.size / 1024).toFixed(0)} KB` : ''
              const date = file.created_at
                ? new Date(file.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
                : ''
              return (
                <div key={file.name} className="group relative bg-surface2 rounded-xl overflow-hidden border border-app">
                  <button
                    className="w-full aspect-square flex items-center justify-center overflow-hidden bg-surface3"
                    onClick={() => { if (url) { if (isImage) setPreview({ url, name: file.name }); else window.open(url, '_blank') } }}
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
                      onClick={() => handleDelete(file.name)}
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

      {preview && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setPreview(null)}>
          <div className="relative max-w-4xl max-h-full w-full flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <img src={preview.url} alt={preview.name} className="max-w-full max-h-[85vh] rounded-xl object-contain shadow-2xl" />
            <div className="absolute top-3 right-3 flex gap-2">
              <a href={preview.url} target="_blank" rel="noopener noreferrer" className="bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" onClick={e => e.stopPropagation()}>Abrir</a>
              <button onClick={() => setPreview(null)} className="bg-black/60 hover:bg-black/80 text-white text-xl w-8 h-8 rounded-lg flex items-center justify-center transition-all">×</button>
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full">{preview.name}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
