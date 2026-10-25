import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { listInterviews, type InterviewSummary } from '@/lib/api'

export default function History() {
  const [items, setItems] = useState<InterviewSummary[]>([])

  useEffect(() => {
    listInterviews().then(r => setItems(r.interviews)).catch(() => {})
  }, [])

  return (
    <div className="min-h-[100svh] px-5 pt-28 pb-20 md:px-10">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-16">
          <p className="text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">Archive</p>
          <h1 className="mt-6 text-[clamp(3rem,10vw,12rem)] leading-[0.9] tracking-[-0.06em] [font-family:var(--font-display)]">
            HISTORY
          </h1>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {items.map((it) => (
            <Link key={it.session_id} to={`/reports/${it.session_id}`} className="group grid grid-cols-[1fr_auto] items-center gap-6 py-8 md:grid-cols-[2fr_1fr_auto]">
              <div>
                <p className="text-[clamp(1.5rem,4vw,3rem)] tracking-[-0.04em] [font-family:var(--font-display)] transition-transform duration-700 group-hover:translate-x-2">
                  {it.title}
                </p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)]">
                  {it.answers_evaluated} Answers
                </p>
              </div>
              <p className="hidden text-[11px] uppercase tracking-[0.4em] text-[var(--text-2)] md:block">
                {it.created_at ? new Date(it.created_at).toLocaleDateString() : ''}
              </p>
              <div className="flex items-center gap-4">
                <span className="text-[clamp(1.5rem,3vw,2.5rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{it.average_score.toFixed(1)}</span>
                <ArrowUpRight className="h-4 w-4 transition-transform duration-700 group-hover:-translate-y-1 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
