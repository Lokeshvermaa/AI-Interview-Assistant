import { useEffect, useState } from 'react'
import { getReport, type Report } from '@/lib/api'

export default function ReportPage() {
  const [sid] = useState(() => sessionStorage.getItem('ia:sid') || '')
  const [r, setR] = useState<Report | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    const id = sid || window.location.pathname.split('/').pop() || ''
    if (!id) {
      setErr('No session found')
      return
    }
    getReport(id)
      .then(setR)
      .catch((e: any) => setErr(e?.message || 'Failed to load report'))
  }, [sid])

  if (err) {
    return (
      <div className="min-h-[100svh] px-4 pt-20 md:px-8">
        <div className="mx-auto max-w-[1100px]">
          <button onClick={() => (window.location.href = '/')} className="text-[10px] uppercase tracking-[0.4em]">
            Home
          </button>
          <p className="mt-8 text-sm text-[var(--text-2)]">{err}</p>
        </div>
      </div>
    )
  }

  if (!r) {
    return (
      <div className="min-h-[100svh] px-4 pt-20 md:px-8">
        <div className="mx-auto max-w-[1100px]">
          <button onClick={() => (window.location.href = '/')} className="text-[10px] uppercase tracking-[0.4em]">
            Home
          </button>
          <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Loading</p>
        </div>
      </div>
    )
  }

  const allFillers: Array<[string, number]> = []
  const fillerMap: Record<string, number> = {}
  r.evaluations.forEach((e) => {
    const v = (e as any).voice || {}
    const f = v.fillers || {}
    Object.keys(f).forEach((k) => {
      fillerMap[k.toLowerCase()] = (fillerMap[k.toLowerCase()] || 0) + Number(f[k] || 0)
    })
  })
  Object.keys(fillerMap)
    .sort((a, b) => fillerMap[b] - fillerMap[a])
    .forEach((k) => allFillers.push([k, fillerMap[k]]))
  const totalFillers = allFillers.reduce((a, [, c]) => a + c, 0)
  const hasSpeech = r.evaluations.some((e) => (e as any).voice && ((e as any).voice.word_count || (e as any).voice.duration_sec))

  const strengths: string[] = []
  const improvements: string[] = []
  r.evaluations.forEach((e) => {
    ;(e.strengths || []).forEach((s) => {
      if (s && !strengths.includes(s)) strengths.push(s)
    })
    ;(e.improvements || []).forEach((s) => {
      if (s && !improvements.includes(s)) improvements.push(s)
    })
  })

  const recs: string[] = []
  if (totalFillers > 5) recs.push('Practice pausing instead of using filler words like "um", "uh", or "like".')
  if (r.average_score < 7) recs.push('Focus on structuring answers with examples and measurable outcomes.')
  if (hasSpeech && totalFillers < 3) recs.push('Keep your natural pace — clarity is your strength.')
  if (recs.length === 0) recs.push('Continue practicing with role-specific questions to build consistency.')

  return (
    <div className="min-h-[100svh] px-4 pb-16 pt-16 md:px-8 md:pt-20">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 flex items-center justify-between">
          <button onClick={() => (window.location.href = '/')} className="text-[10px] uppercase tracking-[0.4em]">
            Home
          </button>
          <button onClick={() => (window.location.href = '/')} className="text-[10px] uppercase tracking-[0.4em]">
            New Session
          </button>
        </div>

        <div className="mb-12 text-center">
          <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--text-2)]">Interview Report</p>
          <h1 className="mt-4 text-[clamp(4rem,12vw,10rem)] leading-[0.85] tracking-[-0.06em] [font-family:var(--font-display)]">
            {r.average_score.toFixed(1)}
          </h1>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Overall Score / 10</p>
          <p className="mt-4 text-[11px] uppercase tracking-[0.3em] text-[var(--text-2)]">
            {r.answers_evaluated} Answers Evaluated
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="border border-[var(--line)] p-6">
            <p className="text-[10px] uppercase tracking-[0.4em]">Strengths</p>
            <ul className="mt-4 flex flex-col gap-2">
              {strengths.length > 0 ? (
                strengths.slice(0, 6).map((s, idx) => (
                  <li key={idx} className="text-[14px] leading-relaxed text-[var(--text-2)]">
                    — {s}
                  </li>
                ))
              ) : (
                <li className="text-[14px] text-[var(--text-2)]">— Review detailed feedback below</li>
              )}
            </ul>
          </div>
          <div className="border border-[var(--line)] p-6">
            <p className="text-[10px] uppercase tracking-[0.4em]">Areas for Improvement</p>
            <ul className="mt-4 flex flex-col gap-2">
              {improvements.length > 0 ? (
                improvements.slice(0, 6).map((s, idx) => (
                  <li key={idx} className="text-[14px] leading-relaxed text-[var(--text-2)]">
                    — {s}
                  </li>
                ))
              ) : (
                <li className="text-[14px] text-[var(--text-2)]">— Review detailed feedback below</li>
              )}
            </ul>
          </div>
        </div>

        {(hasSpeech || allFillers.length > 0) && (
          <div className="mt-6 border border-[var(--line)] p-6">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.4em]">Filler Word Analysis</p>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{totalFillers} Total</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {allFillers.length > 0 ? (
                allFillers.slice(0, 10).map(([k, c]) => (
                  <div key={k} className="flex items-center gap-2 border border-[var(--line)] px-3 py-1">
                    <span className="text-[12px]">"{k}"</span>
                    <span className="text-[12px] text-[var(--text-2)]">{c}</span>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-[var(--text-2)]">No significant filler words detected.</p>
              )}
            </div>
            <p className="mt-4 text-[12px] text-[var(--text-2)]">Based on actual speech-to-text analysis.</p>
          </div>
        )}

        <div className="mt-6 border border-[var(--line)] p-6">
          <p className="text-[10px] uppercase tracking-[0.4em]">Actionable Recommendations</p>
          <ul className="mt-4 flex flex-col gap-2">
            {recs.map((s, idx) => (
              <li key={idx} className="text-[14px] leading-relaxed text-[var(--text-2)]">
                — {s}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10">
          <p className="mb-6 text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Question by Question</p>
          <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {r.evaluations.map((e, i) => (
              <article key={i} className="grid gap-4 py-8 md:grid-cols-[auto_1fr_auto] md:gap-6">
                <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[clamp(1.1rem,2.6vw,2rem)] leading-[1.12] tracking-[-0.02em] [font-family:var(--font-display)]">{e.question}</p>
                  {e.verdict && <p className="mt-3 text-[14px] leading-relaxed text-[var(--text-2)]">{e.verdict}</p>}
                  {(e.strengths || []).length > 0 && (
                    <div className="mt-5">
                      <p className="text-[9px] uppercase tracking-[0.4em]">Strengths</p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {(e.strengths || []).map((s, idx) => (
                          <li key={idx} className="text-[13px] text-[var(--text-2)]">
                            — {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(e.improvements || []).length > 0 && (
                    <div className="mt-4">
                      <p className="text-[9px] uppercase tracking-[0.4em]">Improvements</p>
                      <ul className="mt-2 flex flex-col gap-1">
                        {(e.improvements || []).map((s, idx) => (
                          <li key={idx} className="text-[13px] text-[var(--text-2)]">
                            — {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(e as any).voice?.word_count && (
                    <p className="mt-4 text-[11px] text-[var(--text-2)]">
                      {Math.round((e as any).voice.word_count)} words · {(e as any).voice.wpm ? Math.round((e as any).voice.wpm) : '-'} WPM
                    </p>
                  )}
                </div>
                <span className="text-[clamp(1.6rem,4vw,3rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{e.score}</span>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
