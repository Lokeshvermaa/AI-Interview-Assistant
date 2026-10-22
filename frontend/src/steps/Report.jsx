import { useEffect, useState } from 'react'
import { getReport } from '../api'

function scoreColor(score) {
  if (score >= 7) return 'text-emerald-600'
  if (score >= 4) return 'text-amber-600'
  return 'text-red-600'
}

export default function Report({ sessionId }) {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReport(sessionId)
      .then(setReport)
      .catch((err) => setError(err.message))
  }, [sessionId])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!report) return <p className="text-sm text-slate-500">Loading report…</p>

  const wpms = report.evaluations.map((e) => e.voice?.wpm).filter((v) => v)
  const avgWpm = wpms.length
    ? Math.round(wpms.reduce((a, b) => a + b, 0) / wpms.length)
    : '—'

  return (
    <section className="space-y-4">
      {(report.title || report.created_at) && (
        <div>
          {report.title && <h2 className="text-lg font-semibold">{report.title}</h2>}
          {report.created_at && (
            <p className="text-xs text-slate-500">
              {new Date(report.created_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Questions asked" value={report.questions_asked} />
        <Stat label="Answers scored" value={report.answers_evaluated} />
        <Stat label="Average score" value={`${report.average_score}/10`} highlight />
        <Stat label="Avg. pace" value={avgWpm === '—' ? avgWpm : `${avgWpm} wpm`} />
      </div>

      {report.evaluations.map((e, i) => (
        <article key={i} className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium text-slate-800">
              {i + 1}. {e.question}
            </p>
            <span className={'text-lg font-semibold ' + scoreColor(e.score)}>
              {e.score}/10
            </span>
          </div>
          {e.verdict && <p className="mt-1 text-sm text-slate-500">{e.verdict}</p>}

          <VoiceMetrics voice={e.voice} />

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <List title="Strengths" items={e.strengths} tone="emerald" />
            <List title="Improvements" items={e.improvements} tone="amber" />
          </div>

          {e.model_answer && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-slate-500">Model answer</summary>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{e.model_answer}</p>
            </details>
          )}
        </article>
      ))}

      {report.evaluations.length === 0 && (
        <p className="text-sm text-slate-500">No answers were evaluated.</p>
      )}

      {report.transcript?.length > 0 && <Transcript turns={report.transcript} />}
    </section>
  )
}

function Transcript({ turns }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-500">
        Transcript
      </h3>
      <div className="max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {turns.map((t, i) => (
          <div
            key={i}
            className={t.role === 'candidate' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ' +
                (t.role === 'candidate'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800')
              }
            >
              {t.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function VoiceMetrics({ voice }) {
  if (!voice || !voice.word_count) return null
  const fillers = Object.entries(voice.fillers || {})
  return (
    <div className="mt-2 flex flex-wrap gap-2 text-xs">
      <Chip>🗣 {voice.word_count} words</Chip>
      {voice.duration_sec != null && <Chip>⏱ {voice.duration_sec}s</Chip>}
      {voice.wpm != null && <Chip>⚡ {voice.wpm} wpm</Chip>}
      <Chip tone={voice.filler_count > 2 ? 'warn' : 'ok'}>
        filler words: {voice.filler_count}
        {fillers.length ? ` (${fillers.map(([w, c]) => `${w}×${c}`).join(', ')})` : ''}
      </Chip>
    </div>
  )
}

function Chip({ children, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600',
    ok: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
  }
  return <span className={'rounded-full px-2 py-0.5 ' + tones[tone]}>{children}</span>
}

function Stat({ label, value, highlight }) {
  return (
    <div
      className={
        'rounded-lg border p-3 text-center ' +
        (highlight ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white')
      }
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function List({ title, items, tone }) {
  if (!items || items.length === 0) return null
  const dot = tone === 'emerald' ? 'text-emerald-500' : 'text-amber-500'
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
      <ul className="mt-1 space-y-1 text-sm text-slate-700">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className={dot}>•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
