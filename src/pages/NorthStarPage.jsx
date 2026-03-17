const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

const UNLOCKS = [
  'Agents that support the build out of end to end revenue motions',
  'Agents that participate in tasks in a revenue motion',
  'Agents that help build end user UIs based on revenue motion configuration',
  'Agents that support the viax development process for higher throughput and stability',
  'Agents that help execute support process',
  'Agents that support the fast buildout of tailored engaging demos',
]

export default function NorthStarPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8F7F6',
        paddingTop: 56,
        fontFamily: FONT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '120px 32px 80px',
      }}
    >
      <div style={{ maxWidth: 720, width: '100%' }}>
        {/* Card */}
        <div
          style={{
            background: '#1E1E1E',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: '0 4px 32px rgba(0,0,0,0.12)',
          }}
        >
          {/* Card header */}
          <div style={{ padding: '32px 36px 24px', borderBottom: '1px solid #2A2A2A' }}>
            <span
              style={{
                display: 'inline-block',
                background: '#90E9B8',
                color: '#1E1E1E',
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '4px 10px',
                borderRadius: 4,
                marginBottom: 14,
              }}
            >
              North Star
            </span>
            <h1
              style={{
                color: '#FFFFFF',
                fontSize: 28,
                fontWeight: 600,
                margin: 0,
                letterSpacing: '-0.3px',
                lineHeight: 1.2,
              }}
            >
              viax AI Server
            </h1>
          </div>

          {/* Card body */}
          <div style={{ padding: '28px 36px 36px' }}>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.75,
                color: 'rgba(255,255,255,0.65)',
                margin: '0 0 28px 0',
              }}
            >
              Enhance the viax platform to support the deployment and execution of AI agents
              powered by <strong style={{ color: '#FFFFFF' }}>a simplified stable code base</strong>,{' '}
              <strong style={{ color: '#FFFFFF' }}>skills</strong>,{' '}
              <strong style={{ color: '#FFFFFF' }}>tools (MCP Server)</strong>, and{' '}
              <strong style={{ color: '#FFFFFF' }}>context data brain (Nexus)</strong> that support:
            </p>

            {/* Unlocks section */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#90E9B8',
                  marginBottom: 16,
                }}
              >
                Unlocks
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {UNLOCKS.map((item, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#90E9B8',
                        flexShrink: 0,
                        marginTop: 7,
                      }}
                    />
                    <span style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,0.8)' }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
