import { useState } from 'react'

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

function downloadHTML(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

function IconExternal() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M5.25 2.625H2.625A1.125 1.125 0 001.5 3.75v7.625A1.125 1.125 0 002.625 12.5H10.25a1.125 1.125 0 001.125-1.125V8.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M8.5 1.5h4m0 0v4m0-4L7 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function IconDownload() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
      <path d="M7 1.5v7m0 0L4.5 6m2.5 2.5L9.5 6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M1.5 10.5v1A1.5 1.5 0 003 13h8a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

function Btn({ onClick, children, muted }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#2e2e2e' : 'transparent',
        border: '1px solid ' + (hovered ? '#555' : '#3a3a3a'),
        borderRadius: 5,
        color: muted ? '#888' : '#90E9B8',
        fontFamily: FONT,
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 9px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        transition: 'all 0.12s',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </button>
  )
}

export default function RoadmapPage() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <iframe
        src="/roadmap.html"
        className="w-full h-screen border-0"
        title="viax Roadmap"
      />

      {/* Floating control panel — bottom right */}
      <div style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
        fontFamily: FONT,
      }}>

        {/* Expanded download panel */}
        {open && (
          <div style={{
            background: '#1E1E1E',
            border: '1px solid #383838',
            borderRadius: 10,
            padding: '14px 16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35)',
            minWidth: 220,
          }}>
            {/* Internal roadmap row */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
                Internal Roadmap
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn onClick={() => downloadHTML('/roadmap.html', 'viax-roadmap-2026.html')}>
                  <IconDownload /> Download
                </Btn>
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid #2e2e2e', marginBottom: 12 }} />

            {/* Client roadmap row */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7 }}>
                Client Roadmap
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Btn onClick={() => downloadHTML('/roadmap-client.html', 'viax-roadmap-client.html')}>
                  <IconDownload /> Download
                </Btn>
                <Btn onClick={() => window.open('/roadmap-client.html', '_blank')}>
                  <IconExternal /> View
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* Toggle button */}
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            background: '#1E1E1E',
            color: open ? '#ffffff' : '#90E9B8',
            border: '1px solid ' + (open ? '#555' : '#383838'),
            borderRadius: 8,
            padding: '9px 18px',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: FONT,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
            transition: 'all 0.15s',
          }}
        >
          <IconDownload />
          {open ? 'Close' : 'Export / View'}
        </button>
      </div>
    </div>
  )
}
