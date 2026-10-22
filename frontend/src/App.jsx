import { useState } from 'react'
import Stepper from './components/Stepper'
import Upload from './steps/Upload'
import Questions from './steps/Questions'
import Interview from './steps/Interview'
import Report from './steps/Report'
import History from './steps/History'

const STEPS = ['Upload', 'Questions', 'Interview', 'Report']

function Tab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={
        'rounded-lg px-3 py-1.5 text-sm font-medium ' +
        (active ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100')
      }
    >
      {children}
    </button>
  )
}

export default function App() {
  // Three screens: the step-by-step wizard, the past-interviews list, or one past report.
  const [mode, setMode] = useState('wizard') // wizard | history | view
  const [step, setStep] = useState(0)
  const [sessionId, setSessionId] = useState('')
  const [questions, setQuestions] = useState([])
  const [viewSession, setViewSession] = useState('')

  function startNew() {
    setMode('wizard')
    setStep(0)
    setSessionId('')
    setQuestions([])
    setViewSession('')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold">AI Interview Assistant</h1>
            <p className="text-sm text-slate-500">
              RAG-powered mock interviews with instant feedback
            </p>
          </div>
          <nav className="flex shrink-0 gap-1">
            <Tab active={mode === 'wizard'} onClick={startNew}>
              New Interview
            </Tab>
            <Tab active={mode !== 'wizard'} onClick={() => setMode('history')}>
              Past Interviews
            </Tab>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {mode === 'wizard' && (
          <>
            <Stepper steps={STEPS} current={step} />
            {step === 0 && (
              <Upload
                onDone={(id) => {
                  setSessionId(id)
                  setStep(1)
                }}
              />
            )}
            {step === 1 && (
              <Questions
                sessionId={sessionId}
                questions={questions}
                setQuestions={setQuestions}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <Interview
                sessionId={sessionId}
                questions={questions}
                onFinish={() => setStep(3)}
              />
            )}
            {step === 3 && <Report sessionId={sessionId} />}
          </>
        )}

        {mode === 'history' && (
          <History
            onOpen={(id) => {
              setViewSession(id)
              setMode('view')
            }}
          />
        )}

        {mode === 'view' && (
          <div className="space-y-4">
            <button
              onClick={() => setMode('history')}
              className="text-sm text-indigo-600 hover:underline"
            >
              ← Back to past interviews
            </button>
            <Report sessionId={viewSession} />
          </div>
        )}
      </main>
    </div>
  )
}
