import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/lib/api'

// ── Marketing Blitz — reusable launch-campaign template ────────────────
//
// One page renders any blitz. The narrative scaffolding for each campaign
// lives in BLITZ_CONTENT below, keyed by slug; everything a person types is
// stored in Supabase (blitzes / blitz_fields / blitz_meetings / blitz_decks).
//
// To add the next blitz:
//   1. add an entry to BLITZ_CONTENT keyed by its slug
//   2. add a <Route path="/blitz/<slug>" …> in App.jsx
//   3. add the item to the Marketing Blitz dropdown in Nav.jsx
// The blitz row and its seed meetings are created on first load.

const FONT = "'Funnel Sans', 'Inter', system-ui, sans-serif"
const MONO = "'DM Mono', ui-monospace, SFMono-Regular, Menlo, monospace"

const C = {
  cream: '#F8F7F6', white: '#FEFEFE', dark: '#1E1E1E',
  border: '#E2E0DC', bgMed: '#E8E6E3',
  grayMid: '#525252', grayLight: '#8A8A8A',
  mint: '#5ED49A', mintText: '#177558', mintSoft: 'rgba(94,212,154,0.15)',
}

const AUDIENCE_TAG = {
  client:  { bg: C.mintSoft, color: C.mintText, label: 'Client' },
  partner: { bg: '#EDE7FB',  color: '#4B3A82',  label: 'Partner' },
  analyst: { bg: '#FBEBD7',  color: '#8A5A16',  label: 'Analyst' },
  qbr:     { bg: C.bgMed,    color: C.grayMid,  label: 'QBR held' },
}

// ── Campaign content ───────────────────────────────────────────────────

