import { useEffect, useRef } from 'react'
import { api } from '@/lib/api'

// ── Port of the live Support Ticket Dashboard artifact ─────────────────
//
// Same JQL queries, same processing, same render. Two differences:
//   1. Data comes from /api/jira/search (Flask → Jira) instead of an MCP.
//   2. Chart.js loads dynamically when the page mounts.
//
// All rendering is innerHTML on a ref'd div — porting the artifact's
// vanilla-JS structure as-is is much smaller than rewriting it as JSX.

const JIRA_URL   = 'https://viax.atlassian.net/browse/'
const START_DATE = '2025-01-01'

const CLIENTS = {
  AUT: 'AutoTrust', BS: 'BSCI', CIN: 'Cintas', RS: 'ReOps',
  SS: 'Solventum', TOUS: '2U/EdX', WIL: 'WileyAS', WS: 'Wiley',
}
const KEYS   = Object.keys(CLIENTS)
const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444', '#22c55e', '#64748b']

const CHART_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js'

function loadChartJs() {
  return new Promise((resolve, reject) => {
    if (window.Chart) return resolve(window.Chart)
    const existing = document.querySelector(`script[src="${CHART_CDN}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Chart))
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.src = CHART_CDN
    s.async = true
    s.onload  = () => resolve(window.Chart)
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function SupportPage() {
  const rootRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const root = rootRef.current
    if (!root) return

    // ── UI helpers ─────────────────────────────────────────────────────
    const $  = (id) => root.querySelector('#' + id)
    const setSub  = (msg) => { const e = $('load-sub'); if (e) e.textContent = msg }
    const setProg = (pct) => { const e = $('prog');     if (e) e.style.width = pct + '%' }

    function initChecklist() {
      const el = $('checklist'); if (!el) return
      el.innerHTML = KEYS.map((k) => (
        `<div id="chk-${k}" class="chk-row">
           <span class="chk-icon" id="chi-${k}">⬜</span>
           <span id="chl-${k}">${CLIENTS[k]}</span>
         </div>`
      )).join('')
    }
    function chkActive(k) {
      const r = $(`chk-${k}`); if (r) r.className = 'chk-row active'
      const i = $(`chi-${k}`); if (i) i.textContent = '⏳'
    }
    function chkDone(k, n) {
      const r = $(`chk-${k}`); if (r) r.className = 'chk-row done'
      const i = $(`chi-${k}`); if (i) i.textContent = '✅'
      const l = $(`chl-${k}`); if (l) l.textContent = `${CLIENTS[k]} (${n})`
    }
    function chkTick(k, n) {
      const l = $(`chl-${k}`); if (l) l.textContent = `${CLIENTS[k]} — ${n}…`
    }

    // ── API helpers ────────────────────────────────────────────────────
    function getIssues(r) {
      if (!r) return []
      if (Array.isArray(r.issues))        return r.issues
      if (Array.isArray(r.issues?.nodes)) return r.issues.nodes
      if (Array.isArray(r.nodes))         return r.nodes
      if (Array.isArray(r))               return r
      return []
    }
    function getNext(r) {
      return r?.issues?.nextPageToken ?? r?.nextPageToken ?? null
    }

    // ── Fetch phase 1 — per-project, no comments ───────────────────────
    async function fetchProject(key) {
      let all = [], token = null, page = 0
      do {
        const params = {
          maxResults: 100,
          fields: ['summary', 'status', 'priority', 'created', 'resolutiondate', 'project'],
          jql: `project = ${key} AND issuetype not in (Subtask,"Sub-task") AND created >= "${START_DATE}" ORDER BY created DESC`,
        }
        if (token) params.nextPageToken = token
        const raw = await api.jira.search(params)
        const nodes = getIssues(raw)
        all = all.concat(nodes)
        token = getNext(raw)
        page++
        if (token) chkTick(key, all.length)
      } while (token && page < 5)
      return all
    }

    async function fetchPhase1() {
      initChecklist()
      let all = []
      for (let i = 0; i < KEYS.length; i++) {
        if (cancelled) return all
        const k = KEYS[i]
        chkActive(k)
        setSub(`Fetching ${CLIENTS[k]}… (${i + 1} of ${KEYS.length})`)
        setProg(Math.round((i / KEYS.length) * 85))
        const issues = await fetchProject(k)
        chkDone(k, issues.length)
        all = all.concat(issues)
      }
      setProg(95)
      setSub('Building dashboard…')
      return all
    }

    // ── Fetch phase 2 — resolved tickets with comments ─────────────────
    async function fetchPhase2() {
      let all = [], token = null, page = 0
      do {
        const params = {
          maxResults: 50,
          fields: ['created', 'project', 'comment'],
          jql: `project in (${KEYS.join(',')}) AND issuetype not in (Subtask,"Sub-task") AND created >= "${START_DATE}" AND status in (Done,Closed,Resolved) ORDER BY updated DESC`,
        }
        if (token) params.nextPageToken = token
        const raw = await api.jira.search(params)
        all = all.concat(getIssues(raw))
        token = getNext(raw)
        page++
      } while (token && page < 3)
      return all
    }

    // ── Processing ─────────────────────────────────────────────────────
    const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    function processPhase1(issues) {
      const clients = {}, volMap = {}, resMap = {}, urgentOpen = []
      for (const issue of issues) {
        const f = issue.fields; if (!f) continue
        const k = f.project?.key; if (!k || !CLIENTS[k]) continue
        if (!clients[k]) clients[k] = {
          name: CLIENTS[k], key: k, total: 0, open: 0, done: 0,
          pri: { Highest: 0, High: 0, Medium: 0, Low: 0 },
          resTimes: [], respTimes: [],
        }
        const c = clients[k]; c.total++
        const isDone = (f.status?.statusCategory?.key === 'done') ||
          ['Done', 'Closed', 'Resolved', 'Complete'].includes(f.status?.name ?? '')
        isDone ? c.done++ : c.open++
        const p = f.priority?.name; if (p && p in c.pri) c.pri[p]++
        if (f.resolutiondate && f.created) {
          const d = (new Date(f.resolutiondate) - new Date(f.created)) / 86400000
          if (d >= 0) {
            c.resTimes.push(d)
            const m = mk(new Date(f.resolutiondate))
            if (!resMap[m]) resMap[m] = []
            resMap[m].push(d)
          }
        }
        if (!isDone && (p === 'Highest' || p === 'High') && issue.key) {
          const age = f.created ? Math.floor((Date.now() - new Date(f.created)) / 86400000) : 0
          urgentOpen.push({
            key: issue.key, summary: f.summary || '', priority: p,
            client: CLIENTS[k], url: JIRA_URL + issue.key, age,
          })
        }
        if (f.created) {
          const m = mk(new Date(f.created))
          if (!volMap[m]) volMap[m] = {}
          volMap[m][k] = (volMap[m][k] || 0) + 1
        }
      }
      urgentOpen.sort((a, b) => a.priority === b.priority ? b.age - a.age : a.priority === 'Highest' ? -1 : 1)
      return { clients, volMap, resMap, urgentOpen, respMap: {} }
    }

    function applyPhase2(respIssues, clients, respMap) {
      for (const issue of respIssues) {
        const f = issue.fields; if (!f) continue
        const k = f.project?.key; if (!k || !CLIENTS[k] || !f.created) continue
        const cmts = f.comment?.comments ?? []; if (!cmts.length) continue
        const h = (new Date(cmts[0].created) - new Date(f.created)) / 3600000
        if (h < 0) continue
        if (clients[k]) clients[k].respTimes.push(h)
        const m = mk(new Date(f.created))
        if (!respMap[m])      respMap[m] = {}
        if (!respMap[m][k])   respMap[m][k] = []
        respMap[m][k].push(h)
      }
    }

    function allMonths() {
      const out = [], now = new Date(), cur = new Date(2025, 0, 1)
      while (cur <= now) { out.push(mk(cur)); cur.setMonth(cur.getMonth() + 1) }
      return out
    }
    function mlabel(m) {
      const [y, mo] = m.split('-')
      return new Date(y, mo - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    }

    // ── Format helpers ─────────────────────────────────────────────────
    function fmtD(days, html = true) {
      if (days === null) return html ? '<span class="na">—</span>' : '—'
      let s, c
      if (days < 1)       { s = `${Math.round(days * 24)}h`; c = 'g' }
      else if (days < 5)  { s = `${days.toFixed(1)}d`;       c = 'g' }
      else if (days < 14) { s = `${days.toFixed(1)}d`;       c = 'w' }
      else                { s = `${days.toFixed(1)}d`;       c = 'r' }
      return html ? `<span class="${c}">${s}</span>` : s
    }
    function fmtH(h, html = true) {
      if (h === null) return html ? '<span class="na">—</span>' : '—'
      let s, c
      if (h < 1)       { s = `${Math.round(h * 60)}m`;        c = 'g' }
      else if (h < 4)  { s = `${h.toFixed(1)}h`;              c = 'g' }
      else if (h < 24) { s = `${h.toFixed(1)}h`;              c = 'w' }
      else             { s = `${(h / 24).toFixed(1)}d`;       c = 'r' }
      return html ? `<span class="${c}">${s}</span>` : s
    }
    const bdg = (n, cls) => n ? `<span class="b ${cls}">${n}</span>` : '<span class="b-nil">—</span>'

    // ── Render functions ───────────────────────────────────────────────
    function renderCards(clients) {
      const all = Object.values(clients)
      const tot = all.reduce((s, c) => s + c.total, 0)
      const op  = all.reduce((s, c) => s + c.open,  0)
      const dn  = all.reduce((s, c) => s + c.done,  0)
      const ap = { Highest: 0, High: 0, Medium: 0, Low: 0 }
      all.forEach((c) => Object.keys(ap).forEach((p) => ap[p] += c.pri[p] || 0))
      const aRes  = avg(all.flatMap((c) => c.resTimes))
      const aResp = avg(all.flatMap((c) => c.respTimes))
      const pcls = { Highest: 'p-highest', High: 'p-high', Medium: 'p-medium', Low: 'p-low' }
      const pills = Object.keys(ap).filter((p) => ap[p] > 0)
        .map((p) => `<span class="pill ${pcls[p]}">${p} ${ap[p]}</span>`).join('')
      return `
        <div id="summaryCards">
          <div class="cards">
            <div class="card dark"><div class="lbl">Open Tickets</div><div class="val">${op}</div><div class="sub">of ${tot} total · ${all.length} clients</div></div>
            <div class="card"><div class="lbl">Resolved</div><div class="val">${dn}</div><div class="sub">closed tickets</div></div>
            <div class="card"><div class="lbl">Avg First Response</div><div class="val" style="font-size:24px;margin-top:2px">${fmtH(aResp, false)}</div><div class="sub">time to first comment</div></div>
            <div class="card"><div class="lbl">Avg Resolution</div><div class="val" style="font-size:24px;margin-top:2px">${fmtD(aRes, false)}</div><div class="sub">for closed tickets</div></div>
          </div>
          <div class="pills-card"><div class="lbl">Priority Breakdown — All Clients</div><div class="pills">${pills || '<span class="na">No data</span>'}</div></div>
        </div>`
    }

    function renderUrgent(urgentOpen) {
      if (!urgentOpen.length) return ''
      const hi = urgentOpen.filter((t) => t.priority === 'Highest').length
      const h  = urgentOpen.filter((t) => t.priority === 'High').length
      const sub = [hi ? `${hi} Highest` : '', h ? `${h} High` : ''].filter(Boolean).join(' · ')
      const rows = urgentOpen.map((t) => {
        const ageCls = t.age >= 14 ? 'bad' : t.age >= 7 ? 'warn' : ''
        const ageStr = t.age === 0 ? 'Today' : t.age === 1 ? '1d' : `${t.age}d`
        const priCls = t.priority === 'Highest' ? 'b-hi' : 'b-h'
        return `<tr>
          <td><span class="b ${priCls}">${t.priority}</span></td>
          <td><a class="tkt-link" href="${t.url}" target="_blank" rel="noopener">${t.key} ↗</a></td>
          <td><span class="tkt-summary" title="${t.summary.replace(/"/g, '&quot;')}">${t.summary}</span></td>
          <td><span class="b b-op" style="font-size:11px">${t.client}</span></td>
          <td><span class="age ${ageCls}">${ageStr} open</span></td>
        </tr>`
      }).join('')
      return `<div class="section urgent">
        <div class="sec-head"><h2><span class="u-count">${urgentOpen.length}</span>Open High-Priority Tickets</h2><p>${sub} · oldest first within priority</p></div>
        <table><thead><tr><th>Priority</th><th>Ticket</th><th>Summary</th><th>Client</th><th>Age</th></tr></thead><tbody>${rows}</tbody></table>
      </div>`
    }

    function renderVolChart() {
      return `<div class="section"><div class="sec-head"><h2>Tickets Opened by Month</h2><p>Jan 2025 – present · stacked by client</p></div><div class="chart-wrap"><canvas id="volChart"></canvas></div></div>`
    }
    function renderResChart() {
      return `<div class="section"><div class="sec-head"><h2>Avg Resolution Time by Month</h2><p>Days to close · <span style="color:#22c55e">■</span> &lt;5d · <span style="color:#f59e0b">■</span> &lt;14d · <span style="color:#ef4444">■</span> ≥14d</p></div><div class="chart-wrap"><canvas id="resChart"></canvas></div></div>`
    }

    function drawResChart(resMap) {
      const months = allMonths(), labels = months.map(mlabel)
      const data = months.map((m) => { const v = resMap[m]; return v?.length ? parseFloat(avg(v).toFixed(2)) : null })
      const bgColors = data.map((v) => v === null ? 'rgba(0,0,0,0)' : v < 5 ? '#22c55e' : v < 14 ? '#f59e0b' : '#ef4444')
      const ctx = root.querySelector('#resChart'); if (!ctx || !window.Chart) return
      new window.Chart(ctx, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Avg Resolution (days)', data, backgroundColor: bgColors, borderRadius: 4, borderSkipped: false }] },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => c.raw !== null ? `${c.raw.toFixed(1)}d avg` : 'No data' } } },
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
            y: { grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8' }, title: { display: true, text: 'Days', font: { size: 11 }, color: '#94a3b8' } },
          },
        },
      })
    }

    function drawVolChart(volMap, clients) {
      const months = allMonths(), labels = months.map(mlabel)
      const sk = Object.keys(clients).sort((a, b) => CLIENTS[a].localeCompare(CLIENTS[b]))
      const datasets = sk.map((k, i) => ({
        label: CLIENTS[k],
        data: months.map((m) => (volMap[m] || {})[k] || 0),
        backgroundColor: COLORS[i % COLORS.length],
        borderRadius: 3, borderSkipped: false,
      }))
      const ctx = root.querySelector('#volChart'); if (!ctx || !window.Chart) return
      new window.Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 12, font: { size: 11 } } }, tooltip: { mode: 'index', intersect: false } },
          scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
            y: { stacked: true, grid: { color: '#f1f5f9' }, ticks: { font: { size: 11 }, color: '#94a3b8' } },
          },
        },
      })
    }

    function renderHeatmap(respMap, clients) {
      const months = allMonths(), labels = months.map(mlabel)
      const sk = Object.keys(clients).sort((a, b) => CLIENTS[a].localeCompare(CLIENTS[b]))
      function hc(h) {
        if (h === null) return null
        if (h < 4)  return { bg: '#dcfce7', fg: '#166534' }
        if (h < 12) return { bg: '#d1fae5', fg: '#065f46' }
        if (h < 24) return { bg: '#fef9c3', fg: '#854d0e' }
        if (h < 72) return { bg: '#fed7aa', fg: '#9a3412' }
        return { bg: '#fee2e2', fg: '#991b1b' }
      }
      const headRow = labels.map((l) => `<th>${l}</th>`).join('')
      const bodyRows = sk.map((k) => {
        const cells = months.map((m) => {
          const v = respMap[m]?.[k]; const h = v?.length ? avg(v) : null; const col = hc(h)
          if (!col) return `<td class="cell empty">·</td>`
          const lbl = h < 1 ? `${Math.round(h * 60)}m` : h < 24 ? `${h.toFixed(0)}h` : `${(h / 24).toFixed(1)}d`
          return `<td class="cell" style="background:${col.bg};color:${col.fg}" title="${CLIENTS[k]} · ${m}: ${lbl}">${lbl}</td>`
        }).join('')
        return `<tr><td class="rl">${CLIENTS[k]}</td>${cells}</tr>`
      }).join('')
      const legend = [
        { bg: '#dcfce7', t: '< 4h' }, { bg: '#fef9c3', t: '4–24h' },
        { bg: '#fed7aa', t: '1–3d' }, { bg: '#fee2e2', t: '> 3d' },
        { bg: '#f8fafc', t: 'No data' },
      ].map((x) => `<span><i style="background:${x.bg}"></i>${x.t}</span>`).join('')
      return `<div class="section" id="heatmapSection"><div class="sec-head"><h2>First Response Time — Client × Month</h2><p>Avg time to first comment · loads after main data</p></div>
        <div class="hm-legend">${legend}</div>
        <div class="hm-scroll"><table class="hm-table"><thead><tr><th></th>${headRow}</tr></thead><tbody>${bodyRows}</tbody></table></div></div>`
    }

    let sortCol = null, sortDir = 1
    function renderTable(clients) {
      const rows = Object.values(clients)
      if (sortCol !== null) {
        rows.sort((a, b) => {
          let av, bv
          switch (sortCol) {
            case 0: av = a.name; bv = b.name; break
            case 1: av = a.total; bv = b.total; break
            case 2: av = a.open; bv = b.open; break
            case 3: av = a.done; bv = b.done; break
            case 4: av = a.pri.Highest || 0; bv = b.pri.Highest || 0; break
            case 5: av = a.pri.High || 0; bv = b.pri.High || 0; break
            case 6: av = a.pri.Medium || 0; bv = b.pri.Medium || 0; break
            case 7: av = a.pri.Low || 0; bv = b.pri.Low || 0; break
            case 8: av = avg(a.respTimes) ?? -1; bv = avg(b.respTimes) ?? -1; break
            case 9: av = avg(a.resTimes) ?? -1; bv = avg(b.resTimes) ?? -1; break
            default: return 0
          }
          return av < bv ? -sortDir : av > bv ? sortDir : 0
        })
      } else rows.sort((a, b) => b.total - a.total)
      const rHtml = rows.map((c) => `<tr>
        <td><div class="cli-name">${c.name}</div><div class="cli-key">${c.key}</div></td>
        <td style="font-weight:600">${c.total}</td><td>${bdg(c.open, 'b-op')}</td><td>${c.done}</td>
        <td>${bdg(c.pri.Highest, 'b-hi')}</td><td>${bdg(c.pri.High, 'b-h')}</td><td>${bdg(c.pri.Medium, 'b-m')}</td><td>${bdg(c.pri.Low, 'b-l')}</td>
        <td>${fmtH(avg(c.respTimes))}</td><td>${fmtD(avg(c.resTimes))}</td>
      </tr>`).join('')
      const allC = Object.values(clients)
      const tot = {
        total: allC.reduce((s, c) => s + c.total, 0),
        open:  allC.reduce((s, c) => s + c.open,  0),
        done:  allC.reduce((s, c) => s + c.done,  0),
        pri: { Highest: 0, High: 0, Medium: 0, Low: 0 },
        resp: avg(allC.flatMap((c) => c.respTimes)),
        res:  avg(allC.flatMap((c) => c.resTimes)),
      }
      allC.forEach((c) => Object.keys(tot.pri).forEach((p) => tot.pri[p] += c.pri[p] || 0))
      const heads = ['Client', 'Total', 'Open', 'Closed', '🔴 Highest', '🟠 High', '🟡 Medium', '🟢 Low', 'Avg Response', 'Avg Resolution']
      const hHtml = heads.map((h, i) => {
        const cls = sortCol === i ? (sortDir === 1 ? 'asc' : 'desc') : ''
        return `<th class="${cls}" data-col="${i}">${h}</th>`
      }).join('')
      return `<div class="section" id="tableSection"><div class="sec-head"><h2>Per-Client Breakdown</h2><p>Click any column to sort</p></div>
        <table class="data-table" id="clientTable"><thead><tr>${hHtml}</tr></thead><tbody>${rHtml}
        <tr class="tot-row"><td><div class="cli-name">All Clients</div></td><td>${tot.total}</td><td>${bdg(tot.open, 'b-op')}</td><td>${tot.done}</td>
        <td>${bdg(tot.pri.Highest, 'b-hi')}</td><td>${bdg(tot.pri.High, 'b-h')}</td><td>${bdg(tot.pri.Medium, 'b-m')}</td><td>${bdg(tot.pri.Low, 'b-l')}</td>
        <td>${fmtH(tot.resp)}</td><td>${fmtD(tot.res)}</td></tr>
        </tbody></table></div>`
    }

    function attachSort() {
      const t = root.querySelector('#clientTable'); if (!t) return
      t.querySelectorAll('thead th[data-col]').forEach((th) => th.addEventListener('click', () => {
        const c = parseInt(th.dataset.col, 10)
        sortCol === c ? sortDir *= -1 : (sortCol = c, sortDir = 1)
        const s = root.querySelector('#tableSection')
        if (s) s.outerHTML = renderTable(state.clients)
        setTimeout(attachSort, 30)
      }))
    }

    // ── State ─────────────────────────────────────────────────────────
    const state = { clients: {}, volMap: {}, resMap: {}, respMap: {} }

    function renderAll(clients, volMap, resMap, respMap, urgentOpen, count) {
      state.clients = clients
      state.volMap  = volMap
      state.resMap  = resMap
      state.respMap = respMap
      const refreshed = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
      const app = $('app'); if (!app) return
      app.innerHTML = `
        <div class="header">
          <div><h1>Support Ticket Dashboard</h1><div class="meta">Last refreshed ${refreshed}</div></div>
          <span class="badge-count">${count} tickets</span>
        </div>
        ${renderCards(clients)}
        ${renderUrgent(urgentOpen)}
        ${renderVolChart()}
        ${renderResChart()}
        ${renderHeatmap(respMap, clients)}
        ${renderTable(clients)}`
      setTimeout(() => { drawResChart(resMap); drawVolChart(volMap, clients); attachSort() }, 80)
    }

    function refreshRespSections() {
      const h = root.querySelector('#heatmapSection')
      if (h) h.outerHTML = renderHeatmap(state.respMap, state.clients)
      const s = root.querySelector('#summaryCards')
      if (s) s.outerHTML = renderCards(state.clients)
      const t = root.querySelector('#tableSection')
      if (t) { t.outerHTML = renderTable(state.clients); setTimeout(attachSort, 30) }
    }

    // ── Init ───────────────────────────────────────────────────────────
    async function init() {
      try {
        await loadChartJs()
        if (cancelled) return
        const issues = await fetchPhase1()
        if (cancelled) return
        if (!issues.length) {
          const app = $('app'); if (app) {
            app.innerHTML = `<div style="padding:60px;text-align:center"><h3 style="color:#dc2626">No tickets found</h3><p style="color:#64748b;margin-top:8px">Check that the Jira proxy and credentials are configured.</p></div>`
          }
          return
        }
        const { clients, volMap, resMap, urgentOpen, respMap } = processPhase1(issues)
        renderAll(clients, volMap, resMap, respMap, urgentOpen, issues.length)

        try {
          const respIssues = await fetchPhase2()
          if (cancelled) return
          applyPhase2(respIssues, state.clients, state.respMap)
          refreshRespSections()
        } catch (e) { console.warn('Phase 2 failed:', e) }
      } catch (err) {
        if (cancelled) return
        console.error(err)
        const app = $('app'); if (app) {
          app.innerHTML = `<div style="padding:60px;text-align:center"><h3 style="color:#dc2626">Failed to load</h3><p style="color:#64748b;margin-top:8px">${(err && err.message) || 'Unexpected error'}</p></div>`
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="support-page" style={{ minHeight: '100vh', background: '#f8fafc', paddingTop: 70, paddingLeft: 24, paddingRight: 24, paddingBottom: 24, color: '#1e293b' }}>
      <style>{`
        .support-page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        .support-page .loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 12px; }
        .support-page .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #0f172a; border-radius: 50%; animation: support-spin .7s linear infinite; }
        @keyframes support-spin { to { transform: rotate(360deg); } }
        .support-page .loading-title { font-size: 15px; font-weight: 600; color: #1e293b; }
        .support-page .loading-sub { font-size: 13px; color: #64748b; }
        .support-page .progress-wrap { width: 280px; height: 4px; background: #e2e8f0; border-radius: 2px; overflow: hidden; }
        .support-page .progress-fill { height: 4px; background: #0f172a; border-radius: 2px; transition: width .4s ease; }
        .support-page .checklist { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 32px; margin-top: 8px; }
        .support-page .chk-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #94a3b8; }
        .support-page .chk-row.active { color: #1e293b; }
        .support-page .chk-row.done { color: #16a34a; }
        .support-page .chk-icon { font-size: 15px; width: 20px; text-align: center; }

        .support-page .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; }
        .support-page .header h1 { font-size: 20px; font-weight: 700; color: #0f172a; }
        .support-page .header .meta { font-size: 12px; color: #94a3b8; margin-top: 3px; }
        .support-page .badge-count { background: #eff6ff; color: #2563eb; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }

        .support-page .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .support-page .card { background: #fff; border-radius: 10px; padding: 18px 20px; border: 1px solid #e2e8f0; }
        .support-page .card.dark { background: #0f172a; border-color: #0f172a; }
        .support-page .card .lbl { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
        .support-page .card.dark .lbl { color: #64748b; }
        .support-page .card .val { font-size: 28px; font-weight: 700; color: #0f172a; line-height: 1; }
        .support-page .card.dark .val { color: #fff; }
        .support-page .card .sub { font-size: 11px; color: #94a3b8; margin-top: 5px; }
        .support-page .pills-card { background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; padding: 14px 20px; margin-bottom: 18px; }
        .support-page .pills { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; }
        .support-page .pill { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; }
        .support-page .p-highest { background:#fef2f2; color:#dc2626; }
        .support-page .p-high    { background:#fff7ed; color:#ea580c; }
        .support-page .p-medium  { background:#fefce8; color:#ca8a04; }
        .support-page .p-low     { background:#f0fdf4; color:#16a34a; }

        .support-page .section { background: #fff; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 18px; overflow: hidden; }
        .support-page .sec-head { padding: 14px 20px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        .support-page .sec-head h2 { font-size: 14px; font-weight: 600; color: #0f172a; }
        .support-page .sec-head p  { font-size: 12px; color: #94a3b8; }
        .support-page .chart-wrap { padding: 20px; height: 260px; }

        .support-page .urgent { border: 2px solid #fca5a5; }
        .support-page .urgent .sec-head { background: #fff7f7; border-bottom-color: #fecaca; }
        .support-page .urgent .sec-head h2 { color: #991b1b; }
        .support-page .urgent .sec-head p  { color: #ef4444; }
        .support-page .u-count { display: inline-flex; align-items: center; justify-content: center; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; margin-right: 6px; }
        .support-page .urgent table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .support-page .urgent thead th { background: #fff7f7; padding: 8px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #ef4444; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #fecaca; white-space: nowrap; }
        .support-page .urgent tbody tr { border-bottom: 1px solid #fef2f2; }
        .support-page .urgent tbody tr:last-child { border-bottom: none; }
        .support-page .urgent tbody tr:hover { background: #fff7f7; }
        .support-page .urgent tbody td { padding: 10px 14px; vertical-align: middle; }
        .support-page .tkt-link { color: #1d4ed8; font-weight: 700; font-size: 12px; text-decoration: none; white-space: nowrap; }
        .support-page .tkt-link:hover { text-decoration: underline; }
        .support-page .tkt-summary { color: #0f172a; max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
        .support-page .age { display: inline-block; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; white-space: nowrap; background: #f1f5f9; color: #475569; }
        .support-page .age.warn { background: #fef9c3; color: #854d0e; }
        .support-page .age.bad  { background: #fee2e2; color: #991b1b; }

        .support-page .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .support-page .data-table thead th { background: #f8fafc; padding: 10px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #e2e8f0; white-space: nowrap; cursor: pointer; user-select: none; }
        .support-page .data-table thead th:hover { background: #f1f5f9; }
        .support-page .data-table thead th.asc::after  { content: ' ↑'; }
        .support-page .data-table thead th.desc::after { content: ' ↓'; }
        .support-page .data-table tbody tr { border-bottom: 1px solid #f8fafc; }
        .support-page .data-table tbody tr:last-child { border-bottom: none; }
        .support-page .data-table tbody tr:hover { background: #f8fafc; }
        .support-page .data-table tbody td { padding: 11px 14px; vertical-align: middle; }
        .support-page .cli-name { font-weight: 600; color: #0f172a; }
        .support-page .cli-key  { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .support-page .tot-row td { background: #f8fafc; font-weight: 700; border-top: 2px solid #e2e8f0; }
        .support-page .b { display: inline-flex; align-items: center; justify-content: center; min-width: 24px; height: 20px; border-radius: 4px; font-size: 11px; font-weight: 700; padding: 0 5px; }
        .support-page .b-hi  { background:#fef2f2; color:#dc2626; }
        .support-page .b-h   { background:#fff7ed; color:#ea580c; }
        .support-page .b-m   { background:#fefce8; color:#ca8a04; }
        .support-page .b-l   { background:#f0fdf4; color:#16a34a; }
        .support-page .b-op  { background:#eff6ff; color:#2563eb; }
        .support-page .b-nil { color: #e2e8f0; }
        .support-page .g { color:#16a34a; font-weight:600; }
        .support-page .w { color:#ca8a04; font-weight:600; }
        .support-page .r { color:#dc2626; font-weight:600; }
        .support-page .na{ color:#cbd5e1; }

        .support-page .hm-scroll { overflow-x: auto; padding: 14px 20px 18px; }
        .support-page .hm-table { border-collapse: collapse; font-size: 11px; white-space: nowrap; }
        .support-page .hm-table th { padding: 4px 6px; font-size: 10px; font-weight: 600; color: #94a3b8; text-transform: uppercase; text-align: center; }
        .support-page .hm-table .rl { text-align: right; padding-right: 12px; font-weight: 600; color: #0f172a; font-size: 12px; white-space: nowrap; }
        .support-page .hm-table td.cell { width: 50px; height: 30px; text-align: center; border-radius: 4px; font-size: 10px; font-weight: 700; margin: 1px; }
        .support-page .hm-table td.empty { background: #f8fafc; color: #e2e8f0; }
        .support-page .hm-legend { display: flex; flex-wrap: wrap; gap: 12px; padding: 10px 20px 0; }
        .support-page .hm-legend span { display: flex; align-items: center; gap: 5px; font-size: 11px; color: #64748b; }
        .support-page .hm-legend i { display: inline-block; width: 26px; height: 14px; border-radius: 3px; }
      `}</style>

      <div ref={rootRef}>
        <div id="app">
          <div className="loading">
            <div className="spinner" />
            <div className="loading-title">Fetching tickets from Jira…</div>
            <div className="progress-wrap"><div className="progress-fill" id="prog" style={{ width: '0%' }} /></div>
            <div className="loading-sub" id="load-sub">Starting…</div>
            <div className="checklist" id="checklist" />
          </div>
        </div>
      </div>
    </div>
  )
}
