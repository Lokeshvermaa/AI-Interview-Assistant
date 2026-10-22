import { useEffect, useRef, useState } from 'react'
import { evaluate, interview, transcribe } from '../api'

function formatTime(total) {
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function Interview({ sessionId, questions, onFinish }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [index, setIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [scored, setScored] = useState(0)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [speak, setSpeak] = useState(true)

  const bottomRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const startedAtRef = useRef(0)
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const speakRef = useRef(true)
  // Token lets us cancel any speech that is still being read out.
  const speechTokenRef = useRef(0)

  useEffect(() => {
    speakRef.current = speak
  }, [speak])

  useEffect(() => {
    let active = true
    ;(async () => {
      setBusyState(true)
      try {
        const res = await interview(sessionId, '')
        if (active) {
          setMessages([{ role: 'interviewer', content: res.reply }])
          setDone(res.done)
          say(res.reply)
        }
      } catch (err) {
        if (active) setError(err.message)
      } finally {
        if (active) setBusyState(false)
      }
    })()
    return () => {
      active = false
      clearInterval(timerRef.current)
      speechTokenRef.current += 1
      window.speechSynthesis?.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function setBusyState(value) {
    busyRef.current = value
    setBusy(value)
  }

  // Read the reply sentence by sentence (sounds more natural than one block).
  function splitSentences(text) {
    const matches = (text || '').match(/[^.!?\n]+[.!?]*/g) || []
    return matches.map((s) => s.trim()).filter(Boolean)
  }

  function say(text) {
    const synth = typeof window !== 'undefined' ? window.speechSynthesis : null
    if (!speakRef.current || !synth) return
    synth.cancel()
    const token = ++speechTokenRef.current
    const parts = splitSentences(text)
    let i = 0
    const speakNext = () => {
      if (i >= parts.length || token !== speechTokenRef.current || !speakRef.current) {
        return
      }
      const utterance = new SpeechSynthesisUtterance(parts[i])
      utterance.rate = 0.97
      utterance.onend = () => {
        i += 1
        if (i < parts.length && token === speechTokenRef.current) {
          setTimeout(speakNext, 450) // short pause between sentences
        }
      }
      synth.speak(utterance)
    }
    speakNext()
  }

  async function sendAnswer(text, durationSec) {
    const value = (text || '').trim()
    if (!value || busyRef.current || done) return
    setError('')
    setBusyState(true)
    setInput('')
    setMessages((m) => [...m, { role: 'candidate', content: value }])

    try {
      const res = await interview(sessionId, value)
      setMessages((m) => [...m, { role: 'interviewer', content: res.reply }])
      setDone(res.done)
      say(res.reply)

      const current = questions[index]
      if (current) {
        await evaluate(sessionId, current.question, value, durationSec)
        setScored((s) => s + 1)
        setIndex((i) => i + 1)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyState(false)
    }
  }

  async function startRecording() {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Voice recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const duration = (Date.now() - startedAtRef.current) / 1000
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
        await handleRecording(blob, duration)
      }
      recorderRef.current = recorder
      startedAtRef.current = Date.now()
      recorder.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000))
      }, 250)
    } catch {
      setError('Microphone permission denied or unavailable.')
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    setRecording(false)
    recorderRef.current?.stop()
  }

  async function handleRecording(blob, duration) {
    if (!blob.size) {
      setError("Didn't catch any audio — please try again.")
      return
    }
    setBusyState(true)
    setError('')
    try {
      const { text } = await transcribe(blob)
      setBusyState(false)
      if (!text) {
        setError("Couldn't hear anything — please try again.")
        return
      }
      await sendAnswer(text, duration)
    } catch (err) {
      setBusyState(false)
      setError(err.message)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={speak}
            onChange={(e) => {
              setSpeak(e.target.checked)
              if (!e.target.checked) {
                speechTokenRef.current += 1
                window.speechSynthesis?.cancel()
              }
            }}
          />
          Read questions aloud
        </label>
        <span className="text-xs text-slate-400">
          {scored}/{questions.length} answers scored
        </span>
      </div>

      <div className="h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={m.role === 'candidate' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                'max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ' +
                (m.role === 'candidate'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-800')
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-slate-400">Interviewer is typing…</p>}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={done || (busy && !recording)}
          className={
            'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ' +
            (recording ? 'animate-pulse bg-red-600 hover:bg-red-700' : 'bg-slate-800 hover:bg-slate-900')
          }
        >
          <span>{recording ? '■' : '🎙'}</span>
          {recording ? `Stop ${formatTime(seconds)}` : 'Record'}
        </button>

        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendAnswer(input)}
          placeholder={done ? 'Interview complete' : 'Or type your answer…'}
          disabled={done || busy || recording}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-slate-100"
        />
        <button
          onClick={() => sendAnswer(input)}
          disabled={done || busy || recording || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>

      <button
        onClick={onFinish}
        disabled={scored === 0}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        View report ({scored} answer{scored === 1 ? '' : 's'} scored) →
      </button>
    </section>
  )
}
