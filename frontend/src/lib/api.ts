export interface Question {
  question: string
  type?: string
  difficulty?: string
}

export interface VoiceMetrics {
  word_count?: number
  duration_sec?: number
  wpm?: number
  filler_count?: number
  fillers?: Record<string, number>
}

export interface Evaluation {
  question: string
  score: number
  verdict?: string
  voice?: VoiceMetrics | null
  strengths?: string[]
  improvements?: string[]
  model_answer?: string
}

export interface TranscriptTurn {
  role: string
  content: string
}

export interface Report {
  session_id?: string
  title?: string
  created_at?: string
  questions_asked: number
  answers_evaluated: number
  average_score: number
  evaluations: Evaluation[]
  transcript?: TranscriptTurn[]
}

export interface InterviewSummary {
  session_id: string
  title: string
  created_at?: string
  answers_evaluated: number
  average_score: number
}

export interface IngestInput {
  resumeFile?: File | null
  jdFile?: File | null
  resumeText?: string
  jdText?: string
  sessionId?: string
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

const BASE = '/api'

async function handle<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as { detail?: string }
  if (!response.ok) {
    throw new ApiError(data.detail || `Request failed (${response.status})`, response.status)
  }
  return data as T
}

export async function ingest(input: IngestInput): Promise<{ session_id: string }> {
  const form = new FormData()
  if (input.resumeFile) form.append('resume_file', input.resumeFile)
  if (input.jdFile) form.append('jd_file', input.jdFile)
  form.append('resume_text', input.resumeText || '')
  form.append('jd_text', input.jdText || '')
  if (input.sessionId) form.append('session_id', input.sessionId)

  return handle(await fetch(`${BASE}/ingest`, { method: 'POST', body: form }))
}

export async function generateQuestions(sessionId: string, n = 5): Promise<{ questions: Question[] }> {
  return handle(
    await fetch(`${BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, n }),
    }),
  )
}

export async function interview(sessionId: string, message = ''): Promise<{ reply: string; done: boolean }> {
  return handle(
    await fetch(`${BASE}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
  )
}

export async function evaluate(sessionId: string, question: string, answer: string, durationSec?: number): Promise<unknown> {
  return handle(
    await fetch(`${BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, question, answer, duration_sec: durationSec ?? null }),
    }),
  )
}

export async function transcribe(blob: Blob): Promise<{ text: string }> {
  const type = blob.type || ''
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `answer.${ext}`)
  return handle(await fetch(`${BASE}/transcribe`, { method: 'POST', body: form }))
}

export async function getReport(sessionId: string): Promise<Report> {
  return handle(await fetch(`${BASE}/report/${sessionId}`))
}

export async function listInterviews(): Promise<{ interviews: InterviewSummary[] }> {
  return handle(await fetch(`${BASE}/interviews`))
}
