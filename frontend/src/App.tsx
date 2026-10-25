import { useEffect, useState } from 'react'
import Home from '@/pages/Home'
import { Cursor } from '@/components/Cursor'
import { Preloader } from '@/components/Preloader'
import Lenis from 'lenis'
import gsap from 'gsap'

export default function App() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.08, smoothWheel: true })
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(tick)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <Cursor />
      {!loaded && <Preloader onDone={() => setLoaded(true)} />}
      <main className="min-h-[100svh] overflow-x-hidden">
        <Home />
      </main>
    </>
  )
}
