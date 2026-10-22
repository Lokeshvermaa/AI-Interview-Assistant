// One function per backend endpoint. The /api prefix is proxied to FastAPI by Vite.
const BASE = '/api'

async function handle(res) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.detail || `Request failed (${res.status})`)
  }
  return data
}

export async function ingest({ resumeFile, jdFile, resumeText, jdText, sessionId }) {
  const form = new FormData()
  if (resumeFile) form.append('resume_file', resumeFile)
  if (jdFile) form.append('jd_file', jdFile)
  form.append('resume_text', resumeText || '')
  form.append('jd_text', jdText || '')
  if (sessionId) form.append('session_id', sessionId)

  return handle(await fetch(`${BASE}/ingest`, { method: 'POST', body: form }))
}

export async function generateQuestions(sessionId, n = 5) {
  return handle(
    await fetch(`${BASE}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, n }),
    }),
  )
}

export async function interview(sessionId, message = '') {
  return handle(
    await fetch(`${BASE}/interview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, message }),
    }),
  )
}

export async function evaluate(sessionId, question, answer, durationSec) {
  return handle(
    await fetch(`${BASE}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        question,
        answer,
        duration_sec: durationSec ?? null,
      }),
    }),
  )
}

export async function transcribe(blob) {
  const type = blob.type || ''
  const ext = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm'
  const form = new FormData()
  form.append('audio', blob, `answer.${ext}`)
  return handle(await fetch(`${BASE}/transcribe`, { method: 'POST', body: form }))
}

export async function getReport(sessionId) {
  return handle(await fetch(`${BASE}/report/${sessionId}`))
}

export async function listInterviews() {
  return handle(await fetch(`${BASE}/interviews`))
}
