import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'

export function Nav() {
  return (
    <header className="fixed left-0 top-0 z-50 w-full mix-blend-difference">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-5 md:px-10">
        <Link to="/" className="text-[11px] uppercase tracking-[0.4em] text-white">
          Interview Studio
        </Link>
        <nav className="flex items-center gap-8 text-[11px] uppercase tracking-[0.4em] text-white">
          <Link to="/history" className="relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-white after:transition-all after:duration-500 hover:after:w-full">
            Archive
          </Link>
          <Link to="/upload" className="group flex items-center gap-2">
            Start
            <ArrowUpRight className="h-3 w-3 transition-transform duration-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
