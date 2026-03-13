import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const FIB  = [1, 2, 3, 5, 8, 13, 20]

// ── Helpers ────────────────────────────────────────────────────────────

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
}

function hasVotedAll(email, sessionEpics, votes) {
  const norm    = email.toLowerCase()
  const epicIds = new Set(sessionEpics.map(e => e.id))
  const voted   = new Set(votes.filter(v => v.participant_email.toLowerCase() === norm).map(v => v.session_epic_id))
  return epicIds.size > 0 && [...epicIds].every(id => voted.has(id))
}

function calcResults(sessionEpics, votes) {
  return sessionEpics
    .map(epic => {
      const ev = votes.filter(v => v.session_epic_id === epic.id)
      if (!ev.length) return { ...epic, avgWsjf: 0, voterCount: 0, avgBV: 0, avgTC: 0, avgRR: 0, avgJS: 0 }
      const wsjfScores = ev.map(v => (v.business_value + v.time_criticality + v.risk_reduction) / v.job_size)
      return {
        ...epic,
        avgWsjf:  +(wsjfScores.reduce((a, b) => a + b, 0) / wsjfScores.length).toFixed(2),
        avgBV:    +avg(ev.map(v => v.business_value)).toFixed(1),
        avgTC:    +avg(ev.map(v => v.time_criticality)).toFixed(1),
        avgRR:    +avg(ev.map(v => v.risk_reduction)).toFixed(1),
        avgJS:    +avg(ev.map(v => v.job_size)).toFixed(1),
        voterCount: ev.length,
      }
    })
    .sort((a, b) => b.avgWsjf - a.avgWsjf)
}

// ── FibSelector ────────────────────────────────────────────────────────

function FibSelector({ label, value, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      <span style={{ minWidth: 210, fontSize: 13, color: '#555555', fontFamily: FONT }}>{label}</span>
      {FIB.map(n => (
        <button
          key={n}
          disabled={disabled}
          onClick={() => onChange(n)}
          style={{
            width: 38, height: 38, borderRadius: 6,
            border: value === n ? 'none' : '1px solid #DDDDDD',
            background: value === n ? '#4FD0A5' : '#FAFAFA',
            color: value === n ? '#1E1E1E' : '#666666',
            fontWeight: value === n ? 700 : 400,
            cursor: disabled ? 'default' : 'pointer',
            fontSize: 13, fontFamily: FONT, opacity: disabled ? 0.5 : 1,
          }}
        >{n}</button>
      ))}
    </div>
  )
}