const BLITZ_CONTENT = {
  rmb: {
    name: 'Blitz: RMB',
    feature: 'Revenue Motion Builder',
    eyebrow: 'Blitz Feature · Release Launchpad',
    heading: ['Revenue Motion', 'Builder ', 'blitz.'],
    lede: 'Every meeting, asset and post for the blitz, mapped to the six launchpad phases. Phase 1 and 2 feed everything downstream — nothing in phases 3 to 6 gets written until the concepts and the script are locked.',
    tagline: { pre: 'The execution layer for any ', em: 'revenue motion', post: ' you can describe.' },
    taglineSub: 'Modeled once. Governed end-to-end. Running outside ERP in days.',
    ctas: ['Schedule a Demo', 'Start Proof-of-Value'],
    diagram: {
      src: '/blitz-rmb-execution-layer.png',
      alt: 'AI reasons — business intent in plain language — flows into the viax governed execution layer, one model for participants, pricing, approvals, orders, subscriptions and commissions, which connects to SAP S/4HANA as the system of record.',
      caption: 'AI reasons. viax executes. ERP records.',
      note: 'The one diagram behind every pillar below. Use it as the opening frame in all three deck versions and as the still under the teaser — it makes "unopinionated," "unified participant model" and "deterministic" visible before anyone has to explain them.',
    },
    pillars: [
      { k: 'Pillar 01', h: 'Unrestricted intent to execution', p: 'Describe any motion end to end in plain language — then keep evolving it. The limit is imagination, not systems.' },
      { k: 'Pillar 02', h: 'Unopinionated platform', p: 'Clients build their solutions their way. Nothing is retrofitted to somebody else’s checklist.' },
      { k: 'Pillar 03', h: 'Unified participant model', p: 'Commerce, sales, partners and distributors all live in one schema — not four integrations.' },
      { k: 'Pillar 04', h: 'Deterministic AI', p: 'Everything modeled and governed, never probabilistic. AI reasons, viax executes, ERP records.' },
      { k: 'Pillar 05', h: 'Build it your way — and have it last', p: '"Vibe code your enterprise, the way you want, in a way that actually works long-term."' },
      { k: 'Competitive frame', h: 'Versus Commerce Tools', p: 'viax lets clients build their own revenue motions. The alternative is retrofitting software to a fixed checklist.' },
    ],
    languageNote: 'Language watch-outs. "Revenue motion" needs a plain-language anchor people already own — business sales process or plain language intent to execution. Avoid "business process": it reads as back-office ops, inventory and manufacturing. And "deterministic AI platform" does not land on its own — it always needs a sentence of context behind it.',
    beats: [
      { n: 'Beat 01', t: 'Intake', d: 'Business intent typed in plain language. No forms, no requirements doc.' },
      { n: 'Beat 02', t: 'Clarifying questions', d: 'The agent interrogates the intent. Depth is a dial — fast or thorough.' },
      { n: 'Beat 03', t: 'Plan review', d: 'Plan rationale, determination models with context and outputs, configuration model.' },
      { n: 'Beat 04', t: 'Jira Epic and Story', d: 'The plan lands as real tickets in the real backlog — not a slide.' },
      { n: 'Beat 05', t: 'Agent delegation', d: 'Specialists spawned per model. The team becomes the agent managers.' },
      { n: 'Beat 06', t: 'Build out', d: 'Segments, components, options, rules, conditions and actions generated.' },
      { n: 'Beat 07', t: 'The built UI', d: 'Show the working surface that came out the other end.' },
      { n: 'Throughline', t: 'Say it out loud', d: 'Land the "configured, not coded" point at beat 04 and again at beat 07.', accent: true },
    ],
    spine: '"This is not a bespoke, vibe-coded site. It is a configured, governed application running under the engines."',
    scriptNote: 'Three deck versions come off this script — one per audience: client, partner, marketing agency and analyst. Scheduling for phases 3 and 4 starts the moment the script is signed off.',
    decks: [
      { audience: 'client',  k: 'Version 01', h: 'Client', d: 'Outcome first. The three-month requirements cycle becomes a first-week vision. Runs at Cintas, 2U and AutoTrust.' },
      { audience: 'partner', k: 'Version 02', h: 'Partner', d: 'Delivery economics. Faster, more profitable implementations, wider scope, less reliance on inexperienced developers. Runs at iM Digital and Aries.' },
      { audience: 'agency',  k: 'Version 03', h: 'Marketing agency & analyst', d: 'Category first. The Agentic Revenue Motions Platform and the execution layer the stack was missing. Runs at Gartner and IDC/MGI.' },
    ],
    meetingSeeds: [
      { phase: 'field', audience: 'client', name: 'Cintas', position: 0,
        angle: 'Contract signed and press release contractually committed — but Cintas has not seen Revenue Motion Builder, and the AI angle needs careful handling. Use the QBR to decide whether the intro happens here or after the press release lands.' },
      { phase: 'field', audience: 'client', name: '2U', position: 1,
        angle: 'Deep in à la carte delivery with Aries alongside. Lead with the "first-week vision instead of a three-month requirements cycle" angle — this audience has lived the requirements cycle.' },
      { phase: 'field', audience: 'client', name: 'AutoTrust', position: 2,
        angle: 'Joint press release likely early October, with five or more members expected on the platform by end of September. Brief them before the release drafts are locked so the announcement and the campaign reinforce each other rather than competing.' },
      { phase: 'field', audience: 'partner', name: 'iM Digital', position: 3,
        angle: 'Partnership announcement already in a good position. Best candidate to host the phase 6 webinar and push it to their own channels. Frame RMB as faster, more profitable delivery and wider scope inside the project.' },
      { phase: 'field', audience: 'partner', name: 'Aries Solutions', position: 4,
        angle: 'Closest partner to the build through the 2U work, so the demo can go deeper. RMB as an architecture tool that de-risks the project and reduces reliance on inexperienced developers.' },
      { phase: 'analyst', audience: 'analyst', name: 'Gartner', position: 0,
        angle: 'Lead with the category, not the feature: the Agentic Revenue Motions Platform and the execution layer the stack was missing. Briefing requests carry weeks of lead time, so the date goes in the calendar before the script is finished, not after.' },
      { phase: 'qbr', audience: 'qbr', name: 'Wiley',             position: 0, angle: '' },
      { phase: 'qbr', audience: 'qbr', name: 'Wiley AS',          position: 1, angle: '' },
      { phase: 'qbr', audience: 'qbr', name: 'Boston Scientific', position: 2, angle: '' },
      { phase: 'qbr', audience: 'qbr', name: 're-ops',            position: 3, angle: '' },
    ],
    teaser: {
      k: 'Launch asset · Teaser',
      t: 'Revenue Motion Teaser v3',
      url: 'https://claude.ai/design/p/fa7e24d5-45d6-4fd1-b69b-09d2d21938c9?file=Revenue+Motion+Teaser+v3.dc.html',
      display: 'claude.ai/design/p/fa7e24d5-45d6-4fd1-b69b-09d2d21938c9',
    },
    formats: [
      { k: 'Format 01 · Teaser', h: 'No talking heads', p: 'Short. Music, clicks, animation. Runs on LinkedIn and as the website hero. This is the asset linked above.' },
      { k: 'Format 02 · Walkthrough', h: 'Someone on screen', p: 'A person typing and talking through the full motion builder flow, sped up where it drags. Ship this one first — it establishes the format before anything else iterates.' },
      { k: 'Format 03 · Interview', h: 'Two minutes on one concept', p: 'Dennis interviewing a team member or partner on a single idea. Brandon has already volunteered for one.' },
    ],
    ideas: [
      { k: 'Clip', t: 'Intent to Jira in 90 seconds', d: 'Beats 01 to 04 only. The single most surprising thing in the whole flow.' },
      { k: 'Clip', t: 'Watch the agent ask better questions than the brief', d: 'Beat 02 alone, with the depth dial turned to thorough.' },
      { k: 'Proof clip', t: 'Configured, not coded', d: 'Open the engines underneath the built UI. Directly answers the vibe-code objection.' },
      { k: 'Clip', t: 'One schema, every participant', d: 'Commerce, sales, partners and distributors in a single model — the unified participant pillar, shown not claimed.' },
      { k: 'Clip', t: 'Agent delegation, live', d: 'Specialists spawning per determination model at beat 05.' },
      { k: 'Concept', t: 'Why "deterministic" is the whole argument', d: 'Two minutes on governed versus probabilistic. The phrase needs this context every time.' },
      { k: 'Contrast', t: 'Build your motion vs. fit the checklist', d: 'The Commerce Tools frame, run as a side-by-side.' },
      { k: 'Narrative', t: 'The three-month requirements cycle', d: 'Story-only short, no demo footage. Ends on first-week vision.' },
      { k: 'Blocked', t: 'Claude Design animated teaser', d: 'Output already beat expectations from a single 30-second prompt. Blocker: design system not linked — SVG logos missing, font mismatch.', muted: true },
    ],
    showcase: [
      { k: 'Format', h: 'Partner hosts, customer talks', p: 'The customer is 90% of the content, the partner does a brief intro and viax takes questions. A partner host pushes it to their own channels and brings their contact list.' },
      { k: 'Scope', h: 'Ticket creation and plan finalisation', p: 'Showcase scope stops at Jira ticket creation and a finalised plan — not a full implementation inside viax. Keeps the session honest and inside an hour.' },
      { k: 'Story', h: '"We did this on our own"', p: 'The whole point is a customer who built it themselves with no heavy consulting dependency. viax enabled it — that is the entire claim.' },
    ],
    interviewees: [
      { value: 'brendan', name: 'Brendan', who: 'Aries Solutions · partner', d: 'Closest to the build through the 2U work, so he can speak to delivery mechanics and project risk with real detail. The partner-implementation angle: faster, more profitable delivery.' },
      { value: 'teegan',  name: 'Teegan',  who: 'Solventum · client', d: 'The customer-built story in its purest form — someone building a motion themselves and presenting it. Stronger proof, but needs consent and a publish path agreed up front.' },
    ],
    announcements: [
      { n: 'Cintas', d: 'Signed. Release contractually committed, targeting September. Needs two or three quote sentences from Josh and Todd. The blitz follows right after.' },
      { n: 'AutoTrust', d: 'Joint release likely early October. Five or more members expected on the platform by end of September.' },
      { n: 'iM Digital', d: 'Partnership announcement in a good position. Timing still open — natural pairing with the phase 6 webinar.' },
      { n: 'Solventum', d: 'Language approval still outstanding. Gates the Teegan interview option in phase 6.' },
      { n: 'Wiley', d: 'Still in purgatory on a full release. A LinkedIn post tied to the OMS work is the realistic move.' },
    ],
    sources: 'Sources: Release Launchpad (Sep 1) · Marketing for RMB (Sep 3) · RMB review (Sep 4)',
  },
}

