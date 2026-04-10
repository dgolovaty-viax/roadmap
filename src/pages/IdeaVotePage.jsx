import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const MAX_VOTES = 5

const TAG_PALETTE = [
  { bg: '#E8F9F3', color: '#1a7a5e', border: '#4FD0A5' },  // teal
  { bg: '#E8F0FE', color: '#1a56db', border: '#93C5FD' },  // blue
  { bg: '#FFF8E6', color: '#996600', border: '#FFD966' },  // amber
  { bg: '#F3F0FF', color: '#5B21B6', border: '#C4B5FD' },  // purple
  { bg: '#ECFDF5', color: '#065F46', border: '#6EE7B7' },  // emerald
  { bg: '#E0F2FE', color: '#0369A1', border: '#7DD3FC' },  // sky blue
  { bg: '#FEF9C3', color: '#854D0E', border: '#FDE047' },  // yellow
  { bg: '#F0FDF4', color: '#166534', border: '#86EFAC' },  // light green
  { bg: '#F5F3FF', color: '#4C1D95', border: '#A78BFA' },  // deep purple
  { bg: '#ECFEFF', color: '#164E63', border: '#67E8F9' },  // cyan
  { bg: '#FFF7ED', color: '#9A3412', border: '#FDBA74' },  // orange
  { bg: '#F0F9FF', color: '#1e3a5f', border: '#BAE6FD' },  // navy
]

