export default function Stepper({ steps, current }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-sm">
      {steps.map((label, i) => {
        const state = i === current ? 'active' : i < current ? 'done' : 'todo'
        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-medium ' +
                (state === 'active'
                  ? 'bg-indigo-600 text-white'
                  : state === 'done'
                    ? 'bg-indigo-200 text-indigo-700'
                    : 'bg-slate-200 text-slate-500')
              }
            >
              {i + 1}
            </span>
            <span className={state === 'todo' ? 'text-slate-400' : 'text-slate-700'}>
              {label}
            </span>
            {i < steps.length - 1 && <span className="h-px flex-1 bg-slate-200" />}
          </li>
        )
      })}
    </ol>
  )
}