// ── Shared styles ──────────────────────────────────────────────────────

const eyebrow = { fontFamily: MONO, fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mintText }
const rule = { width: 44, height: 4, background: C.mint, borderRadius: 2, margin: '12px 0 20px' }
const card = { background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '20px 22px' }
const kLabel = { fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mintText, marginBottom: 10, display: 'block' }
const fieldLabel = { display: 'block', fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 6 }
const inputBase = {
  width: '100%', boxSizing: 'border-box', fontFamily: FONT, fontSize: 15, fontWeight: 300,
  color: C.dark, background: C.cream, border: `1px solid ${C.border}`, borderRadius: 7,
  padding: '9px 12px', outline: 'none',
}
const btn = (bg, color, border) => ({
  fontFamily: MONO, fontSize: 12, fontWeight: 500, background: bg, color,
  border: `1px solid ${border || bg}`, borderRadius: 6, padding: '7px 13px', cursor: 'pointer',
})

// ── Persisted inputs ───────────────────────────────────────────────────
// Each keeps local state for a responsive cursor and pushes to the backend
// on a 600ms debounce, so a long note is one write instead of one per key.

function useDebouncedSave(value, save, deps = []) {
  const timer = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => save(value), 600)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, ...deps])
}

function Field({ label, fieldKey, value, onSave, placeholder, type = 'text', rows }) {
  const [v, setV] = useState(value ?? '')
  const [focused, setFocused] = useState(false)
  useEffect(() => { setV(value ?? '') }, [value])
  useDebouncedSave(v, (next) => { if (next !== (value ?? '')) onSave(fieldKey, next) }, [fieldKey])

  const style = {
    ...inputBase,
    background: focused ? C.white : C.cream,
    borderColor: focused ? C.mint : C.border,
    ...(rows ? { lineHeight: 1.5, resize: 'vertical' } : {}),
  }
  return (
    <div>
      {label && <label style={fieldLabel}>{label}</label>}
      {rows ? (
        <textarea rows={rows} value={v} placeholder={placeholder} style={style}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={e => setV(e.target.value)} />
      ) : (
        <input type={type} value={v} placeholder={placeholder} style={style}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          onChange={e => setV(e.target.value)} />
      )}
    </div>
  )
}

