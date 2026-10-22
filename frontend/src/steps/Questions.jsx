import { useState } from 'react'
import { generateQuestions } from '../api'

const TYPES = {
  technical: 'bg-blue-50 text-blue-700',
  behavioral: 'bg-purple-50 text-purple-700',
  'resume-specific': 'bg-amber-50 text-amber-700',
  'role-fit': 'bg-emerald-50 text-emerald-700',
}

export default function Questions({ sessionId, questions, setQuestions, onNext }) {
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function generate() {
    setError('')
    setLoading(true)
    try {
      const res = await generateQuestions(sessionId, count)
      setQuestions(res.questions)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm text-slate-600">
          Number of questions
          <select
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="ml-2 rounded-md border border-slate-300 px-2 py-1"
          >
            {[3, 5, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate questions'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-start gap-3">
              <span className="font-semibold text-slate-400">{i + 1}</span>
              <div>
                <p className="text-slate-800">{q.question}</p>
                <div className="mt-1 flex gap-2 text-xs">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 ' +
                      (TYPES[q.type] || 'bg-slate-100 text-slate-600')
                    }
                  >
                    {q.type || 'general'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {q.difficulty || 'medium'}
                  </span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {questions.length > 0 && (
        <button
          onClick={onNext}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700"
        >
          Start mock interview →
        </button>
      )}
    </section>
  )
}
