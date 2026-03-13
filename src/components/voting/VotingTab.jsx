import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8,
}
const fieldStyle = {
  width: '100%', boxSizing: 'border-box', border: '1px solid #DDDDDD',
  borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none',
}
function btn(bg, color, border) {
  return { background: bg, color, border: `1px solid ${border || bg}`, borderRadius: 6, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }
}

// ── Email tag input ────────────────────────────────────────────────────

function EmailTags({ emails, onChange }) {
  const [input, setInput] = useState('')

  const add = () => {
    const val = input.trim().toLowerCase()
    if (val && !emails.includes(val)) onChange([...emails, val])
    setInput('')
  }

  return (
    <div>
      {emails.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {emails.map(e => (
            <span key={e} style={{ background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5', borderRadius: 4, padding: '3px 10px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {e}
              <button onClick={() => onChange(emails.filter(x => x !== e))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4FD0A5', padding: 0, fontSize: 16, lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), add())}
          placeholder="email@viax.io — press Enter to add"
          style={{ ...fieldStyle, flex: 1 }}
        />
        <button onClick={add} style={btn('#1E1E1E', '#FFFFFF')}>Add</button>
      </div>
    </div>
  )
}

// ── Create session form ────────────────────────────────────────────────

function CreateSessionForm({ epics, onCreated, onCancel }) {
  const [title, setTitle]           = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [emails, setEmails]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  const toggle = id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const handleCreate = async () => {
    if (!title.trim())          { setError('Enter a session title.'); return }
    if (!selectedIds.length)    { setError('Select at least one epic.'); return }
    if (!emails.length)         { setError('Add at least one participant email.'); return }

    setLoading(true); setError(null)

    try {
      const session = await api.sessions.create({
        title:             title.trim(),
        participantEmails: emails,
        epics:             epics.filter(e => selectedIds.includes(e.id)),
      })
      onCreated(session)
    } catch (e) {
      setError(e.message || 'Failed to create session.')
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '28px' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#1E1E1E', margin: '0 0 24px 0' }}>New Voting Session</h3>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Session Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Q2 2026 Prioritization" style={fieldStyle} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Epics to Vote On</label>
        <div style={{ border: '1px solid #DDDDDD', borderRadius: 6, maxHeight: 240, overflowY: 'auto' }}>
          {epics.length === 0 ? (
            <div style={{ padding: 20, fontSize: 13, color: '#AAAAAA', textAlign: 'center' }}>No epics yet — create some in the Epics tab first.</div>
          ) : epics.map((epic, i) => (
            <div
              key={epic.id}
              onClick={() => toggle(epic.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', borderBottom: i < epics.length - 1 ? '1px solid #F5F5F5' : 'none', background: selectedIds.includes(epic.id) ? '#F0FDF8' : '#FFFFFF' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, background: selectedIds.includes(epic.id) ? '#4FD0A5' : '#FFFFFF', border: selectedIds.includes(epic.id) ? 'none' : '2px solid #DDD', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedIds.includes(epic.id) && <span style={{ color: '#1E1E1E', fontSize: 11, fontWeight: 700 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14, color: '#1E1E1E' }}>{epic.title || <em style={{ color: '#AAAAAA' }}>Untitled Epic</em>}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: '#AAAAAA', marginTop: 6 }}>{selectedIds.length} selected</div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={labelStyle}>Participant Emails</label>
        <EmailTags emails={emails} onChange={setEmails} />
      </div>

      {error && <p style={{ color: '#CC3333', fontSize: 13, marginBottom: 16 }}>{error}</p>}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={btn('#F0F0F0', '#555555', '#DDDDDD')}>Cancel</button>
        <button onClick={handleCreate} disabled={loading} style={btn('#4FD0A5', '#1E1E1E')}>
          {loading ? 'Creating…' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}

// ── Session list row ───────────────────────────────────────────────────

function hasVotedAll(email, epicCount, allVotes, sessionId) {
  return allVotes.filter(v => v.session_id === sessionId && v.participant_email.toLowerCase() === email.toLowerCase()).length >= epicCount
}

function SessionRow({ session, allVotes, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const participants = session.participant_emails || []
  const epicCount    = session.session_epics?.length || 0
  const completed    = participants.filter(p => hasVotedAll(p, epicCount, allVotes, session.id)).length
  const allVoted     = participants.length > 0 && completed === participants.length
  const isClosed     = session.status === 'closed'

  const badgeStyle = isClosed
    ? { background: '#F0F0F0', color: '#666666', border: '1px solid #DDDDDD' }
    : allVoted
    ? { background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5' }
    : { background: '#FFF8E6', color: '#996600', border: '1px solid #FFD966' }

  const handleDelete = (e) => {
    e.stopPropagation()
    if (window.confirm(`Delete "${session.title}"? This will also delete all votes. This cannot be undone.`)) {
      onDelete(session.id)
    }
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '18px 22px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, boxShadow: hovered ? '0 2px 12px rgba(0,0,0,0.06)' : 'none', transition: 'box-shadow 0.15s' }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#1E1E1E', marginBottom: 4 }}>{session.title}</div>
        <div style={{ fontSize: 12, color: '#AAAAAA' }}>
          {epicCount} epic{epicCount !== 1 ? 's' : ''} · {participants.length} participant{participants.length !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ textAlign: 'center', minWidth: 52 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: allVoted ? '#4FD0A5' : '#1E1E1E' }}>{completed}/{participants.length}</div>
        <div style={{ fontSize: 11, color: '#AAAAAA' }}>voted</div>
      </div>
      <span style={{ ...badgeStyle, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
        {isClosed ? 'Closed' : allVoted ? 'Complete' : 'Open'}
      </span>
      {hovered && (
        <button
          onClick={handleDelete}
          style={{ background: '#FFF0F0', border: '1px solid #FFCCCC', color: '#CC3333', borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, flexShrink: 0 }}
        >Delete</button>
      )}
    </div>
  )
}

// ── VotingTab ──────────────────────────────────────────────────────────

export default function VotingTab({ epics }) {
  const [sessions,  setSessions]  = useState([])
  const [allVotes,  setAllVotes]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [creating,  setCreating]  = useState(false)
  const navigate = useNavigate()

  const load = async () => {
    try {
      const { sessions, votes } = await api.sessions.list()
      setSessions(sessions || [])
      setAllVotes(votes    || [])
    } catch (e) {
      console.error('Failed to load sessions', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleCreated = (session) => navigate(`/planning/session/${session.id}`)

  const handleDelete = async (id) => {
    await api.sessions.delete(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  if (loading) return <div style={{ padding: '60px 0', textAlign: 'center', color: '#AAAAAA', fontSize: 14 }}>Loading…</div>

  if (creating) return <CreateSessionForm epics={epics} onCreated={handleCreated} onCancel={() => setCreating(false)} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h2 style={{ fontSize: 28, fontWeight: 400, color: '#1E1E1E', margin: '0 0 4px 0', letterSpacing: '-0.5px' }}>Voting Sessions</h2>
          <p style={{ fontSize: 13, color: '#AAAAAA', margin: 0 }}>
            {sessions.length === 0 ? 'No sessions yet' : `${sessions.length} session${sessions.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setCreating(true)} style={btn('#4FD0A5', '#1E1E1E')}>+ New Session</button>
      </div>

      {sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 14, color: '#DDDDDD' }}>⊙</div>
          <p style={{ fontSize: 14, color: '#AAAAAA', margin: '0 0 24px 0' }}>No voting sessions yet.</p>
          <button onClick={() => setCreating(true)} style={{ ...btn('#1E1E1E', '#FFFFFF'), padding: '10px 24px', fontSize: 14 }}>Create your first session</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sessions.map(s => (
            <SessionRow key={s.id} session={s} allVotes={allVotes} onClick={() => navigate(`/planning/session/${s.id}`)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
