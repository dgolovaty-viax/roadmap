// Partner Push → Strategy. Renders the partner strategy doc (a self-contained
// HTML page in public/partner-strategy.html) below the fixed nav, with a
// small control to open it on its own for printing.

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

export default function PartnerStrategyPage() {
  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: 56, height: '100vh', boxSizing: 'border-box' }}>
      <iframe
        src="/partner-strategy.html"
        title="viax Partner Strategy"
        style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
      />
      <button
        onClick={() => window.open('/partner-strategy.html', '_blank')}
        style={{
          position: 'absolute', bottom: 24, right: 24, zIndex: 10,
          background: '#1E1E1E', color: '#90E9B8', border: '1px solid #383838', borderRadius: 8,
          padding: '9px 18px', fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
        }}
      >
        Open to print
      </button>
    </div>
  )
}
