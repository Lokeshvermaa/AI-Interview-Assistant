import { useEffect, useState } from 'react'
import { listInterviews } from '../api'

function scoreColor(score) {
  if (score >= 7) return 'text-emerald-600'
  if (score >= 4) return 'text-amber-600'
  return 'text-red-600'
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Date(value).toLocaleString()
  } catch {
    return value
  }
}

export default function History({ onOpen }) {
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    listInterviews()
      .then((res) => setItems(res.interviews))
      .catch((err) => setError(err.message))
  }, [])

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!items) return <p className="text-sm text-slate-500">Loading interviews…</p>
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No past interviews yet. Complete a mock interview to see it here.
      </p>
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Past interviews</h2>
      <p className="text-sm text-slate-500">Compare sessions and open one to review it.</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.session_id}>
            <button
              onClick={() => onOpen(it.session_id)}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-800">{it.title}</p>
                <p className="text-xs text-slate-500">
                  {formatDate(it.created_at)} · {it.answers_evaluated} answers
                </p>
              </div>
              <span className={'shrink-0 text-lg font-semibold ' + scoreColor(it.average_score)}>
                {it.average_score}/10
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
