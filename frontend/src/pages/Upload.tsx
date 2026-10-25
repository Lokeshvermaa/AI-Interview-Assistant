import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight, Plus, X } from 'lucide-react'
import { ingest } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Upload() {
  const nav = useNavigate()
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const rRef = useRef<HTMLInputElement>(null)
  const jRef = useRef<HTMLInputElement>(null)

  const has = resumeFile || jdFile || resumeText.trim() || jdText.trim()

  async function go() {
    setErr('')
    if (!has) return setErr('Add at least one file or paste text.')
    setLoading(true)
    try {
      const res = await ingest({ resumeFile, jdFile, resumeText, jdText })
      sessionStorage.setItem('ia:sid', res.session_id)
      nav('/questions')
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100svh] px-5 pt-28 pb-20 md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-16">
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">Setup</p>
          <h1 className="mt-6 text-[clamp(3rem,10vw,12rem)] leading-[0.9] tracking-[-0.06em] [font-family:var(--font-display)]">
            SOURCES
          </h1>
        </div>

        <div className="mb-10 flex items-center gap-6 text-[11px] uppercase tracking-[0.4em]">
          <button onClick={() => setMode('file')} className={cn('relative', mode === 'file' && 'after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:bg-[var(--text)]')}>
            Files
          </button>
          <button onClick={() => setMode('text')} className={cn('relative', mode === 'text' && 'after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:bg-[var(--text)]')}>
            Text
          </button>
        </div>

        {mode === 'file' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={() => rRef.current?.click()}
              className="group relative flex h-[40vh] flex-col justify-between border border-[var(--line)] p-6 text-left transition-colors hover:border-[var(--red)]"
            >
              <input ref={rRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
              <div className="flex items-start justify-between">
                <p className="text-[11px] uppercase tracking-[0.4em]">Resume</p>
                {resumeFile ? <X className="h-4 w-4" onClick={(e) => { e.stopPropagation(); setResumeFile(null) }} /> : <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />}
              </div>
              <p className="text-[clamp(1.5rem,4vw,3rem)] tracking-[-0.04em] [font-family:var(--font-display)]">
                {resumeFile ? resumeFile.name : 'Drop or select'}
              </p>
            </button>
            <button
              onClick={() => jRef.current?.click()}
              className="group relative flex h-[40vh] flex-col justify-between border border-[var(--line)] p-6 text-left transition-colors hover:border-[var(--red)]"
            >
              <input ref={jRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => setJdFile(e.target.files?.[0] || null)} />
              <div className="flex items-start justify-between">
                <p className="text-[11px] uppercase tracking-[0.4em]">Job Description</p>
                {jdFile ? <X className="h-4 w-4" onClick={(e) => { e.stopPropagation(); setJdFile(null) }} /> : <Plus className="h-4 w-4 transition-transform group-hover:rotate-90" />}
              </div>
              <p className="text-[clamp(1.5rem,4vw,3rem)] tracking-[-0.04em] [font-family:var(--font-display)]">
                {jdFile ? jdFile.name : 'Drop or select'}
              </p>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste resume..." className="h-[40vh] border border-[var(--line)] p-6 text-[15px] outline-none focus:border-[var(--red)]" />
            <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste job description..." className="h-[40vh] border border-[var(--line)] p-6 text-[15px] outline-none focus:border-[var(--red)]" />
          </div>
        )}

        {err && <p className="mt-6 text-sm text-[var(--red)]">{err}</p>}

        <div className="mt-12 flex items-center justify-between border-t border-[var(--line)] pt-8">
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">Private to this session</p>
          <button onClick={go} disabled={loading || !has} className="group flex items-center gap-3 text-[11px] uppercase tracking-[0.4em] disabled:opacity-40">
            <span className="relative">
              {loading ? 'Processing' : 'Continue'}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-[var(--text)] transition-transform duration-700 group-hover:origin-left group-hover:scale-x-100 group-disabled:hidden" />
            </span>
            <ArrowUpRight className="h-3 w-3 transition-transform duration-700 group-hover:-translate-y-1 group-hover:translate-x-1" />
          </button>
        </div>
      </div>
    </div>
  )
}
