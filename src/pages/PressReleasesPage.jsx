import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { api } from '@/lib/api'

// ── Press Releases ─────────────────────────────────────────────────────
//
// A swimlane board. Steps run across the top; each release owns one lane and
// its card sits in exactly one step. Drag the card to advance it. Open the
// card for content, links, attachments and comments.
//
// Steps are defined here rather than in the database: they are a process, not
// user-managed columns. Adding a step is one entry in PR_STEPS — existing
// cards keep their step_key and nothing needs migrating.

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const C = {
  cream: '#F8F7F6', white: '#FEFEFE', dark: '#1E1E1E', darkAlt: '#2A2A2A',
  border: '#E2E0DC', bgMed: '#E8E6E3',
  grayMid: '#525252', grayLight: '#8A8A8A',
  mint: '#5ED49A', mintText: '#177558', mintSoft: 'rgba(94,212,154,0.15)',
  amber: '#8A5A16', amberSoft: '#FBEBD7',
  red: '#8A1F1F', redSoft: '#FDECEC', redBorder: '#F5B5B5',
}

const PR_STEPS = [
  { key: 'candidate', label: 'Candidate',       hint: 'Identified, not started' },
  { key: 'proposed',  label: 'Proposed',        hint: 'Approach put to the client' },
  { key: 'agreed',    label: 'Client agreed',   hint: 'Green light to proceed' },
  { key: 'outline',   label: 'Story outline',   hint: 'Narrative agreed internally' },
  { key: 'quotes',    label: 'Quotes captured', hint: 'Recorded call done' },
  { key: 'draft',     label: 'Draft written',   hint: 'Full copy drafted' },
  { key: 'approved',  label: 'Client approved', hint: 'Comms and legal sign-off' },
  { key: 'published', label: 'Published',       hint: 'Live on the wire' },
  { key: 'amplified', label: 'Amplified',       hint: 'Customer posted, viax reposted' },
]
const STEP_INDEX = Object.fromEntries(PR_STEPS.map((s, i) => [s.key, i]))

// Seeded on first load from the Product Marketing Blitz call, 22 Sep 2026.
const SEED = [
  {
    client: 'AutoTrust', stepKey: 'proposed', position: 0, expectedDate: '2026-10-16',
    topic: 'Joint release on AutoTrust running revenue motions on viax. First move is proposing the approach and gauging interest.',
    viaxOwners: 'Rick Chavie', clientOwners: 'David Mondragon',
    seedItems: [
      { kind: 'content', body: 'Joint press release with AutoTrust. Rick leads; the opening move is an email to David Mondragon proposing the approach and gauging whether he wants to move forward.\n\nAmplification: David posts first, viax reposts and piles on.' },
      { kind: 'comment', author: 'From the call', body: 'Next step — Rick emails David Mondragon with the press release proposal.' },
    ],
  },
  {
    client: 'Cintas', stepKey: 'proposed', position: 1, expectedDate: '2026-10-23',
    topic: 'Signed-deal release. Contractually committed, so this one has to happen — Todd and Josh supply the quotes.',
    viaxOwners: 'Andrew Martin', clientOwners: 'Todd Van Houten · Josh Patrick',
    seedItems: [
      { kind: 'content', body: 'The deal is signed, which unblocks the release. Andrew reaches out to Todd and Josh to kick it off and pull two or three quote sentences.\n\nAmplification: less certain Cintas will post themselves — Andrew to ask Todd.' },
      { kind: 'comment', author: 'From the call', body: 'Next step — Andrew reaches out to Todd and Josh now the deal is signed.' },
    ],
  },
  {
    client: 'Solventum', stepKey: 'outline', position: 2, expectedDate: '2026-10-30',
    topic: 'Clinic Portal powered by viax — unification story, roadmap, and cross-sell into med surgery. Previously blocked; the payment portal is now live enough to justify it.',
    viaxOwners: 'Andrew Martin · Dennis Golovaty', clientOwners: 'Keegan · Kevin (Jeff on med surgery)',
    seedItems: [
      { kind: 'content', body: 'Keegan and Kevin are the primary voices, with the dental/clinic portal as the core narrative: Clinic Portal powered by viax, the unification story, the roadmap, and cross-sell into med surgery. Configure-price-quote and guided selling are the supporting proof points on the med surgery side, where Jeff may contribute a blurb.\n\nProcess: draft the story outline first, then get on a recorded call with Keegan and Kevin to pull quotes that fit the narrative.\n\nAmplification: Keegan posts, viax shares his post.' },
      { kind: 'comment', author: 'From the call', body: 'Outline first, then book the recorded call with Keegan and Kevin — quotes should serve the narrative rather than the other way round.' },
    ],
  },
  {
    client: 'Wiley', stepKey: 'candidate', position: 3, expectedDate: '',
    topic: 'Fourth candidate, once the first three are underway. Possible split: the ecom story separately from author services.',
    viaxOwners: 'Unassigned', clientOwners: 'Arnab · Tri · Rajiv',
    seedItems: [
      { kind: 'content', body: 'Flagged as the fourth candidate once AutoTrust, Cintas and Solventum are moving.\n\nPotential to split it: the ecom story with Arnab and Tri, the author services side separately, with Rajiv providing an overall framing.' },
      { kind: 'comment', author: 'From the call', body: 'Hold until the first three are underway. No viax owner assigned yet.' },
    ],
  },
]

