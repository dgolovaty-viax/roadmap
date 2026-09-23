import { useState, useRef, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

function ViaxLogo() {
  return (
    <svg width="93" height="24" viewBox="0 0 285 74" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="viax.io">
      <path d="M258.095 74C242.927 74 232.079 64.6667 232.079 47.7143C232.079 30.0953 242.927 21.5238 258.095 21.5238C273.359 21.5238 284.207 30.0953 284.207 47.7143C284.207 64.6667 273.359 74 258.095 74ZM258.095 63.0476C266.351 63.0476 272.207 57.5238 272.207 47.8095C272.207 37.7143 266.351 32.5715 258.095 32.5715C249.935 32.5715 244.079 37.7143 244.079 47.8095C244.079 57.5238 249.935 63.0476 258.095 63.0476Z" fill="#FEFEFE"/>
      <path d="M212.084 72.8571V22.6667H224.948V72.8571H212.084ZM211.028 0H226.004V13.2381H211.028V0Z" fill="#FEFEFE"/>
      <path d="M189.174 59.5237H203.19V72.857H189.174V59.5237Z" fill="#FEFEFE"/>
      <path d="M100.267 74C85.9627 74 75.5947 64.7619 75.5947 47.8095C75.5947 30.1905 85.9627 21.5238 100.267 21.5238C108.331 21.5238 114.667 24.5715 118.507 30.4762L119.659 22.6667H128.683V72.8572H119.467L118.411 65.0476C114.571 70.8572 108.331 74 100.267 74ZM101.611 63.0476C109.867 63.0476 115.723 57.5238 115.723 47.8095C115.723 37.7143 109.867 32.5715 101.611 32.5715C93.4507 32.5715 87.5947 37.7143 87.5947 47.8095C87.5947 57.5238 93.4507 63.0476 101.611 63.0476Z" fill="#FEFEFE"/>
      <path d="M55.6004 72.8571V22.6667H68.4644V72.8571H55.6004ZM54.5444 0H69.5204V13.2381H54.5444V0Z" fill="#FEFEFE"/>
      <path d="M18.336 72.8571L0 30.9523V22.6666H9.984L24.96 61.0475L39.648 22.6666H49.536V30.9523L31.296 72.8571H18.336Z" fill="#FEFEFE"/>
      <path d="M158.755 57.8916L147.656 72.9756H137V63.0879L149.21 48.3457L158.755 57.8916ZM181.064 63.0879V72.9756H170.12L159.23 58.1768L168.898 48.5088L181.064 63.0879ZM158.622 36.5127L148.93 46.2051L137 31.8877V22H148.136L158.622 36.5127ZM181.064 31.8877L169.18 46.043L159.367 36.2314L169.928 22H181.064V31.8877Z" fill="#5ED49A"/>
    </svg>
  )
}

const navLinkClass = ({ isActive }) =>
  `text-sm transition-colors duration-150 ${
    isActive
      ? 'text-[#90E9B8]'
      : 'text-[rgba(255,255,255,0.65)] hover:text-white'
  }`

// ── Dropdown nav group ─────────────────────────────────────────────────
// Used by "Marketing Blitz". Closes on outside click, Escape, or navigation.

function NavDropdown({ label, basePath, items }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const location = useLocation()
  const active = location.pathname.startsWith(basePath)

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`text-sm transition-colors duration-150 flex items-center gap-1.5 ${
          active || open ? 'text-[#90E9B8]' : 'text-[rgba(255,255,255,0.65)] hover:text-white'
        }`}
      >
        {label}
        <svg width="9" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-2 min-w-[190px] rounded-lg border border-[#383838] bg-[#1E1E1E] py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.45)]"
        >
          {items.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              className={({ isActive }) =>
                `block px-4 py-2 text-sm transition-colors duration-150 ${
                  isActive
                    ? 'text-[#90E9B8]'
                    : 'text-[rgba(255,255,255,0.72)] hover:text-white hover:bg-[#2A2A2A]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

// Campaigns in the Marketing Blitz dropdown. To add the next one: append an
// item here, add a BLITZ_CONTENT entry in src/pages/BlitzPage.jsx, and the
// route resolves automatically via /blitz/:slug.
const BLITZ_ITEMS = [
  { to: '/blitz/rmb', label: 'Blitz: RMB' },
]

export default function Nav() {
  return (
    <nav
      style={{ fontFamily: "'Funnel Sans', 'Inter', system-ui, sans-serif" }}
      className="fixed top-0 left-0 right-0 z-50 h-14 flex items-center px-6 bg-[#1E1E1E] border-b border-[#383838]"
    >
      {/* Logo */}
      <NavLink to="/" className="flex items-center shrink-0 mr-8">
        <ViaxLogo />
      </NavLink>

      {/* Nav links */}
      <div className="flex items-center gap-7">
        <NavLink to="/" end className={navLinkClass}>
          Roadmap
        </NavLink>
        <NavLink to="/north-star" className={navLinkClass}>
          North Star
        </NavLink>
        <NavLink to="/forma-one-pager" className={navLinkClass}>
          Forma One Pager
        </NavLink>
        <NavLink to="/release-pipeline" className={navLinkClass}>
          AI-Augmented Releasing
        </NavLink>
        <NavLink to="/support-pipeline" className={navLinkClass}>
          AI-Augmented Support
        </NavLink>
        <NavLink to="/simplification" className={navLinkClass}>
          Simplification and Scaling
        </NavLink>
        <NavLink to="/planning" className={navLinkClass}>
          Planning
        </NavLink>
        <NavLink to="/ideas" className={navLinkClass}>
          Ideas
        </NavLink>
        <NavLink to="/support" className={navLinkClass}>
          Support
        </NavLink>
        <NavLink to="/priority-board" className={navLinkClass}>
          Priority Board
        </NavLink>
        <NavLink to="/press-releases" className={navLinkClass}>
          Press Releases
        </NavLink>
        <NavDropdown label="Marketing Blitz" basePath="/blitz" items={BLITZ_ITEMS} />
      </div>
    </nav>
  )
}
