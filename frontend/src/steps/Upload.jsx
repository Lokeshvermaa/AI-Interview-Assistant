import { useState } from 'react'
import { ingest } from '../api'

function FileField({ label, accept, file, onFile }) {
  return (
    <label className="block rounded-lg border border-dashed border-slate-300 bg-white p-4 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(e) => onFile(e.target.files?.[0] || null)}
        className="mt-2 block w-full text-sm text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-indigo-700"
      />
      {file && <span className="mt-2 block text-xs text-slate-500">{file.name}</span>}
    </label>
  )
}

export default function Upload({ onDone }) {
  const [resumeFile, setResumeFile] = useState(null)
  const [jdFile, setJdFile] = useState(null)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!resumeFile && !jdFile && !resumeText.trim() && !jdText.trim()) {
      setError('Provide a résumé and/or a job description.')
      return
    }
    setLoading(true)
    try {
      const res = await ingest({ resumeFile, jdFile, resumeText, jdText })
      onDone(res.session_id)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <FileField
          label="Résumé (PDF, DOCX, TXT)"
          accept=".pdf,.docx,.txt,.md"
          file={resumeFile}
          onFile={setResumeFile}
        />
        <FileField
          label="Job description (PDF, DOCX, TXT)"
          accept=".pdf,.docx,.txt,.md"
          file={jdFile}
          onFile={setJdFile}
        />
      </div>

      <p className="text-center text-xs uppercase tracking-wide text-slate-400">
        or paste text
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <textarea
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste résumé text…"
          rows={5}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste job description text…"
          rows={5}
          className="w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Save résumé & job description'}
      </button>
    </section>
  )
}