// ── SessionPage ────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()

  const [session,      setSession]      = useState(null)
  const [sessionEpics, setSessionEpics] = useState([])
  const [votes,        setVotes]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  // Voter state
  const [email,         setEmail]         = useState(() => localStorage.getItem('viax-voter-email') || '')
  const [emailLocked,   setEmailLocked]   = useState(false)
  const [selections,    setSelections]    = useState({})
  const [submitting,    setSubmitting]    = useState(false)
  const [submitDone,    setSubmitDone]    = useState(false)

  const loadData = useCallback(async () => {
    try {
      const { session, epics, votes } = await api.sessions.get(sessionId)
      setSession(session)
      setSessionEpics(epics || [])
      setVotes(votes || [])
    } catch (e) {
      setError('Session not found.')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    const t = setInterval(loadData, 15000)
    return () => clearInterval(t)
  }, [loadData])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <span style={{ color: '#AAAAAA' }}>Loading…</span>
    </div>
  )
  if (error || !session) return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT }}>
      <span style={{ color: '#CC3333' }}>{error || 'Session not found.'}</span>
    </div>
  )

  const participants   = session.participant_emails || []
  const normEmail      = email.trim().toLowerCase()
  const isParticipant  = participants.some(p => p.toLowerCase() === normEmail)
  const iVotedAll      = emailLocked && isParticipant && hasVotedAll(normEmail, sessionEpics, votes)
  const completedList  = participants.filter(p => hasVotedAll(p, sessionEpics, votes))
  const allVoted       = participants.length > 0 && completedList.length === participants.length
  const isClosed       = session.status === 'closed'
  const showResults    = allVoted || isClosed

  const setFib = (epicId, field, val) =>
    setSelections(p => ({ ...p, [epicId]: { ...(p[epicId] || {}), [field]: val } }))

  const allSelected = sessionEpics.every(e => {
    const s = selections[e.id]
    return s && s.bv && s.tc && s.rr && s.js
  })

  const wsjfPreview = (epicId) => {
    const s = selections[epicId]
    return s?.bv && s?.tc && s?.rr && s?.js
      ? +((s.bv + s.tc + s.rr) / s.js).toFixed(2)
      : null
  }

  const handleSubmit = async () => {
    if (!allSelected || submitting) return
    setSubmitting(true)
    try {
      await api.votes.submit({
        sessionId,
        email: normEmail,
        votes: sessionEpics.map(e => ({
          sessionEpicId: e.id,
          bv: selections[e.id].bv,
          tc: selections[e.id].tc,
          rr: selections[e.id].rr,
          js: selections[e.id].js,
        })),
      })
      localStorage.setItem('viax-voter-email', email.trim())
      setSubmitDone(true)
      await loadData()
    } catch (err) {
      alert('Error submitting votes: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = async () => {
    await api.sessions.close(sessionId)
    await loadData()
  }

  const results = showResults ? calcResults(sessionEpics, votes) : null

  const statusBadge = isClosed
    ? { background: '#F0F0F0', color: '#666666', border: '1px solid #DDDDDD', label: 'Closed' }
    : allVoted
    ? { background: '#E8F9F3', color: '#1a7a5e', border: '1px solid #4FD0A5', label: 'Complete' }
    : { background: '#FFF8E6', color: '#996600', border: '1px solid #FFD966', label: 'Open' }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F7F6', paddingTop: 56, fontFamily: FONT }}>
      <div style={{ maxWidth: 880, margin: '0 auto', padding: '40px 32px' }}>

        {/* Back */}
        <button
          onClick={() => navigate('/planning')}
          style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, marginBottom: 24, fontFamily: FONT }}
        >← Back to planning</button>

        {/* Session header */}
        <div style={{ background: '#1E1E1E', borderRadius: 10, padding: '24px 28px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4FD0A5', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>Voting Session</div>
              <h1 style={{ color: '#FFFFFF', fontSize: 22, fontWeight: 600, margin: '0 0 10px 0' }}>{session.title}</h1>
              <div style={{ fontSize: 13, color: '#888888' }}>
                {sessionEpics.length} epic{sessionEpics.length !== 1 ? 's' : ''} · {participants.length} participant{participants.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
              {!isClosed && (
                <button
                  onClick={handleClose}
                  style={{ background: 'none', border: '1px solid #444444', color: '#888888', borderRadius: 6, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}
                >Close Session</button>
              )}
              <span style={{ ...statusBadge, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', padding: '4px 10px', borderRadius: 4, textTransform: 'uppercase' }}>
                {statusBadge.label}
              </span>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#1E1E1E', margin: 0 }}>Participants</h3>
            <span style={{ fontSize: 13, color: '#AAAAAA' }}>{completedList.length} / {participants.length} voted</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {participants.map(p => {
              const done = hasVotedAll(p, sessionEpics, votes)
              return (
                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 15, color: done ? '#4FD0A5' : '#CCCCCC', fontWeight: 700, width: 18 }}>{done ? '✓' : '○'}</span>
                  <span style={{ fontSize: 13, color: done ? '#1E1E1E' : '#888888', flex: 1 }}>{p}</span>
                  <span style={{ fontSize: 11, color: done ? '#4FD0A5' : '#CCCCCC', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {done ? 'Voted' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Results */}
        {results && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '24px', marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E1E1E', margin: '0 0 20px 0' }}>Results — Ranked by WSJF</h3>
            <div>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.2fr', gap: 8, paddingBottom: 10, borderBottom: '2px solid #E2E0DC', marginBottom: 4 }}>
                {['Epic', 'Avg BV', 'Avg TC', 'Avg RR/OE', 'Avg JS', 'WSJF ↓'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#AAAAAA', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                ))}
              </div>
              {results.map((epic, i) => (
                <div
                  key={epic.id}
                  style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1.2fr', gap: 8, padding: '13px 0', borderBottom: i < results.length - 1 ? '1px solid #F5F5F5' : 'none', alignItems: 'center' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#4FD0A5' : '#CCCCCC', minWidth: 22 }}>#{i + 1}</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#1E1E1E' }}>{epic.epic_title}</span>
                  </div>
                  <span style={{ fontSize: 14, color: '#555555' }}>{epic.avgBV}</span>
                  <span style={{ fontSize: 14, color: '#555555' }}>{epic.avgTC}</span>
                  <span style={{ fontSize: 14, color: '#555555' }}>{epic.avgRR}</span>
                  <span style={{ fontSize: 14, color: '#555555' }}>{epic.avgJS}</span>
                  <span style={{ fontSize: 17, fontWeight: 700, color: i === 0 ? '#4FD0A5' : '#1E1E1E' }}>{epic.avgWsjf}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Voting form */}
        {!isClosed && !showResults && (
          <div style={{ background: '#FFFFFF', border: '1px solid #E2E0DC', borderRadius: 8, padding: '24px' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1E1E1E', margin: '0 0 20px 0' }}>Cast Your Vote</h3>

            {/* Email step */}
            {!emailLocked ? (
              <div style={{ maxWidth: 400 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Your Email</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@viax.io"
                    onKeyDown={e => e.key === 'Enter' && setEmailLocked(true)}
                    style={{ flex: 1, border: '1px solid #DDDDDD', borderRadius: 6, padding: '9px 12px', fontSize: 14, fontFamily: FONT, outline: 'none' }}
                  />
                  <button
                    onClick={() => setEmailLocked(true)}
                    style={{ background: '#1E1E1E', color: '#FFFFFF', border: 'none', borderRadius: 6, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT }}
                  >Continue</button>
                </div>
              </div>

            ) : !isParticipant ? (
              <div>
                <p style={{ color: '#CC3333', fontSize: 14, margin: '0 0 12px 0' }}>
                  <strong>{email}</strong> is not in the participant list for this session.
                </p>
                <button onClick={() => setEmailLocked(false)} style={{ background: 'none', border: 'none', color: '#4FD0A5', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0, fontFamily: FONT }}>
                  Try a different email
                </button>
              </div>

            ) : submitDone || iVotedAll ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 32, color: '#4FD0A5', marginBottom: 10 }}>✓</div>
                <p style={{ fontSize: 14, color: '#1a7a5e', fontWeight: 600, margin: '0 0 8px 0' }}>Your votes have been submitted.</p>
                <p style={{ fontSize: 13, color: '#AAAAAA', margin: 0 }}>Waiting for all participants to vote…</p>
              </div>

            ) : (
              <div>
                <p style={{ fontSize: 13, color: '#888888', margin: '0 0 24px 0' }}>
                  Voting as <strong style={{ color: '#1E1E1E' }}>{email}</strong>
                  <button onClick={() => setEmailLocked(false)} style={{ background: 'none', border: 'none', color: '#AAAAAA', cursor: 'pointer', fontSize: 12, marginLeft: 8, fontFamily: FONT }}>change</button>
                </p>
                <p style={{ fontSize: 12, color: '#AAAAAA', margin: '0 0 24px 0', background: '#F8F7F6', padding: '10px 14px', borderRadius: 6 }}>
                  Use the Fibonacci scale: <strong>WSJF = (Business Value + Time Criticality + Risk Reduction) ÷ Job Size</strong>
                </p>

                {sessionEpics.map((epic, i) => {
                  const sel   = selections[epic.id] || {}
                  const wsjf  = wsjfPreview(epic.id)
                  return (
                    <div key={epic.id} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < sessionEpics.length - 1 ? '1px solid #F0F0F0' : 'none' }}>
                      {/* Epic label */}
                      <div style={{ background: '#1E1E1E', borderRadius: '6px 6px 0 0', padding: '10px 18px' }}>
                        <span style={{ color: '#4FD0A5', fontSize: 11, fontWeight: 700, marginRight: 10 }}>0{i + 1}</span>
                        <span style={{ color: '#FFFFFF', fontSize: 13, fontWeight: 600 }}>{epic.epic_title}</span>
                      </div>
                      {epic.epic_summary ? (
                        <div style={{ border: '1px solid #E2E0DC', borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '10px 18px', marginBottom: 16, fontSize: 13, color: '#888888', lineHeight: 1.65 }}>
                          {epic.epic_summary}
                        </div>
                      ) : <div style={{ marginBottom: 16 }} />}

                      {/* WSJF inputs */}
                      <FibSelector label="Business Value"                value={sel.bv} onChange={v => setFib(epic.id, 'bv', v)} />
                      <FibSelector label="Time Criticality"             value={sel.tc} onChange={v => setFib(epic.id, 'tc', v)} />
                      <FibSelector label="Risk Reduction / Opportunity" value={sel.rr} onChange={v => setFib(epic.id, 'rr', v)} />
                      <FibSelector label="Job Size (effort)"            value={sel.js} onChange={v => setFib(epic.id, 'js', v)} />

                      {wsjf !== null && (
                        <div style={{ marginTop: 10, fontSize: 13, color: '#888888' }}>
                          Your WSJF: <strong style={{ color: '#4FD0A5', fontSize: 16 }}>{wsjf}</strong>
                        </div>
                      )}
                    </div>
                  )
                })}

                <button
                  onClick={handleSubmit}
                  disabled={!allSelected || submitting}
                  style={{
                    background: allSelected ? '#4FD0A5' : '#EEEEEE',
                    color: allSelected ? '#1E1E1E' : '#AAAAAA',
                    border: 'none', borderRadius: 6, padding: '12px 32px',
                    fontSize: 14, fontWeight: 600,
                    cursor: allSelected ? 'pointer' : 'default',
                    fontFamily: FONT, marginTop: 8,
                  }}
                >
                  {submitting ? 'Submitting…' : 'Submit All Votes'}
                </button>
                {!allSelected && (
                  <p style={{ fontSize: 12, color: '#AAAAAA', marginTop: 8 }}>Select a value for every field on each epic to submit.</p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
