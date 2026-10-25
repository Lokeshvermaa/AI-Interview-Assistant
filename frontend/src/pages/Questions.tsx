import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { generateQuestions, type Question } from '@/lib/api'
import { cn } from '@/lib/utils'

export default function Questions() {
  const nav = useNavigate()
  const sid = sessionStorage.getItem('ia:sid') || ''
  const [count, setCount] = useState(5)
  const [qs, setQs] = useState<Question[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => { if (!sid) nav('/upload') }, [nav, sid])
  if (!sid) return null

  async function gen() {
    setErr('')
    setLoading(true)
    try {
      const res = await generateQuestions(sid, count)
      setQs(res.questions)
      sessionStorage.setItem('ia:qs', JSON.stringify(res.questions))
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
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">Questions</p>
          <h1 className="mt-6 text-[clamp(3rem,10vw,12rem)] leading-[0.9] tracking-[-0.06em] [font-family:var(--font-display)]">
            TAILORED
          </h1>
        </div>

        <div className="mb-12 flex flex-wrap items-center justify-between gap-6 border-b border-[var(--line)] pb-8">
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.4em]">
            {[3,5,8,10].map(n => (
              <button key={n} onClick={() => setCount(n)} className={cn(count === n && 'text-[var(--red)]')}>
                {n}
              </button>
            ))}
          </div>
          <button onClick={gen} disabled={loading} className="group flex items-center gap-3 text-[11px] uppercase tracking-[0.4em] disabled:opacity-40">
            <span className="relative">
              {loading ? 'Generating' : qs.length ? 'Regenerate' : 'Generate'}
              <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-[var(--text)] transition-transform duration-700 group-hover:origin-left group-hover:scale-x-100" />
            </span>
            <ArrowUpRight className="h-3 w-3 transition-transform duration-700 group-hover:-translate-y-1 group-hover:translate-x-1" />
          </button>
        </div>

        {err && <p className="mb-10 text-sm text-[var(--red)]">{err}</p>}

        <div className="divide-y divide-[var(--line)]">
          {qs.map((q, i) => (
            <article key={i} className="grid gap-4 py-10 md:grid-cols-[auto_1fr_auto] md:items-start">
              <span className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">{String(i+1).padStart(2,'0')}</span>
              <p className="text-[clamp(1.5rem,4vw,3.5rem)] leading-[1.05] tracking-[-0.04em] [font-family:var(--font-display)]">
                {q.question}
              </p>
              <span className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">{q.type || 'general'}</span>
            </article>
          ))}
        </div>

        {qs.length > 0 && (
          <div className="mt-16 flex justify-end">
            <button onClick={() => nav('/interview')} className="group flex items-center gap-3 text-[11px] uppercase tracking-[0.4em]">
              <span className="relative">
                Start Interview
                <span className="absolute -bottom-1 left-0 h-px w-full origin-right scale-x-0 bg-[var(--text)] transition-transform duration-700 group-hover:origin-left group-hover:scale-x-100" />
              </span>
              <ArrowUpRight className="h-3 w-3 transition-transform duration-700 group-hover:-translate-y-1 group-hover:translate-x-1" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
