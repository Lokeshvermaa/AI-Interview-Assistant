import { Mic } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { interview, evaluate, transcribe } from '@/lib/api'

export default function Interview() {
  const [sid] = useState(() => sessionStorage.getItem('ia:sid') || '')
  const [qs] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('ia:qs') || '[]')
    } catch {
      return []
    }
  })
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [rec, setRec] = useState(false)
  const [scored, setScored] = useState(0)
  const [index, setIndex] = useState(0)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const start = useRef(0)
  const bottom = useRef<HTMLDivElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const [bars, setBars] = useState<number[]>(Array(16).fill(4))
  const spoken = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!sid) {
      window.location.href = '/'
      return
    }
    if (qs.length === 0) {
      window.location.href = '/'
      return
    }
  }, [sid, qs.length])

  useEffect(() => {
    if (!sid || qs.length === 0) return
    let active = true
    void (async () => {
      setBusy(true)
      try {
        const res = await interview(sid, '')
        if (active) {
          setMessages([{ role: 'interviewer', content: res.reply }])
          speak(res.reply)
          spoken.current.add(0)
        }
      } finally {
        if (active) setBusy(false)
      }
    })()
    return () => {
      active = false
    }
  }, [sid, qs.length])

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  function speak(text: string) {
    try {
      if (typeof window === 'undefined') return
      if (!window.speechSynthesis) return
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
      const cur = qs[index]
      if (cur) {
        try {
          await evaluate(sid, cur.question, v, dur)
        } catch {}
        setScored((s) => s + 1)
        setIndex((i) => i + 1)
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
        const dur = (Date.now() - start.current) / 1000
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
          } else {
            setBusy(false)
          }
        } catch {
          setBusy(false)
          setRec(false)
        }
      }
      recRef.current = mr
      start.current = Date.now()
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

  if (!sid || qs.length === 0) return null

  return (
    <div className="min-h-[100svh] px-4 pb-6 pt-16 md:px-8 md:pt-20">
      <div className="mx-auto flex h-[calc(100svh-88px)] max-w-[980px] flex-col md:h-[calc(100svh-96px)]">
        <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
          <button onClick={() => (window.location.href = '/')} className="text-[10px] uppercase tracking-[0.4em]">
            Home
          </button>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-2)]">
            {scored}/{qs.length} Scored
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'candidate' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] md:max-w-[72%] ${m.role === 'candidate' ? 'text-right' : 'text-left'}`}>
                  <p className="mb-1 text-[9px] uppercase tracking-[0.4em] text-[var(--text-2)]">
                    {m.role === 'candidate' ? 'You' : 'Interviewer'}
                  </p>
                  <div
                    className={`rounded-sm px-4 py-3 text-[15px] leading-relaxed ${
                      m.role === 'candidate'
                        ? 'border border-[#d9e2ff] bg-[#f7f9ff] text-[#151515]'
                        : 'border border-[var(--line)] bg-white text-[#151515]'
                    }`}
                  >
                    <p className="tracking-[-0.01em]">{m.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex justify-start">
                <div className="max-w-[72%]">
                  <p className="mb-1 text-[9px] uppercase tracking-[0.4em] text-[var(--text-2)]">Interviewer</p>
                  <div className="rounded-sm border border-[var(--line)] bg-white px-4 py-2 text-[13px] text-[var(--text-2)]">
                    Thinking...
                  </div>
                </div>
              </div>
            )}
            <div ref={bottom} />
          </div>
        </div>

        {rec && (
          <div className="mt-3 flex items-center justify-center gap-1">
            {bars.map((h, i) => (
              <span key={i} className="w-[2px] rounded-full bg-[#172B4D]" style={{ height: `${h}px` }} />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-[var(--line)] pt-3">
          <button
            onClick={rec ? stopRec : startRec}
            className={`flex h-9 w-9 items-center justify-center rounded-sm border transition-colors ${
              rec ? 'border-[#172B4D] bg-[#DCE8F5]' : 'border-[var(--line)] hover:bg-neutral-50'
            }`}
            disabled={done || busy}
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
            placeholder={rec ? 'Listening...' : 'Type your answer...'}
            disabled={done || busy || rec}
            className="flex-1 rounded-sm border border-[var(--line)] bg-white px-3 py-2 text-[14px] outline-none placeholder:text-[var(--text-2)]"
          />
          <button
            onClick={() => void send(input)}
            disabled={done || busy || rec || !input.trim()}
            className="flex h-9 items-center gap-2 rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-4 text-[10px] uppercase tracking-[0.3em] text-[#172B4D] transition-colors hover:bg-[#c9dcf3] disabled:opacity-50"
          >
            Send
          </button>
        </div>

        {done && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                window.location.href = `/reports/${sid}`
              }}
              className="flex items-center gap-2 rounded-sm border border-[#7896B5] bg-[#DCE8F5] px-6 py-2 text-[10px] uppercase tracking-[0.4em] text-[#172B4D] transition-colors hover:bg-[#c9dcf3]"
            >
              View Report
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