function ChoicePills({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {options.map(o => {
        const on = value === o.value
        return (
          <button key={o.value} onClick={() => onChange(on ? '' : o.value)}
            style={{
              fontFamily: MONO, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              borderRadius: 999, padding: '6px 14px',
              background: on ? C.mintSoft : 'transparent',
              color: on ? C.mintText : C.grayMid,
              border: `1px solid ${on ? C.mint : C.border}`,
            }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Phase header ───────────────────────────────────────────────────────

function PhaseHead({ num, kicker, title, desc, owner }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, paddingBottom: 14, borderBottom: `2px solid ${C.dark}` }}>
      <span style={{ fontFamily: MONO, fontSize: 42, fontWeight: 500, color: C.mint, lineHeight: 0.9 }}>{num}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.grayLight }}>{kicker}</p>
        <h2 style={{ fontSize: 31, fontWeight: 500, letterSpacing: '-0.7px', lineHeight: 1.1, marginTop: 3 }}>{title}</h2>
        <p style={{ fontSize: 16, color: C.grayMid, marginTop: 7, maxWidth: 820 }}>{desc}</p>
      </div>
      {owner && (
        <div style={{ textAlign: 'right', paddingTop: 4, flexShrink: 0 }}>
          <span style={{ display: 'block', fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 6 }}>
            {owner.includes('·') ? 'Owners' : 'Owner'}
          </span>
          <span style={{ display: 'inline-block', fontFamily: MONO, fontSize: 13, fontWeight: 500, color: C.mintText, background: C.mintSoft, border: `1px solid ${C.mint}`, borderRadius: 999, padding: '4px 12px', whiteSpace: 'nowrap' }}>
            {owner}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Deck slot ──────────────────────────────────────────────────────────

function DeckSlot({ spec, deck, slug, onSaved, onRemoved, setStatus }) {
  const fileRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const has = !!(deck && (deck.file_name || deck.content))

  const pick = async (e) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    setBusy(true); setStatus('saving')
    try {
      const content = await f.text()
      const saved = await api.blitz.upsertDeck(slug, { audience: spec.audience, fileName: f.name, link: deck?.link || '', content })
      onSaved(saved); setStatus('saved')
    } catch (err) {
      console.error(err); setStatus('error')
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const open = () => {
    if (!deck?.content) return
    const url = URL.createObjectURL(new Blob([deck.content], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const remove = async () => {
    setStatus('saving')
    try { await api.blitz.deleteDeck(slug, spec.audience); onRemoved(spec.audience); setStatus('saved') }
    catch (err) { console.error(err); setStatus('error') }
  }

  return (
    <div style={{ ...card, borderColor: has ? C.mint : C.border, display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mintText }}>{spec.k}</span>
      <h4 style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.3px', marginTop: 4 }}>{spec.h}</h4>
      <p style={{ fontSize: 14.5, color: C.grayMid, marginTop: 6, lineHeight: 1.4, flex: 1 }}>{spec.d}</p>

      <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={btn(C.mint, C.dark)}>
            {busy ? 'Uploading…' : has ? 'Replace' : 'Attach HTML deck'}
          </button>
          {has && deck?.content && <button onClick={open} style={btn('transparent', C.grayMid, C.border)}>Open</button>}
          {has && <button onClick={remove} style={btn('transparent', C.grayMid, C.border)}>Remove</button>}
          <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={pick} />
          <span style={{ flex: '1 1 100%', fontFamily: MONO, fontSize: 12, wordBreak: 'break-all', lineHeight: 1.4, color: has ? C.mintText : C.grayLight }}>
            {has ? deck.file_name || 'Deck attached' : 'No deck attached'}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Meeting row ────────────────────────────────────────────────────────

function toLocalInput(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d)) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function MeetingCard({ meeting, onPatch, onDelete }) {
  const tag = AUDIENCE_TAG[meeting.audience] || AUDIENCE_TAG.client
  const [hover, setHover] = useState(false)
  return (
    <div style={{ ...card, marginBottom: 12, position: 'relative' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 21, fontWeight: 500, letterSpacing: '-0.4px' }}>{meeting.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, background: tag.bg, color: tag.color }}>{tag.label}</span>
        {hover && (
          <button onClick={() => onDelete(meeting)}
            style={{ ...btn('transparent', C.grayLight, C.border), marginLeft: 'auto' }}>Remove</button>
        )}
        {meeting.angle && <p style={{ flex: '1 1 100%', fontSize: 15, color: C.grayMid, marginTop: 2 }}>{meeting.angle}</p>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 14, marginTop: 15, paddingTop: 15, borderTop: `1px solid ${C.border}` }}>
        <Field label="Date and time" type="datetime-local" fieldKey="meetAt"
          value={toLocalInput(meeting.meet_at)}
          onSave={(_, v) => onPatch(meeting, { meetAt: v ? new Date(v).toISOString() : null })} />
        <Field label="Who will share the LinkedIn posts" fieldKey="sharers"
          value={meeting.sharers}
          placeholder="Names of attendees who agreed to post or comment"
          onSave={(_, v) => onPatch(meeting, { sharers: v })} />
      </div>
    </div>
  )
}

function QbrRow({ meeting, onPatch, onDelete }) {
  const [hover, setHover] = useState(false)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '225px 1fr auto', gap: 16, alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${C.border}` }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>{meeting.name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', padding: '3px 9px', borderRadius: 4, background: C.bgMed, color: C.grayMid, whiteSpace: 'nowrap' }}>QBR held</span>
      </div>
      <Field fieldKey="sharers" value={meeting.sharers}
        placeholder="Names, titles and what they committed to — post, comment or repost"
        onSave={(_, v) => onPatch(meeting, { sharers: v })} />
      <button onClick={() => onDelete(meeting)}
        style={{ ...btn('transparent', C.grayLight, C.border), visibility: hover ? 'visible' : 'hidden' }}>Remove</button>
    </div>
  )
}

function AddRow({ label, onAdd }) {
  const [name, setName] = useState('')
  const submit = () => { const n = name.trim(); if (!n) return; onAdd(n); setName('') }
  return (
    <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 14 }}>
      <input value={name} placeholder={label} style={{ ...inputBase, maxWidth: 320 }}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }} />
      <button onClick={submit} style={btn(C.dark, C.white)}>Add</button>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────

export default function BlitzPage({ slug: slugProp }) {
  const params = useParams()
  const slug = slugProp || params.slug || 'rmb'
  const content = BLITZ_CONTENT[slug]

  const [fields, setFields]     = useState({})
  const [meetings, setMeetings] = useState([])
  const [decks, setDecks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [status, setStatus]     = useState('idle')  // idle | saving | saved | error

  const load = useCallback(async () => {
    if (!content) { setLoading(false); return }
    try {
      const data = await api.blitz.init(slug, {
        name: content.name,
        feature: content.feature,
        meetings: content.meetingSeeds,
      })
      setFields(data.fields || {})
      setMeetings(data.meetings || [])
      setDecks(data.decks || [])
      setError(null)
    } catch (e) {
      console.error('Failed to load blitz', e)
      setError(e.message || 'Failed to load blitz')
    } finally {
      setLoading(false)
    }
  }, [slug, content])

  useEffect(() => { load() }, [load])

  const saveField = useCallback(async (key, value) => {
    setFields(prev => ({ ...prev, [key]: value }))
    setStatus('saving')
    try { await api.blitz.setField(slug, key, value); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error') }
  }, [slug])

  const patchMeeting = useCallback(async (meeting, patch) => {
    const next = { ...meeting, ...(patch.sharers !== undefined ? { sharers: patch.sharers } : {}), ...(patch.meetAt !== undefined ? { meet_at: patch.meetAt } : {}) }
    setMeetings(prev => prev.map(m => m.id === meeting.id ? next : m))
    setStatus('saving')
    try {
      await api.blitz.upsertMeeting(slug, {
        id: meeting.id, phase: meeting.phase, name: meeting.name, audience: meeting.audience,
        angle: meeting.angle, position: meeting.position,
        meetAt: patch.meetAt !== undefined ? patch.meetAt : meeting.meet_at,
        sharers: patch.sharers !== undefined ? patch.sharers : meeting.sharers,
      })
      setStatus('saved')
    } catch (e) { console.error(e); setStatus('error'); load() }
  }, [slug, load])

  const addMeeting = useCallback(async (phase, audience, name) => {
    const siblings = meetings.filter(m => m.phase === phase)
    setStatus('saving')
    try {
      const created = await api.blitz.upsertMeeting(slug, {
        phase, audience, name, angle: '', sharers: '', position: siblings.length,
      })
      setMeetings(prev => [...prev, created])
      setStatus('saved')
    } catch (e) { console.error(e); setStatus('error') }
  }, [slug, meetings])

  const removeMeeting = useCallback(async (meeting) => {
    if (!window.confirm(`Remove ${meeting.name} from this blitz?`)) return
    setMeetings(prev => prev.filter(m => m.id !== meeting.id))
    setStatus('saving')
    try { await api.blitz.deleteMeeting(meeting.id); setStatus('saved') }
    catch (e) { console.error(e); setStatus('error'); load() }
  }, [load])

  if (!content) {
    return (
      <div style={{ minHeight: '100vh', background: C.cream, paddingTop: 56, fontFamily: FONT }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
          <p style={eyebrow}>Marketing Blitz</p>
          <div style={rule} />
          <h1 style={{ fontSize: 34, fontWeight: 400, letterSpacing: '-1px' }}>No blitz named “{slug}”.</h1>
          <p style={{ fontSize: 16, color: C.grayMid, marginTop: 12 }}>
            Add an entry to <code>BLITZ_CONTENT</code> in <code>src/pages/BlitzPage.jsx</code>, then add the route and the nav item.
          </p>
        </div>
      </div>
    )
  }

  const field = meetings.filter(m => m.phase === 'field').sort((a, b) => a.position - b.position)
  const analyst = meetings.filter(m => m.phase === 'analyst').sort((a, b) => a.position - b.position)
  const qbr = meetings.filter(m => m.phase === 'qbr').sort((a, b) => a.position - b.position)
  const deckFor = a => decks.find(d => d.audience === a)
  const F = (key) => fields[key] ?? ''

  return (
    <div style={{ minHeight: '100vh', background: C.cream, paddingTop: 56, fontFamily: FONT, color: C.dark, fontWeight: 300, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '48px 40px 110px' }}>

        {/* ── Masthead ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 48, alignItems: 'end', paddingBottom: 34, borderBottom: `1px solid ${C.border}` }}>
          <div>
            <p style={eyebrow}>{content.eyebrow}</p>
            <div style={rule} />
            <h1 style={{ fontSize: 52, fontWeight: 400, letterSpacing: '-1.6px', lineHeight: 1.02 }}>
              {content.heading[0]}<br />{content.heading[1]}
              <span style={{ color: C.mintText }}>{content.heading[2]}</span>
            </h1>
            <p style={{ fontSize: 19, color: C.grayMid, marginTop: 16, maxWidth: 640 }}>{content.lede}</p>
          </div>
          <div style={{ ...card }}>
            <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 12 }}>Core marketing tagline</p>
            <p style={{ fontSize: 26, fontWeight: 400, letterSpacing: '-0.6px', lineHeight: 1.15 }}>
              {content.tagline.pre}<span style={{ color: C.mintText }}>{content.tagline.em}</span>{content.tagline.post}
            </p>
            <p style={{ fontSize: 16, color: C.grayMid, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>{content.taglineSub}</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, padding: '6px 12px', borderRadius: 5, background: C.mint, color: C.dark, fontWeight: 500 }}>{content.ctas[0]}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, padding: '6px 12px', borderRadius: 5, border: `1px solid ${C.border}`, color: C.grayMid }}>{content.ctas[1]}</span>
            </div>
          </div>
        </div>

        {loading && <p style={{ marginTop: 40, fontFamily: MONO, fontSize: 13, color: C.grayLight }}>Loading blitz…</p>}
        {error && (
          <div style={{ marginTop: 24, background: '#FDECEC', border: '1px solid #F5B5B5', borderRadius: 8, padding: '14px 18px', fontSize: 15, color: '#8A1F1F' }}>
            {error} — the backend may be waking up. <button onClick={load} style={{ ...btn('transparent', '#8A1F1F', '#F5B5B5'), marginLeft: 8 }}>Retry</button>
          </div>
        )}

        {/* ── Phase 1 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="01" kicker="Gate 1 · Framing" title="Core marketing concepts" owner="Larry"
            desc="This is a revenue motion builder, not a release announcement. Everything reinforces the revenue motion framing — never &quot;product updates.&quot;" />
          <div style={{ marginTop: 22 }}>
            <figure style={{ background: C.cream, border: `1px solid ${C.border}`, borderRadius: 12, padding: '26px 28px 22px', margin: '0 0 22px' }}>
              <img src={content.diagram.src} alt={content.diagram.alt} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 4 }} />
              <figcaption style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 20, paddingTop: 17, borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 19, fontWeight: 500, letterSpacing: '-0.3px' }}>{content.diagram.caption}</span>
                <span style={{ fontSize: 15.5, color: C.grayMid, flex: 1, minWidth: 280 }}>{content.diagram.note}</span>
              </figcaption>
            </figure>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {content.pillars.map(p => (
                <div key={p.h} style={card}>
                  <span style={kLabel}>{p.k}</span>
                  <h4 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', marginBottom: 4 }}>{p.h}</h4>
                  <p style={{ fontSize: 15.5, color: C.grayMid }}>{p.p}</p>
                </div>
              ))}
            </div>

            <div style={{ background: C.bgMed, borderRadius: 8, padding: '14px 18px', fontSize: 15, color: C.grayMid, marginTop: 16 }}>
              {content.languageNote}
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="Locked catchphrase and blurb — Gate 1 output" fieldKey="p1_copy" rows={3}
                value={F('p1_copy')} onSave={saveField}
                placeholder="One sentence, then the supporting blurb. Every lane downstream quotes this verbatim." />
            </div>
          </div>
        </section>

        {/* ── Phase 2 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="02" kicker="Master asset" title="Demo script" owner="Dennis · Larry · Doug"
            desc="Written once, cut many times. The same seven beats drive the live demos, the teaser, the walkthrough video and every clip in the campaign." />
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              {content.beats.map(b => (
                <div key={b.t} style={{ background: b.accent ? C.mintSoft : C.white, border: `1px solid ${b.accent ? C.mint : C.border}`, borderRadius: 9, padding: '15px 17px' }}>
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.mintText, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{b.n}</span>
                  <div style={{ fontSize: 17, fontWeight: 500, letterSpacing: '-0.3px', marginTop: 5, lineHeight: 1.15 }}>{b.t}</div>
                  <div style={{ fontSize: 14.5, color: C.grayMid, marginTop: 7, lineHeight: 1.4 }}>{b.d}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.dark, borderRadius: 9, padding: '18px 22px', marginTop: 16 }}>
              <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mint, marginBottom: 6 }}>The line the whole demo hangs on</p>
              <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.9)' }}>{content.spine}</p>
            </div>
            <div style={{ background: C.bgMed, borderRadius: 8, padding: '14px 18px', fontSize: 15, color: C.grayMid, marginTop: 16 }}>{content.scriptNote}</div>
            <div style={{ marginTop: 16 }}>
              <Field label="Script status and open questions" fieldKey="p2_notes" rows={3} value={F('p2_notes')} onSave={saveField}
                placeholder="Where the script stands, who is recording, what is still unresolved." />
            </div>
          </div>
        </section>

        {/* ── Phase 3 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="03" kicker="Pre-launch briefings · Field" title="Partner and client demos" owner="Brian · Doug"
            desc="Live demos ahead of launch — meetings, not info bundles. Every attendee is asked to engage with the LinkedIn campaign when it drops in phase 5, so capture the names here." />
          <div style={{ marginTop: 22 }}>

            <p style={eyebrow}>Audience decks — three versions off one demo script</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, margin: '14px 0 22px' }}>
              {content.decks.map(d => (
                <DeckSlot key={d.audience} spec={d} slug={slug} deck={deckFor(d.audience)} setStatus={setStatus}
                  onSaved={saved => setDecks(prev => [...prev.filter(x => x.audience !== saved.audience), saved])}
                  onRemoved={a => setDecks(prev => prev.filter(x => x.audience !== a))} />
              ))}
            </div>

            {field.map(m => (
              <MeetingCard key={m.id} meeting={m} onPatch={patchMeeting} onDelete={removeMeeting} />
            ))}
            <AddRow label="Add a client or partner briefing…" onAdd={name => addMeeting('field', 'client', name)} />

            <div style={{ ...card, marginTop: 22 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', paddingBottom: 14, borderBottom: `1px solid ${C.border}` }}>
                <h4 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.35px' }}>QBR already held</h4>
                <p style={{ fontSize: 15, color: C.grayMid, flex: 1, minWidth: 280 }}>
                  No briefing to schedule — these accounts have already seen us this cycle. What is still open is the commitment: who on their side will like, comment or repost when the phase 5 campaign drops.
                </p>
              </div>
              {qbr.map(m => <QbrRow key={m.id} meeting={m} onPatch={patchMeeting} onDelete={removeMeeting} />)}
              <AddRow label="Add an account…" onAdd={name => addMeeting('qbr', 'qbr', name)} />
            </div>
          </div>
        </section>

        {/* ── Phase 4 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="04" kicker="Pre-launch briefings · Analysts" title="Analyst pre-brief" owner="Brian · Doug"
            desc="Share the release ahead of launch and invite input. Analysts cannot be harvested after the fact, and category definition scores far higher with them than feature news." />
          <div style={{ marginTop: 22 }}>
            {analyst.map(m => <MeetingCard key={m.id} meeting={m} onPatch={patchMeeting} onDelete={removeMeeting} />)}
            <AddRow label="Add an analyst or marketing firm…" onAdd={name => addMeeting('analyst', 'analyst', name)} />
            <div style={{ background: C.bgMed, borderRadius: 8, padding: '14px 18px', fontSize: 15, color: C.grayMid, marginTop: 16 }}>
              The ask is engagement, not coverage. The goal in every analyst conversation is that they comment on or engage with the phase 5 posts. Name a single spokesperson before the first call — analyst relationships attach to a person, not a brand handle.
            </div>
          </div>
        </section>

        {/* ── Phase 5 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="05" kicker="Channel" title="LinkedIn campaign" owner="Larry"
            desc="Drops directly after the pre-launch briefings, so every name captured in phases 3 and 4 has already agreed to engage. Cadence: at least one short video every three to four days." />
          <div style={{ marginTop: 22 }}>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <a href={content.teaser.url} target="_blank" rel="noopener noreferrer"
                style={{ background: C.dark, borderRadius: 10, padding: '20px 22px', textDecoration: 'none', color: C.white, display: 'block' }}>
                <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mint }}>{content.teaser.k}</span>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.4px', marginTop: 6 }}>{content.teaser.t}</div>
                <div style={{ fontFamily: MONO, fontSize: 12.5, color: 'rgba(255,255,255,0.55)', marginTop: 9, wordBreak: 'break-all', lineHeight: 1.4 }}>{content.teaser.display}</div>
                <span style={{ display: 'inline-block', fontFamily: MONO, fontSize: 12, fontWeight: 500, color: C.dark, background: C.mint, borderRadius: 5, padding: '5px 12px', marginTop: 13 }}>Open the teaser →</span>
              </a>
              <Field label="Launch post — draft" fieldKey="p5_post" rows={7} value={F('p5_post')} onSave={saveField}
                placeholder="Open with the catchphrase from phase 1, verbatim. One idea per post. Close on the teaser." />
            </div>

            {/* Review panel */}
            <div style={{ ...card, marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 15 }}>
                <h4 style={{ fontSize: 20, fontWeight: 500, letterSpacing: '-0.35px' }}>Review before it goes out</h4>
                <p style={{ fontSize: 15, color: C.grayMid, flex: 1, minWidth: 260 }}>
                  Paste the finished post here for the team to read before anyone hits publish. Nothing ships until this reads Approved.
                </p>
                <ChoicePills value={F('p5_status')} onChange={v => saveField('p5_status', v)}
                  options={[{ value: 'draft', label: 'Draft' }, { value: 'review', label: 'In review' }, { value: 'approved', label: 'Approved' }]} />
              </div>
              <Field label="Post content for review" fieldKey="p5_review" rows={8} value={F('p5_review')} onSave={saveField}
                placeholder="The exact copy that will be published — hook, body, link, hashtags. Written as it will appear." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <Field label="Reviewers" fieldKey="p5_reviewers" value={F('p5_reviewers')} onSave={saveField} placeholder="Who has read it — Larry, Doug, Brian…" />
                <Field label="Publish date and time" type="datetime-local" fieldKey="p5_publish" value={F('p5_publish')} onSave={saveField} />
              </div>
              <div style={{ marginTop: 14 }}>
                <Field label="Review comments and changes requested" fieldKey="p5_comments" rows={3} value={F('p5_comments')} onSave={saveField}
                  placeholder="What needs to change before this is approved." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 16 }}>
              {content.formats.map(f => (
                <div key={f.h} style={card}>
                  <span style={kLabel}>{f.k}</span>
                  <h4 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', marginBottom: 4 }}>{f.h}</h4>
                  <p style={{ fontSize: 15.5, color: C.grayMid }}>{f.p}</p>
                </div>
              ))}
            </div>

            <p style={{ ...eyebrow, marginTop: 30 }}>Other demo ideas for this blitz</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
              {content.ideas.map(i => (
                <div key={i.t} style={{ background: i.muted ? C.bgMed : C.white, border: `1px ${i.muted ? 'dashed' : 'solid'} ${C.border}`, borderRadius: 9, padding: '15px 17px' }}>
                  <p style={{ fontFamily: MONO, fontSize: 11, fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.grayLight, marginBottom: 6 }}>{i.k}</p>
                  <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: '-0.2px' }}>{i.t}</div>
                  <div style={{ fontSize: 14.5, color: C.grayMid, marginTop: 6, lineHeight: 1.4 }}>{i.d}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <Field label="Additional post ideas and sequencing" fieldKey="p5_ideas" rows={3} value={F('p5_ideas')} onSave={saveField}
                placeholder="Which idea runs first, second, third — and who narrates each." />
            </div>
          </div>
        </section>

        {/* ── Phase 6 ── */}
        <section style={{ marginTop: 44 }}>
          <PhaseHead num="06" kicker="Proof" title="Implementation showcase" owner="Brian · Doug"
            desc="A real partner or client implementation, worked through on camera. Record it, clip it, push it out — the live audience is secondary. Target one recorded session per month." />
          <div style={{ marginTop: 22 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {content.showcase.map(s => (
                <div key={s.h} style={card}>
                  <span style={kLabel}>{s.k}</span>
                  <h4 style={{ fontSize: 18, fontWeight: 500, letterSpacing: '-0.3px', marginBottom: 4 }}>{s.h}</h4>
                  <p style={{ fontSize: 15.5, color: C.grayMid }}>{s.p}</p>
                </div>
              ))}
            </div>

            <p style={{ ...eyebrow, marginTop: 30 }}>Interview subject</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
              {content.interviewees.map(p => {
                const on = F('p6_who') === p.value
                return (
                  <button key={p.value} onClick={() => saveField('p6_who', on ? '' : p.value)}
                    style={{
                      textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
                      background: on ? C.mintSoft : C.white,
                      border: `1px solid ${on ? C.mint : C.border}`,
                      borderRadius: 10, padding: '17px 19px',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ flex: '0 0 17px', width: 17, height: 17, borderRadius: '50%', border: `2px solid ${on ? C.mint : C.border}`, position: 'relative', display: 'inline-block' }}>
                        {on && <span style={{ position: 'absolute', inset: 3, borderRadius: '50%', background: C.mint }} />}
                      </span>
                      <span>
                        <span style={{ display: 'block', fontSize: 19, fontWeight: 500, letterSpacing: '-0.3px' }}>{p.name}</span>
                        <span style={{ display: 'block', fontFamily: MONO, fontSize: 12, color: C.grayLight }}>{p.who}</span>
                      </span>
                    </div>
                    <p style={{ fontSize: 14.5, color: C.grayMid, marginTop: 9, lineHeight: 1.4 }}>{p.d}</p>
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: 14, marginTop: 16 }}>
              <Field label="Session date and time" type="datetime-local" fieldKey="p6_dt" value={F('p6_dt')} onSave={saveField} />
              <Field label="Who will share the LinkedIn posts" fieldKey="p6_who_share" value={F('p6_who_share')} onSave={saveField}
                placeholder="Names from the partner and customer side who agreed to post" />
            </div>
            <div style={{ marginTop: 14 }}>
              <Field label="Showcase notes — angle, consent status, clip plan" fieldKey="p6_notes" rows={3} value={F('p6_notes')} onSave={saveField}
                placeholder="Which implementation, who is on camera, what gets clipped afterwards." />
            </div>
          </div>
        </section>

        {/* ── Announcements ── */}
        <div style={{ background: C.dark, borderRadius: 12, padding: '26px 30px', marginTop: 44 }}>
          <p style={{ fontFamily: MONO, fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.mint }}>Runs alongside the blitz</p>
          <h3 style={{ color: C.white, fontSize: 25, fontWeight: 400, letterSpacing: '-0.5px', marginTop: 6 }}>Press and partner announcements</h3>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${content.announcements.length}, 1fr)`, marginTop: 20 }}>
            {content.announcements.map((a, i) => (
              <div key={a.n} style={{ padding: '0 20px', borderRight: i === content.announcements.length - 1 ? 'none' : '1px solid #383838', ...(i === 0 ? { paddingLeft: 0 } : {}) }}>
                <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 500, color: C.mint }}>{a.n}</div>
                <div style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.78)', marginTop: 5, lineHeight: 1.38 }}>{a.d}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.grayLight }}>{content.sources}</span>
          <span style={{ fontFamily: MONO, fontSize: 12.5, color: C.grayLight }}>Everything on this page saves to the roadmap database</span>
        </div>
      </div>

      {/* ── Save indicator ── */}
      {status !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 40,
          fontFamily: MONO, fontSize: 12, fontWeight: 500,
          padding: '8px 14px', borderRadius: 999,
          background: status === 'error' ? '#FDECEC' : C.dark,
          color: status === 'error' ? '#8A1F1F' : C.mint,
          border: `1px solid ${status === 'error' ? '#F5B5B5' : '#383838'}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        }}>
          {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save failed — retry or reload'}
        </div>
      )}
    </div>
  )
}
