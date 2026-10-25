import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Plus, X, Mic } from 'lucide-react'
import gsap from 'gsap'
import { ingest, generateQuestions, interview, evaluate, transcribe, getReport, listInterviews, type Question, type Report, type InterviewSummary } from '@/lib/api'
import { cn } from '@/lib/utils'

type Step = 'home' | 'questions' | 'interview' | 'report' | 'history'

export default function Home() {
  const hero = useRef<HTMLDivElement>(null)
  const lines = useRef<(HTMLSpanElement | null)[]>([])
  const [step, setStep] = useState<Step>('home')
  const [sid, setSid] = useState('')

  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [jdFile, setJdFile] = useState<File | null>(null)
  const [resumeText, setResumeText] = useState('')
  const [jdText, setJdText] = useState('')
  const [mode, setMode] = useState<'file' | 'text'>('file')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const rRef = useRef<HTMLInputElement>(null)
  const jRef = useRef<HTMLInputElement>(null)

  const [count, setCount] = useState(5)
  const [qs, setQs] = useState<Question[]>([])

  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [rec, setRec] = useState(false)
  const [scored, setScored] = useState(0)
  const [idx, setIdx] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startRecT = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const [bars, setBars] = useState<number[]>(Array(16).fill(4))

  const [report, setReport] = useState<Report | null>(null)
  const [hist, setHist] = useState<InterviewSummary[]>([])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(lines.current, {
        yPercent: 110,
        opacity: 0,
        stagger: 0.06,
        duration: 1.0,
        ease: 'power4.out',
        delay: 0.12,
      })
    }, hero)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const has = resumeFile || jdFile || resumeText.trim() || jdText.trim()

  async function doIngestAndGen() {
    setErr('')
    if (!has) return setErr('Add resume or JD.')
    setLoading(true)
    try {
      const ing = await ingest({ resumeFile, jdFile, resumeText, jdText })
      setSid(ing.session_id)
      sessionStorage.setItem('ia:sid', ing.session_id)
      const res = await generateQuestions(ing.session_id, count)
      setQs(res.questions)
      sessionStorage.setItem('ia:qs', JSON.stringify(res.questions))
      { setStep('questions'); }
    } catch (e: any) {
      setErr(e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function doGen() {
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

  function speak(text: string) {
    try {
      if (typeof window === 'undefined' || !window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.rate = 0.95
      utter.pitch = 1
      utter.volume = 1
      window.speechSynthesis.speak(utter)
    } catch {}
  }

  function startViz(stream: MediaStream) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      src.connect(analyser)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      const tick = () => {
        analyser.getByteFrequencyData(data)
        const out = []
        for (let i = 0; i < 16; i++) {
          const v = data[i * 2] || 0
          out.push(4 + (v / 255) * 18)
        }
        setBars(out)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch {}
  }

  function stopViz() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setBars(Array(16).fill(4))
    try {
      audioCtxRef.current?.close()
    } catch {}
    audioCtxRef.current = null
    analyserRef.current = null
  }

  async function startInterview() {
    { setStep('interview'); }
    setMessages([])
    setBusy(true)
    try {
      const res = await interview(sid, '')
      setMessages([{ role: 'interviewer', content: res.reply }])
      speak(res.reply)
    } finally {
      setBusy(false)
    }
  }

  async function send(txt: string, dur?: number) {
    const v = txt.trim()
    if (!v || busy || done) return
    setBusy(true)
    setInput('')
    setMessages((m) => [...m, { role: 'candidate', content: v }])
    try {
      const res = await interview(sid, v)
      setMessages((m) => [...m, { role: 'interviewer', content: res.reply }])
      setDone(res.done)
      speak(res.reply)
      const cur = qs[idx]
      if (cur) {
        try {
          await evaluate(sid, cur.question, v, dur)
        } catch {}
        setScored((s) => s + 1)
        setIdx((i) => i + 1)
      }
    } finally {
      setBusy(false)
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mr = new MediaRecorder(stream)
      chunks.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        stopViz()
        const dur = (Date.now() - startRecT.current) / 1000
        const blob = new Blob(chunks.current, { type: mr.mimeType || 'audio/webm' })
        if (!blob.size) {
          setRec(false)
          return
        }
        setBusy(true)
        try {
          const { text } = await transcribe(blob)
          setBusy(false)
          setRec(false)
          if (text && text.trim()) {
            await send(text, dur)
          }
        } catch {
          setBusy(false)
          setRec(false)
        }
      }
      recRef.current = mr
      startRecT.current = Date.now()
      mr.start()
      setRec(true)
      startViz(stream)
    } catch {
      setRec(false)
    }
  }

  function stopRec() {
    if (!rec) return
    setRec(false)
    try {
      recRef.current?.stop()
    } catch {}
  }

  useEffect(() => {
    return () => {
      try {
        window.speechSynthesis?.cancel()
      } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try {
        audioCtxRef.current?.close()
      } catch {}
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function openReport() {
    const r = await getReport(sid)
    setReport(r)
    { setStep('report'); }
  }

  async function openHist() {
    const res = await listInterviews()
    setHist(res.interviews)
    { setStep('history'); }
  }

  if (step === 'questions') {
    return (
      <div className="h-[100svh] overflow-hidden px-5 pt-16 pb-4 md:px-10">
        <div className="mx-auto flex h-full max-w-[1600px] flex-col">
          <div className="flex items-center justify-between">
            <button onClick={() => { setStep('home');  }} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">
              Home
            </button>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Questions</p>
          </div>
          <div className="mt-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.4em]">
              {[3, 5, 8, 10].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={cn(count === n && 'text-[var(--red)]')}>
                  {n}
                </button>
              ))}
            </div>
            <button
              onClick={doGen}
              disabled={loading}
              className="flex items-center gap-2 rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-5 py-2 text-[10px] uppercase tracking-[0.4em] text-[#172B4D] transition-colors hover:bg-[#c9dcf3] disabled:opacity-50"
            >
              {loading ? 'Generating' : qs.length ? 'Regenerate' : 'Generate'}
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--line)]">
            {qs.map((q, i) => (
              <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-4 py-4">
                <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{String(i + 1).padStart(2, '0')}</span>
                <p className="text-[clamp(1rem,2.2vw,1.8rem)] tracking-[-0.03em] [font-family:var(--font-display)]">{q.question}</p>
                <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{q.type || 'general'}</span>
              </div>
            ))}
          </div>
          {qs.length > 0 && (
            <div className="mt-3 flex justify-end border-t border-[var(--line)] pt-3">
              <button
                onClick={startInterview}
                className="flex items-center gap-2 rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-5 py-2 text-[10px] uppercase tracking-[0.4em] text-[#172B4D] transition-colors hover:bg-[#c9dcf3]"
              >
                Start Interview
                <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'interview') {
    return (
      <div className="h-[100svh] overflow-hidden px-4 pb-4 pt-16 md:px-8">
        <div className="mx-auto flex h-full max-w-[980px] flex-col">
          <div className="mb-3 flex items-center justify-between border-b border-[var(--line)] pb-3">
            <button onClick={() => { setStep('home');  }} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">
              Home
            </button>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">
              {scored}/{qs.length} Scored
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[82%] md:max-w-[72%] ${m.role === 'candidate' ? 'text-right' : 'text-left'}`}>
                    <p className="mb-1 text-[9px] uppercase tracking-[0.4em] text-[var(--text-2)]">
                      {m.role === 'candidate' ? 'You' : 'Interviewer'}
                    </p>
                    <div
                      className={`rounded-sm px-4 py-2.5 text-[14px] leading-relaxed ${
                        m.role === 'candidate'
                          ? 'border border-[#d9e2ff] bg-[#f7f9ff]'
                          : 'border border-[var(--line)] bg-white'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="rounded-sm border border-[var(--line)] bg-white px-3 py-1.5 text-[12px] text-[var(--text-2)]">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={bottom} />
            </div>
          </div>
          {rec && (
            <div className="mt-2 flex items-center justify-center gap-1">
              {bars.map((h, i) => (
                <span key={i} className="w-[2px] rounded-full bg-[#172B4D]" style={{ height: `${h}px` }} />
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center gap-2 border-t border-[var(--line)] pt-2">
            <button
              onClick={rec ? stopRec : startRec}
              disabled={done || busy}
              className={`flex h-9 w-9 items-center justify-center rounded-sm border ${rec ? 'border-[#172B4D] bg-[#DCE8F5]' : 'border-[var(--line)] hover:bg-neutral-50'}`}
            >
              <Mic className="h-4 w-4" />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send(input)
                }
              }}
              placeholder={rec ? 'Listening...' : 'Type answer...'}
              disabled={done || busy || rec}
              className="flex-1 rounded-sm border border-[var(--line)] px-3 py-2 text-[14px] outline-none"
            />
            <button
              onClick={() => void send(input)}
              disabled={done || busy || rec || !input.trim()}
              className="rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-4 py-2 text-[10px] uppercase tracking-[0.3em] text-[#172B4D] disabled:opacity-50"
            >
              Send
            </button>
          </div>
          {done && (
            <div className="mt-3 flex justify-center">
              <button
                onClick={openReport}
                className="rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-6 py-2 text-[10px] uppercase tracking-[0.4em] text-[#172B4D] hover:bg-[#c9dcf3]"
              >
                View Report
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'report' && report) {
    const allFillers: Array<[string, number]> = []
    const fillerMap: Record<string, number> = {}
    report.evaluations.forEach((e: any) => {
      const f = e.voice?.fillers || {}
      Object.keys(f).forEach((k) => {
        const key = k.toLowerCase()
        fillerMap[key] = (fillerMap[key] || 0) + Number(f[k] || 0)
      })
    })
    Object.keys(fillerMap)
      .sort((a, b) => fillerMap[b] - fillerMap[a])
      .forEach((k) => allFillers.push([k, fillerMap[k]]))
    const totalFillers = allFillers.reduce((a, [, c]) => a + c, 0)
    const strengths: string[] = []
    const improvements: string[] = []
    report.evaluations.forEach((e: any) => {
      ;(e.strengths || []).forEach((s: string) => {
        if (s && !strengths.includes(s)) strengths.push(s)
      })
      ;(e.improvements || []).forEach((s: string) => {
        if (s && !improvements.includes(s)) improvements.push(s)
      })
    })

    const recs: string[] = []
    if (totalFillers > 5) recs.push('Practice pausing instead of using filler words.')
    if (report.average_score < 7) recs.push('Use the STAR method with concrete examples.')
    if (recs.length === 0) recs.push('Great work. Focus on consistency with role-specific examples.')

    return (
      <div className="min-h-[100svh] overflow-y-auto px-4 pb-16 pt-16 md:px-8 md:pt-20">
        <div className="mx-auto max-w-[1100px]">
          <div className="mb-8 flex items-center justify-between">
            <button onClick={() => { setStep('home');  }} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">
              Home
            </button>
            <button onClick={() => setStep('history')} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">
              ← Back
            </button>
          </div>
          <div className="mb-8 text-center">
            <h1 className="text-[clamp(2.8rem,8vw,5rem)] leading-[0.9] tracking-[-0.05em] [font-family:var(--font-display)]">
              REPORT
            </h1>
            <p className="mt-3 text-[clamp(2.4rem,6vw,4rem)] tracking-[-0.04em] [font-family:var(--font-display)]">
              {report.average_score.toFixed(1)}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Overall Score / 10</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border border-[var(--line)] p-5">
              <p className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">Strengths</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {strengths.slice(0, 6).map((s, i) => (
                  <li key={i} className="text-[13px] text-[var(--text-2)]">
                    — {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="border border-[var(--line)] p-5">
              <p className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">Areas for Improvement</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {improvements.slice(0, 6).map((s, i) => (
                  <li key={i} className="text-[13px] text-[var(--text-2)]">
                    — {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4 border border-[var(--line)] p-5">
            <div className="flex items-center justify-between">
              <p className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">Filler Word Analysis</p>
              <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{totalFillers} Total</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {allFillers.length > 0 ? (
                allFillers.map(([k, c]) => (
                  <div key={k} className="border border-[var(--line)] px-3 py-1 text-[12px]">
                    "{k}" <span className="text-[var(--text-2)]">({c})</span>
                  </div>
                ))
              ) : (
                <p className="text-[12px] text-[var(--text-2)]">No filler words detected from transcript.</p>
              )}
            </div>
          </div>
          <div className="mt-4 border border-[var(--line)] p-5">
            <p className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">Recommendations</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {recs.map((s, i) => (
                <li key={i} className="text-[13px] text-[var(--text-2)]">
                  — {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-8 divide-y divide-[var(--line)] border-t border-[var(--line)]">
            {report.evaluations.map((e: any, i: number) => (
              <div key={i} className="grid gap-3 py-6 md:grid-cols-[auto_1fr_auto]">
                <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[clamp(1rem,2.4vw,1.8rem)] tracking-[-0.02em] [font-family:var(--font-display)]">{e.question}</p>
                  <p className="mt-2 text-[13px] text-[var(--text-2)]">{e.verdict}</p>
                  {(e.strengths || []).length > 0 && (
                    <p className="mt-3 text-[12px] text-[var(--text-2)]">Strengths: {(e.strengths || []).join(', ')}</p>
                  )}
                  {(e.improvements || []).length > 0 && (
                    <p className="mt-1 text-[12px] text-[var(--text-2)]">Improvements: {(e.improvements || []).join(', ')}</p>
                  )}
                </div>
                <span className="text-[clamp(1.4rem,3vw,2.4rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{e.score}</span>
              </div>
            ))}
          </div>
          {report.transcript && report.transcript.length > 0 && (
            <div className="mt-10">
              <p className="mb-4 text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Transcript</p>
              <div className="divide-y divide-[var(--line)] border border-[var(--line)]">
                {report.transcript.map((t: any, i: number) => (
                  <div key={i} className="p-4">
                    <p className="text-[9px] uppercase tracking-[0.4em] text-[var(--text-2)]">{t.role === 'candidate' ? 'You' : 'Interviewer'}</p>
                    <p className="mt-1 text-[13px] leading-relaxed">{t.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (step === 'history') {
    const sorted = [...hist].sort((a, b) => {
      if (!a.created_at && !b.created_at) return 0
      if (!a.created_at) return 1
      if (!b.created_at) return -1
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const total = sorted.length
    const avg = total > 0 ? sorted.reduce((s, it) => s + (Number(it.average_score) || 0), 0) / total : 0

    return (
      <div className="min-h-[100svh] overflow-y-auto px-4 pb-16 pt-16 md:px-8 md:pt-20">
        <div className="mx-auto max-w-[1300px]">
          <div className="mb-8 flex items-center justify-between">
            <button onClick={() => { setStep('home');  }} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">
              Home
            </button>
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Interview History</p>
          </div>

          <div className="mb-8 flex flex-col gap-4 border border-[var(--line)] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.5em] text-[var(--text-2)]">Dashboard</p>
              <p className="mt-2 text-[clamp(1.6rem,4vw,2.8rem)] tracking-[-0.03em] [font-family:var(--font-display)]">
                Past Interviews
              </p>
            </div>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Total</p>
                <p className="mt-1 text-[clamp(1.4rem,3vw,2.2rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{total}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Avg Score</p>
                <p className="mt-1 text-[clamp(1.4rem,3vw,2.2rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{avg.toFixed(1)} / 10</p>
              </div>
            </div>
          </div>

          <div className="border border-[var(--line)]">
            <div className="hidden grid-cols-[80px_1.6fr_1fr_120px_140px] items-center border-b border-[var(--line)] px-6 py-3 text-[9px] uppercase tracking-[0.4em] text-[var(--text-2)] md:grid">
              <span>#</span>
              <span>Job Title</span>
              <span>Date</span>
              <span>Score</span>
              <span className="text-right">Action</span>
            </div>
            <div className="divide-y divide-[var(--line)]">
              {sorted.length === 0 && (
                <div className="px-6 py-8 text-[13px] text-[var(--text-2)]">No interviews yet.</div>
              )}
              {sorted.map((it, idx) => {
                const num = String(idx + 1).padStart(2, '0')
                const title = it.title && it.title.trim() ? it.title.trim() : 'Untitled Interview'
                const date = it.created_at ? new Date(it.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-'
                const score = Number(it.average_score || 0).toFixed(1)
                return (
                  <button
                    key={it.session_id}
                    onClick={async () => {
                      const r = await getReport(it.session_id)
                      setReport(r)
                      setSid(it.session_id)
                      sessionStorage.setItem('ia:sid', it.session_id)
                      sessionStorage.setItem('ia:qs', JSON.stringify((r as any).questions || []))
                      { setStep('report'); }
                    }}
                    className="grid w-full grid-cols-1 items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-neutral-50 md:grid-cols-[80px_1.6fr_1fr_120px_140px] md:px-6"
                  >
                    <span className="text-[11px] tracking-[0.3em] text-[var(--text-2)]">#{num}</span>
                    <div>
                      <p className="text-[clamp(1rem,2vw,1.4rem)] tracking-[-0.02em] [font-family:var(--font-display)]">{title}</p>
                      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-[var(--text-2)] md:hidden">{date} · {score} / 10</p>
                    </div>
                    <span className="hidden text-[12px] text-[var(--text-2)] md:block">{date}</span>
                    <span className="hidden text-[clamp(1.2rem,2vw,1.6rem)] tracking-[-0.04em] [font-family:var(--font-display)] md:block">{score} / 10</span>
                    <div className="hidden items-center justify-end gap-2 md:flex">
                      <span className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black">View Report</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={hero} className="h-[100svh] overflow-hidden">
      <section className="flex h-full flex-col justify-between px-5 pt-14 pb-3 md:px-10 md:pt-16 md:pb-4">
        <div className="mx-auto grid w-full max-w-[1700px] items-center gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="overflow-hidden">
              <span ref={(el) => { lines.current[0] = el }} className="block text-[4.6vw] font-medium leading-[0.9] tracking-[-0.05em] [font-family:var(--font-display)]">
                AI INTERVIEW
              </span>
            </div>
            <div className="overflow-hidden">
              <span ref={(el) => { lines.current[1] = el }} className="block text-[4.6vw] font-medium leading-[0.9] tracking-[-0.05em] [font-family:var(--font-display)]">
                ASSISTANT
              </span>
            </div>
          </div>
          <div className="hidden lg:flex flex-col justify-center">
            <p className="text-right text-[clamp(1rem,2vw,1.8rem)] font-semibold uppercase leading-[1.1] tracking-[0.08em] [font-family:var(--font-display)]">
              PRACTICE SMARTER.
              <br />
              INTERVIEW BETTER.
            </p>
            <p className="mt-3 max-w-sm self-end text-right text-[11px] leading-relaxed tracking-[0.18em] text-[var(--text-2)]">
              AI-powered interview practice with personalized questions, voice or text sessions, and instant feedback for students and job seekers.
            </p>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="mb-4 flex items-end justify-between">
            <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Upload & Generate</p>
            <button onClick={openHist} className="px-4 py-1.5 bg-[#151515] text-white text-[10px] uppercase tracking-[0.4em] hover:bg-black translate-y-1">
              History
            </button>
          </div>
          <div className="mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.4em]">
            <button
              onClick={() => setMode('file')}
              className={cn('px-3 py-1.5 border text-[10px] uppercase tracking-[0.4em] transition-colors', mode === 'file' ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]' : 'bg-white text-[#151515] border-[var(--line)] hover:bg-neutral-50')}
            >
              Files
            </button>
            <button
              onClick={() => setMode('text')}
              className={cn('px-3 py-1.5 border text-[10px] uppercase tracking-[0.4em] transition-colors', mode === 'text' ? 'bg-[#1f1f1f] text-white border-[#1f1f1f]' : 'bg-white text-[#151515] border-[var(--line)] hover:bg-neutral-50')}
            >
              Text
            </button>
          </div>
          {mode === 'file' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <button
                onClick={() => rRef.current?.click()}
                className="group flex h-[16vh] flex-col justify-between border border-[var(--line)] p-4 hover:border-[#172B4D] md:h-[18vh]"
              >
                <input ref={rRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => setResumeFile(e.target.files?.[0] || null)} />
                <div className="flex items-start justify-between">
                  <p className="px-4 py-1.5 bg-[#2b2b2b] text-white text-[10px] uppercase tracking-[0.4em]">Resume</p>
                  {resumeFile ? <X className="h-3 w-3" onClick={(e) => { e.stopPropagation(); setResumeFile(null) }} /> : <Plus className="h-3 w-3" />}
                </div>
                <p className="text-[clamp(1rem,2.6vw,2rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{resumeFile ? resumeFile.name : 'Drop or select file'}</p>
              </button>
              <button
                onClick={() => jRef.current?.click()}
                className="group flex h-[16vh] flex-col justify-between border border-[var(--line)] p-4 hover:border-[#172B4D] md:h-[18vh]"
              >
                <input ref={jRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => setJdFile(e.target.files?.[0] || null)} />
                <div className="flex items-start justify-between">
                  <p className="px-4 py-1.5 bg-[#2b2b2b] text-white text-[10px] uppercase tracking-[0.4em]">Job Description</p>
                  {jdFile ? <X className="h-3 w-3" onClick={(e) => { e.stopPropagation(); setJdFile(null) }} /> : <Plus className="h-3 w-3" />}
                </div>
                <p className="text-[clamp(1rem,2.6vw,2rem)] tracking-[-0.04em] [font-family:var(--font-display)]">{jdFile ? jdFile.name : 'Drop or select file'}</p>
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste resume..." className="h-[16vh] border border-[var(--line)] p-4 outline-none md:h-[18vh]" />
              <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste job description..." className="h-[16vh] border border-[var(--line)] p-4 outline-none md:h-[18vh]" />
            </div>
          )}
          {err && <p className="mt-2 text-xs text-[var(--red)]">{err}</p>}
          <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3">
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.4em]">
              {[3, 5, 8, 10].map((n) => (
                <button key={n} onClick={() => setCount(n)} className={cn(count === n && 'text-[var(--red)]')}>
                  {n} Q
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                if (!has || loading) return
                void doIngestAndGen()
              }}
              disabled={loading}
              className={`group flex items-center gap-2 px-7 py-2.5 text-[10px] uppercase tracking-[0.4em] border transition-all duration-300 ${loading ? 'bg-[#e5e7eb] text-[#6b7280] border-[#cbd5e1] cursor-not-allowed' : has ? 'bg-[#DCE8F5] text-[#172B4D] border-[#7896B5] hover:bg-[#c9dcf3] hover:border-[#6a8bb3] cursor-pointer' : 'bg-[#f8f9fa] text-[#6b7280] border-[#cbd5e1] cursor-not-allowed'}`}
            >
              {loading ? 'Processing' : 'Generate Questions'}
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[1700px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Workflow</span>
            <span className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">Step 01 — 04</span>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              ['01', 'Upload', 'Resume & JD'],
              ['02', 'Generate', 'Tailored Questions'],
              ['03', 'Practice', 'Voice or Text'],
              ['04', 'Report', 'Feedback & Score'],
            ].map(([num, title, sub], idx) => (
              <div key={num} className="relative flex items-center gap-3 rounded-sm border border-[var(--line)] px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#151515] text-[10px] text-white">{num}</div>
                <div className="flex flex-col">
                  <span className="text-[12px] tracking-[-0.01em] [font-family:var(--font-display)]">{title}</span>
                  <span className="text-[10px] text-[var(--text-2)]">{sub}</span>
                </div>
                {idx < 3 && <div className="absolute -right-1.5 hidden h-px w-3 bg-[var(--line)] md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
