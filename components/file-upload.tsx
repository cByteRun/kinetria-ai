'use client'
import { useRef } from 'react'
import { Paperclip, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
export function FileUpload({ files, onChange, error, onError }: {
  files: File[]; onChange: (files: File[]) => void; error: string; onError: (message: string) => void
}) {
  const ui = useTranslations('ui'), input = useRef<HTMLInputElement>(null)
  function add(selected: File[]) {
    const next = [...files, ...selected]
    if (next.length > 3 || next.some(f => f.size > 1048576 || !f.size)) { onError('chooseUpTo3NonemptyFilesNoLarger'); return }
    onError(''); onChange(next)
  }
  return <section className="file-upload" aria-label={ui('requestMaterials')}>
    <div className="upload-zone" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); add(Array.from(e.dataTransfer.files)) }}>
      <button type="button" className="btn" onClick={() => { if (input.current) { input.current.value = ''; input.current.click() } }}><Paperclip size={16} />{ui('chooseFiles')}</button>
      <p>{ui('addMaterialsIfTheyHelpExplainTheSituation')}</p>
      <input ref={input} name="attachments" hidden type="file" multiple aria-label={ui('requestMaterials')} onChange={e => add(Array.from(e.target.files || []))} />
      <p className="form-hint">{ui('upTo3Files1MbEachAccessible')}</p>
    </div>
    {error && <p className="form-error" role="alert">{ui(error)}</p>}
    <div className="attachments">{files.map((file, i) => <span className="attachment" key={file.name + i}><Paperclip size={14} />{file.name}<button type="button" aria-label={ui('remove') + ' ' + file.name} onClick={() => { onChange(files.filter((_, n) => n !== i)); onError('') }}><X size={14} /></button></span>)}</div>
  </section>
}