// ── Shared styles ──────────────────────────────────────────────────────

const btn = (bg, color, border) => ({
  fontFamily: MONO, fontSize: 12, fontWeight: 500, background: bg, color,
  border: `1px solid ${border || bg}`, borderRadius: 6, padding: '7px 13px',
  cursor: 'pointer', whiteSpace: 'nowrap',
})
const inputBase = {
  width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 14.5, fontWeight: 300,
  color: C.dark, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 7,
  padding: '9px 12px', outline: 'none',
}
const fieldLabel = {
  display: 'block', fontFamily: MONO, fontSize: 11, fontWeight: 500,
  letterSpacing: '0.09em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 6,
}
const LANE_W = 268
const STEP_W = 178

function fmtDate(d) {
  if (!d) return null
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''))
  if (isNaN(dt)) return null
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysUntil(d) {
  if (!d) return null
  const dt = new Date(d + (d.length === 10 ? 'T12:00:00' : ''))
  if (isNaN(dt)) return null
  return Math.round((dt - new Date()) / 86400000)
}
function bytes(n) {
  if (!n) return ''
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`
}

// ── Card detail modal ──────────────────────────────────────────────────

function CardModal({ release, items, onClose, onPatch, onAddItem, onDeleteItem, onDelete }) {
  const content = items.find(i => i.kind === 'content')
  const links = items.filter(i => i.kind === 'link')
  const files = items.filter(i => i.kind === 'attachment')
  const comments = items.filter(i => i.kind === 'comment')

  const [body, setBody] = useState(content?.body || '')
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [comment, setComment] = useState('')
  const [author, setAuthor] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => { setBody(content?.body || '') }, [content?.id])          // eslint-disable-line
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const saveBody = (v) => {
    setBody(v)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      onAddItem({ id: content?.id, kind: 'content', body: v })
    }, 700)
  }

  const addLink = () => {
    const u = linkUrl.trim()
    if (!u) return
    onAddItem({ kind: 'link', title: linkTitle.trim() || u, url: u })
    setLinkTitle(''); setLinkUrl('')
  }

  const addComment = () => {
    const b = comment.trim()
    if (!b) return
    onAddItem({ kind: 'comment', body: b, author: author.trim() || 'viax' })
    setComment('')
  }

  const pickFile = async (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    if (f.size > 3 * 1024 * 1024) {
      window.alert(`${f.name} is ${bytes(f.size)} — the limit is 3MB. Add it as a link instead.`)
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result).split(',')[1] || '')
        r.onerror = rej
        r.readAsDataURL(f)
      })
      await onAddItem({ kind: 'attachment', fileName: f.name, mimeType: f.type || 'application/octet-stream', sizeBytes: f.size, data: b64 })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const download = (it) => {
    const bin = atob(it.data || '')
    const buf = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([buf], { type: it.mime_type || 'application/octet-stream' }))
    const a = document.createElement('a')
    a.href = url; a.download = it.file_name || 'attachment'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }

  const sec = { marginTop: 22 }
  const secLabel = { ...fieldLabel, color: C.mintText, marginBottom: 10 }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(30,30,30,0.45)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '56px 20px 20px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.white, borderRadius: 12, width: 720, maxWidth: '100%',
        fontFamily: FONT, boxShadow: '0 24px 60px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}>
        {/* header */}
        <div style={{ padding: '22px 26px 18px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <input value={release.client} onChange={e => onPatch({ client: e.target.value })}
                style={{ ...inputBase, background: 'transparent', border: '1px solid transparent', padding: '2px 4px',
                         fontSize: 27, fontWeight: 500, letterSpacing: '-0.6px' }} />
              <textarea value={release.topic} onChange={e => onPatch({ topic: e.target.value })} rows={2}
                placeholder="What this release is about"
                style={{ ...inputBase, background: 'transparent', border: '1px solid transparent', padding: '2px 4px',
                         fontSize: 15.5, color: C.grayMid, marginTop: 4, resize: 'vertical', lineHeight: 1.45 }} />
            </div>
            <button onClick={onClose} style={btn('transparent', C.grayLight, C.border)}>Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 170px', gap: 12, marginTop: 16 }}>
            <div>
              <label style={fieldLabel}>viax owner</label>
              <input value={release.viax_owners} placeholder="Who owns it here"
                onChange={e => onPatch({ viaxOwners: e.target.value })} style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Client owner</label>
              <input value={release.client_owners} placeholder="Who signs off there"
                onChange={e => onPatch({ clientOwners: e.target.value })} style={inputBase} />
            </div>
            <div>
              <label style={fieldLabel}>Expected</label>
              <input type="date" value={release.expected_date || ''}
                onChange={e => onPatch({ expectedDate: e.target.value })} style={inputBase} />
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={fieldLabel}>Step</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PR_STEPS.map(s => {
                const on = release.step_key === s.key
                return (
                  <button key={s.key} onClick={() => onPatch({ stepKey: s.key })}
                    style={{ ...btn(on ? C.mintSoft : 'transparent', on ? C.mintText : C.grayMid, on ? C.mint : C.border),
                             borderRadius: 999, fontSize: 11.5, padding: '5px 11px' }}>
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* body */}
        <div style={{ padding: '20px 26px 26px', maxHeight: '52vh', overflowY: 'auto' }}>
          <div>
            <span style={secLabel}>Content</span>
            <textarea value={body} onChange={e => saveBody(e.target.value)} rows={7}
              placeholder="The angle, the narrative, quotes to chase, anything the next person needs."
              style={{ ...inputBase, lineHeight: 1.5, resize: 'vertical' }} />
          </div>

          <div style={sec}>
            <span style={secLabel}>Links {links.length ? `· ${links.length}` : ''}</span>
            {links.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <a href={l.url} target="_blank" rel="noopener noreferrer"
                   style={{ flex: 1, minWidth: 0, color: C.mintText, fontSize: 15, textDecoration: 'none', wordBreak: 'break-all' }}>
                  {l.title || l.url}
                </a>
                <button onClick={() => onDeleteItem(l.id)} style={btn('transparent', C.grayLight, C.border)}>Remove</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} placeholder="Label" style={{ ...inputBase, maxWidth: 190 }} />
              <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…" style={inputBase}
                onKeyDown={e => { if (e.key === 'Enter') addLink() }} />
              <button onClick={addLink} style={btn(C.dark, C.white)}>Add</button>
            </div>
          </div>

          <div style={sec}>
            <span style={secLabel}>Attachments {files.length ? `· ${files.length}` : ''}</span>
            {files.map(f => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 15, wordBreak: 'break-all' }}>
                  {f.file_name} <span style={{ fontFamily: MONO, fontSize: 12, color: C.grayLight }}>{bytes(f.size_bytes)}</span>
                </span>
                <button onClick={() => download(f)} style={btn('transparent', C.mintText, C.mint)}>Download</button>
                <button onClick={() => onDeleteItem(f.id)} style={btn('transparent', C.grayLight, C.border)}>Remove</button>
              </div>
            ))}
            <div style={{ marginTop: 10 }}>
              <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn(C.mint, C.dark)}>
                {busy ? 'Uploading…' : 'Attach a file'}
              </button>
              <input ref={fileRef} type="file" hidden onChange={pickFile} />
              <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.grayLight, marginLeft: 10 }}>3MB max — larger files go in as links</span>
            </div>
          </div>

          <div style={sec}>
            <span style={secLabel}>Comments {comments.length ? `· ${comments.length}` : ''}</span>
            {comments.map(c => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.mintText }}>{c.author || 'viax'}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11.5, color: C.grayLight, flex: 1 }}>
                    {new Date(c.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                  <button onClick={() => onDeleteItem(c.id)} style={btn('transparent', C.grayLight, C.border)}>Remove</button>
                </div>
                <p style={{ fontSize: 15, color: C.grayMid, marginTop: 5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{c.body}</p>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-start' }}>
              <input value={author} onChange={e => setAuthor(e.target.value)} placeholder="You" style={{ ...inputBase, maxWidth: 130 }} />
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Add a comment…"
                style={{ ...inputBase, resize: 'vertical' }} />
              <button onClick={addComment} style={btn(C.dark, C.white)}>Post</button>
            </div>
          </div>
        </div>

        <div style={{ padding: '14px 26px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
          <button onClick={() => onDelete(release)} style={btn('transparent', C.red, C.redBorder)}>Delete this release</button>
          <button onClick={onClose} style={btn(C.dark, C.white)}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── The card that sits in a lane ───────────────────────────────────────

function ReleaseCard({ release, counts, onOpen, onDragStart, onDragEnd, dragging }) {
  const d = daysUntil(release.expected_date)
  const late = d !== null && d < 0 && release.step_key !== 'amplified'
  const soon = d !== null && d >= 0 && d <= 14 && release.step_key !== 'amplified'
  return (
    <div
      draggable
      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart(release.id) }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(release)}
      style={{
        background: C.white, border: `1px solid ${dragging ? C.mint : C.border}`, borderRadius: 9,
        padding: '11px 13px', cursor: 'grab', opacity: dragging ? 0.4 : 1,
        boxShadow: '0 1px 2px rgba(30,30,30,0.05)', width: STEP_W - 22,
      }}>
      <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.25px' }}>{release.client}</div>
      {release.expected_date && (
        <div style={{
          fontFamily: MONO, fontSize: 11, marginTop: 6, display: 'inline-block',
          padding: '2px 7px', borderRadius: 4,
          background: late ? C.redSoft : soon ? C.amberSoft : C.bgMed,
          color: late ? C.red : soon ? C.amber : C.grayMid,
        }}>
          {fmtDate(release.expected_date)}
        </div>
      )}
      {(counts.link || counts.attachment || counts.comment) > 0 && (
        <div style={{ display: 'flex', gap: 9, marginTop: 8, fontFamily: MONO, fontSize: 11, color: C.grayLight }}>
          {counts.link ? <span>{counts.link} link{counts.link > 1 ? 's' : ''}</span> : null}
          {counts.attachment ? <span>{counts.attachment} file{counts.attachment > 1 ? 's' : ''}</span> : null}
          {counts.comment ? <span>{counts.comment} note{counts.comment > 1 ? 's' : ''}</span> : null}
        </div>
      )}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function PressReleasesPage() {
  const [releases, setReleases] = useState([])
  const [items, setItems]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [status, setStatus]     = useState('idle')
  const [openId, setOpenId]     = useState(null)
  const [dragId, setDragId]     = useState(null)      // card being dragged across steps
  const [hoverCell, setHoverCell] = useState(null)
  const [dragLane, setDragLane] = useState(null)      // lane being dragged to re-rank
  const [dropAt, setDropAt]     = useState(null)      // index the dragged lane would land at

  const load = useCallback(async () => {
    try {
      const data = await api.pressReleases.init({ releases: SEED })
      setReleases((data.releases || []).sort((a, b) => a.position - b.position))
      setItems(data.items || [])
      setError(null)
    } catch (e) {
      console.error('Failed to load press releases', e)
      setError(e.message || 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const itemsByRelease = useMemo(() => {
    const m = {}
    items.forEach(i => { (m[i.release_id] = m[i.release_id] || []).push(i) })
    return m
  }, [items])

  const countsFor = useCallback((id) => {
    const list = itemsByRelease[id] || []
    return {
      link: list.filter(i => i.kind === 'link').length,
      attachment: list.filter(i => i.kind === 'attachment').length,
      comment: list.filter(i => i.kind === 'comment').length,
    }
  }, [itemsByRelease])

  const patchRelease = useCallback(async (release, patch) => {
    const next = {
      ...release,
      ...(patch.client !== undefined ? { client: patch.client } : {}),
      ...(patch.topic !== undefined ? { topic: patch.topic } : {}),
      ...(patch.viaxOwners !== undefined ? { viax_owners: patch.viaxOwners } : {}),
      ...(patch.clientOwners !== undefined ? { client_owners: patch.clientOwners } : {}),
      ...(patch.stepKey !== undefined ? { step_key: patch.stepKey } : {}),
      ...(patch.expectedDate !== undefined ? { expected_date: patch.expectedDate || null } : {}),
    }
    setReleases(prev => prev.map(r => r.id === release.id ? next : r))
    setStatus('saving')
    try {
      await api.pressReleases.upsert({
        id: next.id, client: next.client, topic: next.topic,
        viaxOwners: next.viax_owners, clientOwners: next.client_owners,
        stepKey: next.step_key, expectedDate: next.expected_date, position: next.position,
      })
      setStatus('saved')
    } catch (e) { console.error(e); setStatus('error'); load() }
  }, [load])

  const moveRelease = useCallback(async (releaseId, stepKey) => {
    setReleases(prev => prev.map(r => r.id === releaseId ? { ...r, step_key: stepKey } : r))
    setStatus('saving')
    try { await api.pressReleases.move(releaseId, stepKey); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [load])

  const addItem = useCallback(async (releaseId, item) => {
    setStatus('saving')
    try {
      const saved = await api.pressReleases.upsertItem(releaseId, item)
      setItems(prev => {
        const without = prev.filter(i => i.id !== saved.id)
        return [...without, saved]
      })
      setStatus('saved')
      return saved
    } catch (e) { console.error(e); setStatus('error') }
  }, [])

  const deleteItem = useCallback(async (itemId) => {
    setItems(prev => prev.filter(i => i.id !== itemId))
    setStatus('saving')
    try { await api.pressReleases.deleteItem(itemId); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [load])

  const addRelease = useCallback(async () => {
    const client = window.prompt('Which client is this release for?')
    if (!client || !client.trim()) return
    setStatus('saving')
    try {
      const created = await api.pressReleases.upsert({
        client: client.trim(), topic: '', viaxOwners: '', clientOwners: '',
        stepKey: 'candidate', expectedDate: null, position: releases.length,
      })
      setReleases(prev => [...prev, created])
      setOpenId(created.id)
      setStatus('saved')
    } catch (e) { console.error(e); setStatus('error') }
  }, [releases.length])

  const removeRelease = useCallback(async (release) => {
    if (!window.confirm(`Delete the ${release.client} release and everything on its card?`)) return
    setOpenId(null)
    setReleases(prev => prev.filter(r => r.id !== release.id))
    setStatus('saving')
    try { await api.pressReleases.remove(release.id); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [load])

  // Force ranking: drop a lane into a new slot, renumber, persist only the
  // lanes whose position actually moved.
  const applyLaneDrop = useCallback(async () => {
    const from = releases.findIndex(r => r.id === dragLane)
    setDragLane(null); setDropAt(null)
    if (from < 0 || dropAt === null) return

    const next = releases.slice()
    const [moved] = next.splice(from, 1)
    next.splice(dropAt > from ? dropAt - 1 : dropAt, 0, moved)

    const renumbered = next.map((r, i) => ({ ...r, position: i }))
    const changed = renumbered
      .filter(r => (releases.find(o => o.id === r.id) || {}).position !== r.position)
      .map(r => ({ id: r.id, position: r.position }))
    if (!changed.length) return

    setReleases(renumbered)
    setStatus('saving')
    try { await api.pressReleases.reorder(changed); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [releases, dragLane, dropAt, load])

  const open = releases.find(r => r.id === openId) || null

  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingTop: 56, fontFamily: FONT, color: C.dark, fontWeight: 300 }}>
      <div style={{ padding: '32px 32px 70px' }}>

        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 30, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }}>
              Press Releases
            </p>
            <div style={{ width: 44, height: 4, background: C.mint, borderRadius: 2, margin: '12px 0 16px' }} />
            <h1 style={{ fontSize: 38, fontWeight: 400, letterSpacing: '-1.1px', lineHeight: 1.05 }}>
              Every release, every step, one owner each.
            </h1>
            <p style={{ fontSize: 16.5, color: C.grayMid, marginTop: 10, maxWidth: 760 }}>
              One lane per release. Drag a card right as it clears each step, or drag a lane by its rail to force-rank the list. Open a card for the story, links, files and notes.
            </p>
          </div>
          <button onClick={addRelease} style={{ ...btn(C.dark, C.white), fontSize: 13, padding: '10px 18px' }}>
            Add a release
          </button>
        </div>

        {loading && <p style={{ marginTop: 34, fontFamily: MONO, fontSize: 13, color: C.grayLight }}>Loading the board…</p>}
        {error && (
          <div style={{ marginTop: 22, background: C.redSoft, border: `1px solid ${C.redBorder}`, borderRadius: 8, padding: '14px 18px', fontSize: 15, color: C.red }}>
            {error}
            <button onClick={load} style={{ ...btn('transparent', C.red, C.redBorder), marginLeft: 10 }}>Retry</button>
          </div>
        )}

        {/* board */}
        {!loading && !error && (
          <div style={{ marginTop: 28, overflowX: 'auto', paddingBottom: 10 }}>
            <div style={{ minWidth: LANE_W + PR_STEPS.length * STEP_W }}>

              {/* step headers */}
              <div style={{ display: 'flex' }}>
                <div style={{ width: LANE_W + 10, flexShrink: 0 }} />
                {PR_STEPS.map((s, i) => (
                  <div key={s.key} style={{
                    width: STEP_W, flexShrink: 0, background: C.dark, padding: '10px 12px',
                    borderRight: i === PR_STEPS.length - 1 ? 'none' : '1px solid #383838',
                    borderTopLeftRadius: i === 0 ? 8 : 0, borderBottomLeftRadius: i === 0 ? 8 : 0,
                    borderTopRightRadius: i === PR_STEPS.length - 1 ? 8 : 0,
                    borderBottomRightRadius: i === PR_STEPS.length - 1 ? 8 : 0,
                  }}>
                    <div style={{ fontFamily: MONO, fontSize: 11, color: C.mint, letterSpacing: '0.06em' }}>
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: 14.5, fontWeight: 500, color: C.white, marginTop: 2, lineHeight: 1.15 }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 3, lineHeight: 1.3 }}>{s.hint}</div>
                  </div>
                ))}
              </div>

              {/* lanes */}
              {releases.map((r, laneIdx) => {
                const at = STEP_INDEX[r.step_key] ?? 0
                const beingDragged = dragLane === r.id
                return (
                  <div key={r.id}
                    onDragOver={e => {
                      if (!dragLane) return
                      e.preventDefault()
                      const b = e.currentTarget.getBoundingClientRect()
                      setDropAt(e.clientY < b.top + b.height / 2 ? laneIdx : laneIdx + 1)
                    }}
                    onDrop={e => { if (dragLane) { e.preventDefault(); applyLaneDrop() } }}
                    style={{ position: 'relative', opacity: beingDragged ? 0.45 : 1 }}>

                    {/* where it will land */}
                    {dragLane && dropAt === laneIdx && (
                      <div style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 3, background: C.mint, borderRadius: 2, zIndex: 3 }} />
                    )}
                    {dragLane && dropAt === laneIdx + 1 && laneIdx === releases.length - 1 && (
                      <div style={{ position: 'absolute', bottom: -6, left: 0, right: 0, height: 3, background: C.mint, borderRadius: 2, zIndex: 3 }} />
                    )}

                    <div style={{ display: 'flex', marginTop: 12, alignItems: 'stretch' }}>
                    {/* lane rail — drag it to re-rank */}
                    <div
                      draggable
                      onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; setDragLane(r.id) }}
                      onDragEnd={() => { setDragLane(null); setDropAt(null) }}
                      style={{
                        width: LANE_W, flexShrink: 0, background: C.white,
                        border: `1px solid ${beingDragged ? C.mint : C.border}`,
                        borderRadius: 9, padding: '13px 15px', marginRight: 10, cursor: 'grab',
                      }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, color: C.mintText,
                                       background: C.mintSoft, borderRadius: 4, padding: '2px 6px' }}>
                          {String(laneIdx + 1).padStart(2, '0')}
                        </span>
                        <span style={{ color: C.border, fontSize: 13, letterSpacing: '-1px', userSelect: 'none' }}>⠿</span>
                      </div>
                      <div style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.35px', marginTop: 7 }}>{r.client}</div>
                      <p style={{ fontSize: 13.5, color: C.grayMid, marginTop: 5, lineHeight: 1.38 }}>{r.topic}</p>
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'grid', gap: 5 }}>
                        <div style={{ fontFamily: MONO, fontSize: 11.5 }}>
                          <span style={{ color: C.grayLight }}>viax </span>
                          <span style={{ color: C.mintText, fontWeight: 500 }}>{r.viax_owners || '—'}</span>
                        </div>
                        <div style={{ fontFamily: MONO, fontSize: 11.5 }}>
                          <span style={{ color: C.grayLight }}>client </span>
                          <span style={{ color: C.dark }}>{r.client_owners || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* step cells */}
                    {PR_STEPS.map((s, i) => {
                      const here = r.step_key === s.key
                      const done = i < at
                      const hovered = hoverCell === `${r.id}:${s.key}`
                      return (
                        <div key={s.key}
                          onDragOver={e => { if (dragId === r.id && !dragLane) { e.preventDefault(); e.stopPropagation(); setHoverCell(`${r.id}:${s.key}`) } }}
                          onDragLeave={() => setHoverCell(h => (h === `${r.id}:${s.key}` ? null : h))}
                          onDrop={e => {
                            e.preventDefault(); setHoverCell(null)
                            if (dragId === r.id && !here) moveRelease(r.id, s.key)
                            setDragId(null)
                          }}
                          style={{
                            width: STEP_W, flexShrink: 0, minHeight: 96, padding: 8,
                            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                            background: hovered ? C.mintSoft : done ? 'rgba(94,212,154,0.06)' : 'transparent',
                            borderRadius: 8,
                            borderRight: i === PR_STEPS.length - 1 ? 'none' : `1px dashed ${C.border}`,
                          }}>
                          {here && (
                            <ReleaseCard
                              release={r} counts={countsFor(r.id)}
                              dragging={dragId === r.id}
                              onOpen={() => setOpenId(r.id)}
                              onDragStart={setDragId}
                              onDragEnd={() => { setDragId(null); setHoverCell(null) }}
                            />
                          )}
                        </div>
                      )
                    })}
                    </div>
                  </div>
                )
              })}

              {!releases.length && (
                <div style={{ marginTop: 16, padding: '34px 0', textAlign: 'center', fontSize: 15.5, color: C.grayMid }}>
                  No releases on the board yet.
                </div>
              )}
            </div>
          </div>
        )}

        <p style={{ marginTop: 26, fontFamily: MONO, fontSize: 12, color: C.grayLight }}>
          Seeded from the Product Marketing Blitz call, 22 Sep 2026 · dates are proposals, edit them on the card
        </p>
      </div>

      {open && (
        <CardModal
          release={open}
          items={itemsByRelease[open.id] || []}
          onClose={() => setOpenId(null)}
          onPatch={patch => patchRelease(open, patch)}
          onAddItem={item => addItem(open.id, item)}
          onDeleteItem={deleteItem}
          onDelete={removeRelease}
        />
      )}

      {status !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 120,
          fontFamily: MONO, fontSize: 12, fontWeight: 500, padding: '8px 14px', borderRadius: 999,
          background: status === 'error' ? C.redSoft : C.dark,
          color: status === 'error' ? C.red : C.mint,
          border: `1px solid ${status === 'error' ? C.redBorder : '#383838'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed — retry or reload'}
        </div>
      )}
    </div>
  )
}
