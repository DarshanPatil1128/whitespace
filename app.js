(() => {
  const { $, $$, fmt, esc } = Kit;

  const PRODUCTS = [
    { key: 'data_platform', name: 'Data platform', short: 'Data', price: 250000 },
    { key: 'ai_assistants', name: 'AI assistants', short: 'AI', price: 180000 },
    { key: 'automation', name: 'Automation', short: 'Auto', price: 150000 },
    { key: 'security', name: 'Security', short: 'Sec', price: 200000 },
    { key: 'hybrid_cloud', name: 'Hybrid cloud', short: 'Cloud', price: 300000 },
    { key: 'observability', name: 'Observability', short: 'Obs', price: 120000 },
  ];

  // ───────── Sample data (fictional) ─────────
  function sampleAccounts() {
    const r = Kit.rng(2026);
    const base = {
      Healthcare: [0.55, 0.3, 0.45, 0.7, 0.35, 0.25],
      'Financial Services': [0.65, 0.45, 0.55, 0.8, 0.5, 0.45],
      'Public Sector': [0.35, 0.15, 0.4, 0.6, 0.3, 0.2],
      Retail: [0.5, 0.4, 0.35, 0.4, 0.45, 0.4],
      Manufacturing: [0.4, 0.25, 0.6, 0.45, 0.4, 0.35],
      Energy: [0.45, 0.2, 0.45, 0.55, 0.35, 0.3],
    };
    const names = {
      Healthcare: ['Halcyon Health', 'Willow Health System', 'Bayview Medical', 'Cedar Ridge Hospital', 'Lumen Pharma', 'Larkspur Pharma', 'Northgate Clinics', 'Meadowbrook Labs'],
      'Financial Services': ['Granite Mutual', 'Meridian Bank', 'Sterling Credit Union', 'Quarry Lane Capital', 'Summit Insurance', 'Harborline Insurance', 'Fairmont Trust'],
      'Public Sector': ['Pinecrest County', 'Redwood State Agency', 'Riverbend University', 'Lakeshore Transit', 'Eastfield School District', 'Port of Calloway'],
      Retail: ['Orchard Retail', 'Evergreen Foods', 'Marigold Apparel', 'Brightcart', 'Juniper Home', 'Tidewater Grocers'],
      Manufacturing: ['Ironwood Manufacturing', 'Atlas Freight', 'Bluefin Logistics', 'Forge & Fulton', 'Vantage Components', 'Kestrel Aerospace', 'Cobalt Industrial'],
      Energy: ['Keystone Energy', 'Copperline Utilities', 'Solace Renewables', 'Northfield Power', 'Gulfway Petroleum', 'Prairie Wind Co-op'],
    };
    const rows = [];
    Object.entries(names).forEach(([ind, list]) => list.forEach((account) => {
      const b = base[ind];
      const own = [];
      own[0] = r() < b[0];
      own[1] = r() < Math.min(0.95, b[1] * (own[0] ? 1.7 : 0.45));
      own[2] = r() < Math.min(0.95, b[2] * (own[1] ? 1.3 : 0.9));
      own[3] = r() < b[3];
      own[4] = r() < b[4];
      own[5] = r() < Math.min(0.95, b[5] * (own[4] ? 1.8 : 0.5));
      const row = {
        account, industry: ind, region: r.pick(['East', 'Central', 'West']),
        employees: Math.round(Math.exp(7.5 + r() * 3.2) / 10) * 10,
        engagement: Math.round(20 + r() * 78),
        last_touch_days: Math.round(Math.abs(r.normal()) * 45 + 2),
      };
      PRODUCTS.forEach((p, i) => (row[p.key] = own[i] ? 1 : 0));
      rows.push(row);
    }));
    return rows;
  }

  let raw = sampleAccounts();
  let rowLimit = 15;

  Kit.bindOutputs(document, { minScore: (v) => v, wPeer: (v) => v, wAff: (v) => v, wFit: (v) => v, wEng: (v) => v });

  function normalize(rows) {
    return rows.map((d) => ({
      account: d.account || d.name || 'Unnamed',
      industry: d.industry || 'Other',
      region: d.region || '—',
      employees: Number(String(d.employees).replace(/,/g, '')) || 0,
      engagement: Math.max(0, Math.min(100, Number(d.engagement) || 0)),
      days: Number(d.last_touch_days) || 0,
      owns: PRODUCTS.map((p) => ['1', 'true', 'yes', 'y'].includes(String(d[p.key]).toLowerCase()) || d[p.key] === 1),
    }));
  }

  function fillFilters(accts) {
    const opts = (vals) => '<option value="">All</option>' + [...new Set(vals)].sort().map((v) => `<option>${esc(v)}</option>`).join('');
    $('#fInd').innerHTML = opts(accts.map((a) => a.industry));
    $('#fReg').innerHTML = opts(accts.map((a) => a.region));
  }

  // ───────── Scoring ─────────
  function score(accts) {
    const W = ['wPeer', 'wAff', 'wFit', 'wEng'].map((id) => Number($('#' + id).value));
    const wSum = W.reduce((a, b) => a + b, 0) || 1;
    const w = W.map((x) => x / wSum);
    const N = accts.length;
    const own = PRODUCTS.map((_, j) => accts.filter((a) => a.owns[j]).length);
    // lift[i][j] = P(j | i) / P(j)
    const lift = PRODUCTS.map((_, i) => PRODUCTS.map((_, j) => {
      if (i === j || !own[i] || !own[j]) return null;
      const both = accts.filter((a) => a.owns[i] && a.owns[j]).length;
      return (both / own[i]) / (own[j] / N);
    }));
    const logs = accts.map((a) => Math.log10(Math.max(10, a.employees)));
    const lmin = Math.min(...logs), lmax = Math.max(...logs);

    const plays = [];
    accts.forEach((a, ai) => {
      const peers = accts.filter((b) => b !== a && b.industry === a.industry);
      a.cells = PRODUCTS.map((p, j) => {
        if (a.owns[j]) return { owned: true };
        const peer = peers.length ? peers.filter((b) => b.owns[j]).length / peers.length : own[j] / N;
        let best = null;
        a.owns.forEach((o, i) => { if (o && lift[i][j] != null && (!best || lift[i][j] > best.lift)) best = { i, lift: lift[i][j] }; });
        const aff = best ? Math.max(0, Math.min(1, (best.lift - 0.8) / 1.2)) : 0;
        const fit = lmax > lmin ? (logs[ai] - lmin) / (lmax - lmin) : 0.5;
        const recency = Math.exp(-a.days / 90);
        const eng = (a.engagement / 100) * recency;
        const s = w[0] * peer + w[1] * aff + w[2] * fit + w[3] * eng;
        const size = p.price * Math.max(0.35, Math.min(2.5, Math.sqrt(a.employees / 5000)));
        const reasons = [];
        if (peers.length) reasons.push(`${Math.round(peer * 100)}% of ${a.industry} peers own it`);
        if (best && best.lift >= 1.15) reasons.push(`Owns ${PRODUCTS[best.i].name} — buyers are ${best.lift.toFixed(1)}× likelier to have ${p.name}`);
        reasons.push(a.days <= 14 ? `Touched ${a.days} days ago, engagement ${a.engagement}` : a.days > 60 ? `Cold: last touch ${a.days} days ago` : `Engagement ${a.engagement}, last touch ${a.days} days ago`);
        const cell = { score: s, size, value: 0, reasons, peer, aff, fit, eng };
        plays.push({ a, p, ...cell });
        return cell;
      });
    });
    // Rescale raw scores to 0–100 across all open plays so thresholds are meaningful
    const raws = plays.map((x) => x.score);
    const lo = Math.min(...raws), hi = Math.max(...raws);
    plays.forEach((x) => {
      const c = x.a.cells[PRODUCTS.indexOf(x.p)];
      c.score = x.score = hi > lo ? Math.round((100 * (x.score - lo)) / (hi - lo)) : 50;
      c.value = x.value = (x.score / 100) * x.size;
    });
    accts.forEach((a) => (a.priority = a.cells.reduce((t, c) => t + (c.owned ? 0 : c.value), 0)));
    return { plays, lift, own };
  }

  // ───────── Render ─────────
  function render() {
    const all = normalize(raw);
    const fi = $('#fInd').value, fr = $('#fReg').value, minS = Number($('#minScore').value);
    const { plays, lift, own } = score(all); // score on the full base so peers/lift stay stable
    const inView = (a) => (!fi || a.industry === fi) && (!fr || a.region === fr);
    const accts = all.filter(inView);
    const open = plays.filter((x) => inView(x.a) && x.score >= minS).sort((x, y) => y.value - x.value);

    const total = open.reduce((t, x) => t + x.size, 0);
    $('#kVal').textContent = fmt.compact(total);
    $('#kValHint').textContent = `list value across ${accts.length} accounts`;
    $('#kPlays').textContent = fmt.num(open.length);
    $('#kPlaysHint').textContent = `${fmt.compact(open.reduce((t, x) => t + x.value, 0))} propensity-weighted`;
    $('#kHigh').textContent = fmt.num(open.filter((x) => x.score >= 70).length);
    const depth = accts.reduce((t, a) => t + a.owns.filter(Boolean).length, 0) / Math.max(1, accts.length);
    $('#kDepth').textContent = depth.toFixed(1);
    $('#kDepthHint').textContent = `of ${PRODUCTS.length} products`;

    $('#plays').innerHTML = open.slice(0, 9).map((x) => `
      <article class="play">
        <div class="play__top"><span class="play__acct">${esc(x.a.account)}</span><span class="play__size">${fmt.compact(x.size)}</span></div>
        <div class="play__meta">${esc(x.a.industry)} · ${esc(x.a.region)} · ${fmt.num(x.a.employees)} employees</div>
        <div class="play__prod">Pitch <b>${esc(x.p.name)}</b></div>
        <div class="play__score"><span>Score ${x.score}</span><span class="meter"><span style="width:${x.score}%"></span></span></div>
        <ul>${x.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </article>`).join('') || '<p class="plays__empty">No plays match these filters.</p>';

    // Map
    const css = getComputedStyle(document.documentElement);
    const cold = css.getPropertyValue('--cold').trim(), hot = css.getPropertyValue('--hot').trim(), owned = css.getPropertyValue('--owned').trim();
    const rows = [...accts].sort((a, b) => b.priority - a.priority).slice(0, rowLimit);
    Kit.mount('#map', (w) => Kit.svg.heatmap({
      w, rows: rows.map((a) => a.account), cols: PRODUCTS.map((p) => (w < 620 ? p.short : p.name)), labelW: w < 620 ? 130 : 180, cellH: 32,
      cell: (i, j) => {
        const c = rows[i].cells[j];
        if (c.owned) return { color: owned, text: '✓', textColor: 'var(--muted)', tip: `${rows[i].account} already owns ${PRODUCTS[j].name}` };
        const t = c.score / 100;
        const dim = c.score < minS;
        return {
          color: Kit.mix(cold, hot, Math.pow(t, 1.3) * 1.15), text: dim ? '' : String(c.score), textColor: t > 0.55 ? '#fff' : 'var(--text)',
          tip: `${rows[i].account} → ${PRODUCTS[j].name}\nScore ${c.score} · est. ${fmt.compact(c.size)}\n• ${c.reasons.join('\n• ')}`,
        };
      },
    }));

    // Lift matrix
    Kit.mount('#lift', (w) => Kit.svg.heatmap({
      w, rows: PRODUCTS.map((p) => p.name), cols: PRODUCTS.map((p) => p.short), labelW: 110, cellH: 30,
      cell: (i, j) => {
        if (i === j) return { color: 'transparent' };
        const l = lift[i][j];
        if (l == null) return { color: owned, text: '–' };
        const t = Math.max(0, Math.min(1, (l - 0.6) / 1.4));
        return { color: Kit.mix(cold, hot, t), text: l.toFixed(1) + '×', textColor: t > 0.55 ? '#fff' : 'var(--text)', tip: `Owners of ${PRODUCTS[i].name} are ${l.toFixed(2)}× as likely to own ${PRODUCTS[j].name}\n(${own[i]} owners of ${PRODUCTS[i].name})` };
      },
    }));

    const byP = PRODUCTS.map((p) => {
      const ps = open.filter((x) => x.p === p);
      return { label: p.name, value: ps.reduce((t, x) => t + x.value, 0), color: 'var(--c4)', tip: `${p.name}: ${ps.length} plays\n${fmt.compact(ps.reduce((t, x) => t + x.size, 0))} list · ${fmt.compact(ps.reduce((t, x) => t + x.value, 0))} weighted` };
    }).sort((a, b) => b.value - a.value);
    Kit.mount('#byProduct', (w) => Kit.svg.hbars({ w, items: byP, fmt: fmt.compact, labelW: 110 }));

    render.open = open;
  }

  // ───────── Events ─────────
  const rerender = Kit.debounce(render, 60);
  $$('#controls input, #controls select').forEach((el) => el.addEventListener('input', rerender));
  $$('#rowsSeg button').forEach((b) => b.addEventListener('click', () => {
    $$('#rowsSeg button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    rowLimit = Number(b.dataset.v);
    render();
  }));
  $('#export').addEventListener('click', () => {
    const rows = render.open.map((x, i) => ({
      rank: i + 1, account: x.a.account, industry: x.a.industry, region: x.a.region, product: x.p.name,
      score: x.score, est_deal_size: Math.round(x.size), weighted_value: Math.round(x.value), reasons: x.reasons.join('; '),
    }));
    Kit.csv.download('whitespace-plays.csv', Kit.csv.stringify(rows));
  });
  $('#dlSample').addEventListener('click', () => Kit.csv.download('whitespace-sample-accounts.csv', Kit.csv.stringify(sampleAccounts())));
  $('#file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const rows = Kit.csv.parse(await Kit.csv.readFile(f));
      if (!rows.length || !('account' in rows[0]) || !PRODUCTS.some((p) => p.key in rows[0])) throw new Error('columns');
      raw = rows;
      fillFilters(normalize(raw));
      $('#dataNote').textContent = `Loaded ${f.name} · ${rows.length} accounts`;
      render();
      Kit.toast('Accounts loaded');
    } catch {
      Kit.toast('Couldn’t read that file — check the columns in “Scoring model”.');
    }
    e.target.value = '';
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);

  fillFilters(normalize(raw));
  render();
})();
