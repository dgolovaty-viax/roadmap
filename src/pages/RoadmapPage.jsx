export default function RoadmapPage() {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <iframe
        src="/roadmap.html"
        className="w-full h-screen border-0"
        title="viax Roadmap"
      />
      <a
        href="/roadmap-client.html"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          bottom: 24,
          right: 24,
          background: '#1E1E1E',
          color: '#90E9B8',
          border: '1px solid #383838',
          borderRadius: 8,
          padding: '9px 18px',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Funnel Sans', 'Inter', system-ui, sans-serif",
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          transition: 'background 0.15s',
          zIndex: 10,
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#2a2a2a'}
        onMouseLeave={e => e.currentTarget.style.background = '#1E1E1E'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5.25 2.625H2.625A1.125 1.125 0 001.5 3.75v7.625A1.125 1.125 0 002.625 12.5H10.25a1.125 1.125 0 001.125-1.125V8.75" stroke="#90E9B8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.5 1.5h4m0 0v4m0-4L7 7" stroke="#90E9B8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Client View
      </a>
    </div>
  )
}
