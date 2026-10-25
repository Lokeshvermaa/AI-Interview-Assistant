import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'

export function Preloader({ onDone }: { onDone: () => void }) {
  const [count, setCount] = useState(0)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current = 0
    const timer = setInterval(() => {
      current += Math.floor(Math.random() * 12) + 8
      if (current >= 100) {
        current = 100
        clearInterval(timer)
        setTimeout(() => {
          if (!container.current) return
          gsap.to(container.current, {
            yPercent: -100,
            duration: 1.2,
            ease: 'power4.inOut',
            onComplete: onDone,
          })
        }, 400)
      }
      setCount(current)
    }, 60)
    return () => clearInterval(timer)
  }, [onDone])

  return (
    <div ref={container} className="fixed inset-0 z-[60] flex items-center justify-center bg-[#050505]">
      <div className="flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-[12vw] leading-none text-white md:text-[10vw]">
          {count}
        </span>
        <span className="text-[4vw] text-white/60 md:text-[3vw]">%</span>
      </div>
    </div>
  )
}