// Build a stable id→color map from all unique tags across all ideas (sorted by name)
function buildTagColorMap(ideas) {
  const seen = new Map()
  for (const idea of ideas) {
    const tags = (idea.idea_tag_assignments || []).map(a => a.idea_tags).filter(Boolean)
    for (const t of tags) { if (!seen.has(t.id)) seen.set(t.id, t.name) }
  }
  const sorted = [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  const map = {}
  sorted.forEach(([id], i) => { map[id] = TAG_PALETTE[i % TAG_PALETTE.length] })
  return map
}

function TagBadge({ id, name, colorMap }) {
  if (!name) return null
  const { bg, color, border } = (id && colorMap?.[id]) ? colorMap[id] : TAG_PALETTE[0]
  return (
    <span style={{
      background: bg, color, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
      padding: '3px 9px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

// ── Email step ─────────────────────────────────────────────────────────

function EmailStep({ email, setEmail, onJoin }) {
  return (
    <div style={{ maxWidth: 440, margin: '0 auto', padding: '0 24px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '40px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E2E0DC' }}>
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💡</div>
          <h1 style={{ fontSize: 22, fontWeight: 600, color: '#1E1E1E', margin: '0 0 8px 0' }}>Vote on Ideas</h1>
          <p style={{ fontSize: 14, color: '#888888', margin: 0, lineHeight: 1.6 }}>
            Pick up to {MAX_VOTES} ideas you think should be prioritized next.
          </p>
        </div>

        <form onSubmit={onJoin}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Your email
          </label>
          <input
            autoFocus
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@viax.io"
            required
            style={{
              width: '100%', boxSizing: 'border-box',
              border: '1px solid #DDDDDD', borderRadius: 6,
              padding: '10px 13px', fontSize: 14, fontFamily: FONT,
              outline: 'none', marginBottom: 16, color: '#1E1E1E',
            }}
          />
          <button
            type="submit"
            disabled={!email.trim()}
            style={{
              width: '100%', background: '#4FD0A5', color: '#1E1E1E',
              border: 'none', borderRadius: 6, padding: '11px 0',
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              opacity: !email.trim() ? 0.5 : 1,
            }}
          >
            Start voting →
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Voting step ────────────────────────────────────────────────────────

function VotingStep({ ideas, selected, onToggle, onSubmit, submitting, colorMap }) {
  const remaining = MAX_VOTES - selected.size

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 60px' }}>
      {/* Sticky counter bar */}
      <div style={{
        position: 'sticky', top: 56, zIndex: 40,
        background: '#1E1E1E', borderRadius: 8,
        padding: '12px 20px', marginBottom: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>
            {selected.size} of {MAX_VOTES} selected
          </span>
          {remaining > 0 && (
            <span style={{ color: '#AAAAAA', fontSize: 13, marginLeft: 10 }}>
              {remaining} more to go
            </span>
          )}
          {remaining === 0 && (
            <span style={{ color: '#4FD0A5', fontSize: 13, marginLeft: 10 }}>
              ✓ Ready to submit
            </span>
          )}
        </div>
        <button
          onClick={onSubmit}
          disabled={selected.size === 0 || submitting}
          style={{
            background: selected.size > 0 ? '#4FD0A5' : '#383838',
            color: selected.size > 0 ? '#1E1E1E' : '#888888',
            border: 'none', borderRadius: 6, padding: '8px 20px',
            fontSize: 13, fontWeight: 600, cursor: selected.size > 0 ? 'pointer' : 'not-allowed',
            fontFamily: FONT, transition: 'all 0.15s',
          }}
        >
          {submitting ? 'Submitting…' : `Submit ${selected.size > 0 ? `(${selected.size})` : ''}`}
        </button>
      </div>

      {/* Instruction */}
      <p style={{ fontSize: 14, color: '#888888', margin: '0 0 20px 0' }}>
        Click the 👍 on up to {MAX_VOTES} ideas you'd like to see prioritized.
      </p>

      {/* Idea grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {ideas.map(idea => {
          const isSelected = selected.has(idea.id)
          const isDisabled = !isSelected && selected.size >= MAX_VOTES
          const ideaTags = (idea.idea_tag_assignments || []).map(a => a.idea_tags).filter(Boolean)

          return (
            <div
              key={idea.id}
              style={{
                background: isSelected ? '#F0FFF8' : '#FFFFFF',
                border: `2px solid ${isSelected ? '#4FD0A5' : '#E2E0DC'}`,
                borderRadius: 8, padding: '18px 20px',
                opacity: isDisabled ? 0.5 : 1,
                transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}
            >
              {/* Title + tag */}
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1E1E1E', margin: 0, lineHeight: 1.4 }}>
                    {idea.title}
                  </h3>
                  {ideaTags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {ideaTags.map(t => <TagBadge key={t.id} id={t.id} name={t.name} colorMap={colorMap} />)}
                    </div>
                  )}
                </div>
                {idea.description && (
                  <p style={{ fontSize: 12, color: '#888888', margin: 0, lineHeight: 1.6 }}>
                    {idea.description.slice(0, 100)}{idea.description.length > 100 ? '…' : ''}
                  </p>
                )}
              </div>

              {/* Thumbs up button */}
              <button
                onClick={() => !isDisabled && onToggle(idea.id)}
                disabled={isDisabled && !isSelected}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  background: isSelected ? '#4FD0A5' : '#F3F3F3',
                  color: isSelected ? '#1E1E1E' : '#555555',
                  border: `1px solid ${isSelected ? '#4FD0A5' : '#E2E0DC'}`,
                  borderRadius: 6, padding: '7px 0', cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600, fontFamily: FONT, width: '100%',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>👍</span>
                {isSelected ? 'Voted' : 'Vote for this'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Done step ──────────────────────────────────────────────────────────

function DoneStep({ selected, ideas }) {
  const voted = ideas.filter(i => selected.has(i.id))
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '48px 40px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E2E0DC' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1E1E1E', margin: '0 0 8px 0' }}>Thanks for voting!</h2>
        <p style={{ fontSize: 14, color: '#888888', margin: '0 0 28px 0', lineHeight: 1.6 }}>
          Your votes have been recorded.
        </p>
        {voted.length > 0 && (
          <div style={{ textAlign: 'left' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              You voted for
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {voted.map(idea => (
                <div key={idea.id} style={{ background: '#F8F7F6', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#1E1E1E', fontWeight: 500 }}>
                  👍 {idea.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function IdeaVotePage() {
  const { sessionId } = useParams()
  const [session, setSession]   = useState(null)
  const [ideas, setIdeas]       = useState([])
  const [email, setEmail]       = useState('')
  const [step, setStep]         = useState('email') // email | voting | done
  const [selected, setSelected] = useState(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    Promise.all([
      api.ideaVoteSessions.get(sessionId),
      api.ideas.list(),
    ]).then(([{ session: s }, ideaList]) => {
      setSession(s)
      setIdeas(ideaList || [])
      if (s?.status !== 'open') {
        setError('This voting session has been closed.')
      }
    }).catch(() => {
      setError('Could not load this voting session.')
    }).finally(() => setLoading(false))
  }, [sessionId])

  const handleJoin = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setStep('voting')
  }

  const toggleIdea = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else if (next.size < MAX_VOTES) { next.add(id) }
      return next
    })
  }

  const handleSubmit = async () => {
    if (submitting || selected.size === 0) return
    setSubmitting(true)
    try {
      await api.ideaVoteSessions.vote(sessionId, email, [...selected])
      setStep('done')
    } catch (e) {
      setError(e.message || 'Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <span style={{ color: '#AAAAAA', fontSize: 14 }}>Loading…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8F7F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
          <p style={{ fontSize: 15, color: '#888888' }}>{error}</p>
        </div>
      </div>
    )
  }

  const colorMap = buildTagColorMap(ideas)

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 72, fontFamily: FONT }}>
      {step === 'email'  && <EmailStep  email={email} setEmail={setEmail} onJoin={handleJoin} />}
      {step === 'voting' && <VotingStep ideas={ideas} selected={selected} onToggle={toggleIdea} onSubmit={handleSubmit} submitting={submitting} colorMap={colorMap} />}
      {step === 'done'   && <DoneStep   selected={selected} ideas={ideas} />}
    </div>
  )
}
