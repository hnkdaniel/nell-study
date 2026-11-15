// NELL STUDY – rozhraní
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '$1');
const plain = (s) => String(s ?? '').replace(/\*\*(.+?)\*\*/g, '$1');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' }) : '';
const fmtT = (s) => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const plural = (n, a, b, c) => n === 1 ? a : n >= 2 && n <= 4 ? b : c;
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" fill="currentColor"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>';
const BACK15 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 11-7 7" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M12 2L8.5 5 12 8" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const FWD15 = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5a7 7 0 107 7" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round"/><path d="M12 2l3.5 3L12 8" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.1 6.4 6.4 2.1-6.4 2.1L12 19.5l-2.1-6.4L3.5 11l6.4-2.1z" fill="currentColor"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9z" fill="currentColor" opacity=".8"/></svg>';
const PHOTO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="15" rx="3" stroke="currentColor" stroke-width="1.9" fill="none"/><circle cx="9" cy="10.5" r="1.8" fill="currentColor"/><path d="M4 18l5-5 4 4 3-3 4 4" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linejoin="round"/></svg>';
const COPY = '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" stroke="currentColor" stroke-width="1.9" fill="none"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.9" fill="none"/></svg>';
const DL = '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const SHUF = '<svg viewBox="0 0 24 24" class="ico" aria-hidden="true"><path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.6 0 2.7-1.6 3.6-3.5M14 10.5c.8-1.9 1.9-3.5 3.5-3.5H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5" stroke="currentColor" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function toast(msg, err) {
  const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), err ? 7000 : 3200);
}
document.addEventListener('click', (e) => { const a = e.target.closest('[data-ext]'); if (a) { e.preventDefault(); nell.openExternal(a.dataset.ext); } });

/* ---------------- Data ---------------- */
let sets = [], currentId = null, tab = 'notes', settings = {}, prog = {}, running = new Set();
const cur = () => sets.find((s) => s.id === currentId) || null;
const imgCache = new Map();
async function imgURL(id, file) {
  const k = id + '/' + file; if (imgCache.has(k)) return imgCache.get(k);
  const data = await nell.readFile(id, file); if (!data) return '';
  const u = URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })); imgCache.set(k, u); return u;
}
async function fillImgs(root = document) {
  for (const im of $$('img[data-src]', root)) { const [id, f] = im.dataset.src.split('/'); im.src = await imgURL(id, f); im.removeAttribute('data-src'); }
}
function setLocal(s) { const i = sets.findIndex((x) => x.id === s.id); if (i >= 0) sets[i] = s; else sets.unshift(s); }
async function patch(id, p) { const s = await nell.patch(id, p); if (s) setLocal(s); return s; }

nell.onUpdated((s) => {
  const before = sets.find((x) => x.id === s.id);
  setLocal(s); renderHistory();
  if (s.id !== currentId || s.status === 'draft') return;
  if (!s.notes) { renderProc(); return; }
  if (!before?.notes) { renderMain(); return; }
  const J = JSON.stringify;
  if (tab === 'podcast') {
    const a = before.podcast || {}, b = s.podcast || {};
    if (a.file !== b.file || a.engine !== b.engine || a.status !== b.status || J(a.script) !== J(b.script) || a.error !== b.error) renderPodcast();
  } else if (tab === 'quiz') { if (!quiz.active && J(before.quiz) !== J(s.quiz)) renderQuiz(); }
  else if (tab === 'cards') { if (J(before.cards) !== J(s.cards)) { deck.forId = null; renderCards(); } }
  renderToolbar();
});
nell.onProgress((p) => {
  if (p.step < 0) { delete prog[p.id]; running.delete(p.id); } else { prog[p.id] = p; running.add(p.id); }
  renderHistory();
  if (p.id !== currentId) return;
  const c = cur();
  if (c && !c.notes) renderProc();
  if (tab === 'podcast') { const w = $('#podWork'); if (w && p.step >= 0) w.textContent = p.text; if (p.step < 0) renderPodcast(); }
  if (tab === 'quiz' || tab === 'cards') { const w = $('#regenWork'); if (w) { if (p.step < 0) render(); else w.textContent = p.text; } }
});

/* ---------------- Historie ---------------- */
function renderHistory() {
  const el = $('#historyList');
  const list = sets.filter((s) => s.status !== 'draft' || (s.images || []).length);
  if (!list.length) { el.innerHTML = '<div class="h-empty">Zatím tu nic není. Vyfoť poznámky a začni první látkou.</div>'; return; }
  el.innerHTML = list.map((s) => {
    const busy = running.has(s.id) || s.status === 'processing' || s.podcast?.status === 'working' && running.has(s.id);
    let meta;
    if (s.status === 'draft') meta = 'Rozpracováno · ' + (s.images || []).length + ' ' + plural((s.images || []).length, 'fotka', 'fotky', 'fotek');
    else if (busy) meta = `<span class="spin" aria-hidden="true"></span>${esc((prog[s.id]?.text || 'Pracuju…').replace(/…$/, '…'))}`;
    else if (s.status === 'error' && !s.notes) meta = '<span class="dot err" aria-hidden="true"></span>Nepovedlo se';
    else meta = esc([s.subject, fmtDate(s.createdAt)].filter(Boolean).join(' · '));
    const th = s.images?.[0] ? `<img class="h-thumb" alt="" data-src="${s.id}/${s.images[0].file}">` : '<div class="h-thumb"></div>';
    return `<div class="h-item ${s.id === currentId ? 'active' : ''}" data-id="${s.id}" role="button" tabindex="0" aria-current="${s.id === currentId ? 'page' : 'false'}">
      ${th}<div class="h-txt"><div class="h-title">${esc(s.title || 'Nová látka')}</div><div class="h-meta">${meta}</div></div>
      <button class="h-del" data-del="${s.id}" title="Smazat látku" aria-label="Smazat látku ${esc(s.title || '')}">${ICON_X}</button></div>`;
  }).join('');
  fillImgs(el);
}
$('#historyList').addEventListener('click', async (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    e.stopPropagation(); const id = del.dataset.del;
    if (running.has(id)) { toast('Látka se právě zpracovává – smazat ji půjde, až to doběhne.'); return; }
    if (!del.classList.contains('confirm')) { $$('.h-del.confirm').forEach((x) => x.classList.remove('confirm')); del.classList.add('confirm'); setTimeout(() => del.classList.remove('confirm'), 3000); return; }
    await nell.remove(id); sets = sets.filter((s) => s.id !== id);
    if (currentId === id) { stopAudio(); currentId = null; render(); } else renderHistory();
    return;
  }
  const it = e.target.closest('.h-item'); if (!it) return;
  open(it.dataset.id);
});
$('#historyList').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('h-item')) { e.preventDefault(); open(e.target.dataset.id); } });
function open(id) {
  document.body.classList.remove('side-open');
  if (id === currentId) return;
  stopAudio(); quiz.active = false; deck.touched = false;
  currentId = id; tab = 'notes'; render();
}

/* ---------------- Toolbar & taby ---------------- */
function renderToolbar() {
  const s = cur(); const hasNotes = !!s?.notes;
  $('#tabs').classList.toggle('hidden', !hasNotes);
  $$('#tabs button').forEach((b) => { b.setAttribute('aria-selected', String(b.dataset.tab === tab)); b.tabIndex = b.dataset.tab === tab ? 0 : -1; });
  $('#tbTitle').textContent = hasNotes ? s.title : '';
  const a = $('#tbActions'); a.innerHTML = '';
  if (hasNotes && tab === 'notes') a.innerHTML = `<button class="btn-ghost" id="tbCopy" title="Zkopírovat zkrácené poznámky">${COPY}Kopírovat</button>`;
  if (hasNotes && tab === 'podcast' && s.podcast?.file) a.innerHTML = `<button class="btn-ghost" id="tbExport" title="Uložit podcast do souboru (⇧⌘S)">${DL}Uložit podcast</button>`;
  $('#tbCopy')?.addEventListener('click', copyNotes);
  $('#tbExport')?.addEventListener('click', exportPodcast);
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });
$('#tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const order = ['notes', 'podcast', 'quiz', 'cards']; const i = order.indexOf(tab);
  setTab(order[(i + (e.key === 'ArrowRight' ? 1 : 3)) % 4]); $(`#tabs [data-tab="${tab}"]`).focus();
});
function setTab(t) { if (!cur()?.notes) return; if (t !== 'quiz') quiz.active = false; tab = t; renderMain(); }

/* ---------------- Render ---------------- */
function render() { renderHistory(); renderMain(); }
function renderMain() {
  const s = cur();
  $('#content').scrollTop = 0;
  if (!s || s.status === 'draft') renderNew();
  else if (!s.notes) renderProc();
  else if (tab === 'notes') renderNotes();
  else if (tab === 'podcast') renderPodcast();
  else if (tab === 'quiz') renderQuiz();
  else renderCards();
  renderToolbar();
}

/* ---------------- Nová látka ---------------- */
let draftLen = null;
function newSet() { stopAudio(); currentId = null; tab = 'notes'; render(); }
async function ensureDraft() {
  let s = cur(); if (s && s.status === 'draft') return s;
  s = await nell.create({ id: uid(), status: 'draft', title: '', topic: draftTopic || '', images: [] });
  setLocal(s); currentId = s.id; return s;
}
async function addImages(getter) {
  const s = await ensureDraft();
  const r = await getter(s.id);
  if (r.errors?.length) toast(r.errors.join(' '), true);
  if (r.images?.length) { const imgs = [...(cur().images || []), ...r.images]; await patch(s.id, { images: imgs }); }
  render();
}
const pickImages = async () => { const paths = await nell.pickImages(); if (paths.length) addImages((id) => nell.importImages(id, paths)); };
const pasteImages = () => addImages((id) => nell.pasteImage(id));

function renderNew() {
  const s = cur(); const imgs = s?.images || [];
  const len = draftLen || settings.podcastLength || 'stredni';
  $('#content').innerHTML = `<div class="narrow view">
    <div class="hello"><h1>Co se dnes naučíme?</h1><p>Vyfoť poznámky ze sešitu nebo přidej screenshot. Zbytek udělám já.</p></div>
    <div class="drop" id="drop">
      <div class="drop-ico">${PHOTO}</div>
      <h2>${imgs.length ? 'Přidej další stránky' : 'Vyfoť nebo vyber poznámky'}</h2>
      <p>Vyfoť sešit foťákem, vyber fotky nebo screenshoty z iPadu – texty aplikace (lišty, tlačítka, název souboru) poznám a vynechám. Fotky sem můžeš i přetáhnout.</p>
      <div class="drop-actions"><button class="btn-primary" id="btnPick">Vyfotit nebo vybrat fotky</button><button class="btn-ghost" id="btnPaste">Vložit ze schránky</button></div>
    </div>
    ${imgs.length ? `<div class="thumbs">${imgs.map((im, i) => `<div class="thumb"><img alt="Stránka ${i + 1}" data-src="${s.id}/${im.file}" data-i="${i}"><span class="n">${i + 1}</span><button class="rm" data-rm="${i}" aria-label="Odebrat stránku ${i + 1}">✕</button></div>`).join('')}</div>` : ''}
    <div class="form-row">
      <label class="field">Téma nebo předmět <span class="hint">(nepovinné – pomůže lépe přečíst rukopis)</span>
        <input class="inp" id="topic" placeholder="např. Urologie – nádory prostaty" value="${esc(s?.topic || '')}" /></label>
      <div class="field">Délka podcastu
        <div class="seg" id="lenSeg" role="radiogroup" aria-label="Délka podcastu">
          ${[['kratky', 'Krátký'], ['stredni', 'Střední'], ['dlouhy', 'Dlouhý']].map(([v, l]) => `<button data-v="${v}" role="radio" aria-checked="${v === len}">${l}</button>`).join('')}
        </div></div>
    </div>
    <div class="create-bar">
      <div class="hint">Z fotek udělám zkrácené poznámky, podcast, kvíz a kartičky. Čte je Google Gemini (zdarma) – zkontroluj si důležité údaje, AI se může splést.</div>
      <button class="btn-primary lg" id="btnCreate" ${imgs.length ? '' : 'disabled'}>${SPARK.replace('<svg', '<svg class="ico"')}Vytvořit materiály</button>
    </div></div>`;
  fillImgs($('#content'));
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  $('#btnPick').onclick = pickImages; $('#btnPaste').onclick = pasteImages;
  $$('.thumb img').forEach((im) => im.onclick = () => lightbox(s, +im.dataset.i));
  $$('[data-rm]').forEach((b) => b.onclick = async () => {
    const i = +b.dataset.rm; const im = s.images[i];
    await nell.removeImage(s.id, im.file); await patch(s.id, { images: s.images.filter((_, k) => k !== i) }); render();
  });
  $('#topic').oninput = (e) => { if (s) { clearTimeout(renderNew._t); renderNew._t = setTimeout(() => patch(s.id, { topic: e.target.value }), 400); } else draftTopic = e.target.value; };
  if (!s && draftTopic) $('#topic').value = draftTopic;
  $('#lenSeg').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; draftLen = b.dataset.v; $$('#lenSeg button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); };
  $('#btnCreate').onclick = create;
}
let draftTopic = '';
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  const files = [...(e.dataTransfer?.files || [])].map((f) => nell.pathForFile(f)).filter(Boolean);
  if (!files.length) return;
  const s = cur(); if (s && s.status !== 'draft') { currentId = null; }
  addImages((id) => nell.importImages(id, files));
});
document.addEventListener('paste', (e) => {
  if (e.target.closest('input, textarea')) return;
  const s = cur(); if (s && s.status !== 'draft') return;
  const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  e.preventDefault(); addImages((id) => nell.importBlobs(id, files));
});
async function create() {
  const s = cur(); if (!s?.images?.length) return;
  if (!settings.hasGemini) { openSettings(); toast('Nejdřív vlož Gemini klíč – je zdarma a bez něj poznámky nepřečtu.', true); return; }
  const topic = $('#topic')?.value.trim() || '';
  await patch(s.id, { topic, status: 'processing', title: topic && topic.length < 60 ? topic : '' });
  prog[s.id] = { id: s.id, step: 0, text: 'Čtu tvoje poznámky…' }; running.add(s.id);
  render();
  nell.process(s.id, { podcastLength: draftLen || settings.podcastLength }).then((r) => { if (!r.ok && r.error) toast(r.error, true); });
  draftLen = null; draftTopic = '';
}

/* ---------------- Zpracování ---------------- */
const STEPS = ['Čtu poznámky', 'Píšu kvíz a kartičky', 'Píšu scénář podcastu', 'Namlouvám podcast'];
function renderProc() {
  const s = cur(); if (!s) return;
  const p = prog[s.id]; const busy = running.has(s.id) || s.status === 'processing';
  if (!busy && s.status === 'error') {
    $('#content').innerHTML = `<div class="proc view"><div class="proc-orb" style="animation:none">${PHOTO}</div><h1>Tohle se nepovedlo</h1>
      <div class="err-box" style="margin-top:16px;text-align:left">${esc(s.error || 'Neznámá chyba.')}</div>
      <div class="drop-actions" style="margin-top:20px;justify-content:center"><button class="btn-ghost" id="btnEdit">Upravit fotky</button><button class="btn-primary" id="btnRetry">Zkusit znovu</button></div></div>`;
    $('#btnRetry').onclick = () => { patch(s.id, { status: 'draft' }).then(() => { render(); create(); }); };
    $('#btnEdit').onclick = () => patch(s.id, { status: 'draft' }).then(render);
    return;
  }
  const step = p?.step ?? 0;
  $('#content').innerHTML = `<div class="proc view"><div class="proc-orb">${SPARK}</div>
    <h1>Připravuju tvoje materiály</h1><div class="sub" role="status">${esc(p?.text || 'Pracuju…')}</div>
    <ol class="steps">${STEPS.slice(0, 2).map((t, i) => `<li class="${i < step ? 'done' : i === step ? 'on' : ''}"><span class="st">${i < step ? '✓' : ''}</span>${t}</li>`).join('')}</ol>
    <p class="hint">Obvykle to trvá do minuty. Nech aplikaci otevřenou – podcast se pak dodělá sám, i když se mezitím budeš učit z poznámek.</p></div>`;
}

/* ---------------- Poznámky ---------------- */
function renderNotes() {
  const s = cur(); const n = s.notes;
  $('#content').innerHTML = `<div class="max view">
    <div class="n-head">${s.subject ? `<span class="chip">${esc(s.subject)}</span>` : ''}<h1>${esc(s.title)}</h1>
      <div class="n-meta"><span>${fmtDate(s.createdAt)}</span><span>${s.images.length} ${plural(s.images.length, 'stránka', 'stránky', 'stránek')} poznámek</span>${s.quiz?.length ? `<span>${s.quiz.length} ${plural(s.quiz.length, 'otázka', 'otázky', 'otázek')} v kvízu</span>` : ''}${s.cards?.length ? `<span>${s.cards.length} ${plural(s.cards.length, 'kartička', 'kartičky', 'kartiček')}</span>` : ''}</div></div>
    ${s.error ? `<div class="err-box" style="margin-bottom:16px">${esc(s.error)}</div>` : ''}
    <div class="card summary"><div class="eyebrow">Ve zkratce</div><p>${rich(n.summary)}</p></div>
    <div class="sections">${n.sections.map((x, i) => `<div class="sec card"><h3><span class="num">${i + 1}</span>${esc(x.heading)}</h3><ul class="pts">${x.points.map((p) => `<li><span>${rich(p)}</span></li>`).join('')}</ul></div>`).join('')}</div>
    ${n.terms?.length ? `<h2 class="sec-title">Slovníček pojmů</h2><div class="card terms"><dl>${n.terms.map((t) => `<dt>${esc(t.term)}</dt><dd>${rich(t.def)}</dd>`).join('')}</dl></div>` : ''}
    <h2 class="sec-title">Tvoje původní poznámky</h2>
    <div class="orig">${s.images.map((im, i) => `<img alt="Stránka ${i + 1}" data-src="${s.id}/${im.file}" data-i="${i}" tabindex="0">`).join('')}</div>
    ${n.transcript ? `<details class="trans"><summary>Zobrazit přepis poznámek (pro kontrolu, jestli AI přečetla rukopis správně)</summary><pre>${esc(n.transcript)}</pre></details>` : ''}
  </div>`;
  fillImgs($('#content'));
  $$('.orig img').forEach((im) => { im.onclick = () => lightbox(s, +im.dataset.i); im.onkeydown = (e) => { if (e.key === 'Enter') lightbox(s, +im.dataset.i); }; });
}
function copyNotes() {
  const s = cur(); const n = s.notes;
  const txt = `${s.title}\n\n${plain(n.summary)}\n\n${n.sections.map((x) => `${x.heading}\n${x.points.map((p) => '• ' + plain(p)).join('\n')}`).join('\n\n')}${n.terms?.length ? `\n\nPojmy\n${n.terms.map((t) => `• ${t.term} – ${plain(t.def)}`).join('\n')}` : ''}`;
  nell.copy(txt); toast('Poznámky jsou zkopírované.');
}

/* ---------------- Lightbox ---------------- */
let lb = null;
async function lightbox(s, i) { lb = { s, i }; $('#lightbox').classList.remove('hidden'); await lbShow(); $('#lbClose').focus(); }
async function lbShow() { const { s, i } = lb; $('#lbImg').src = await imgURL(s.id, s.images[i].file); $('#lbPrev').disabled = i === 0; $('#lbNext').disabled = i === s.images.length - 1; }
const lbClose = () => { $('#lightbox').classList.add('hidden'); lb = null; };
$('#lbClose').onclick = lbClose;
$('#lightbox').onclick = (e) => { if (e.target.id === 'lightbox') lbClose(); };
$('#lbPrev').onclick = () => { if (lb.i > 0) { lb.i--; lbShow(); } };
$('#lbNext').onclick = () => { if (lb.i < lb.s.images.length - 1) { lb.i++; lbShow(); } };

/* ---------------- Podcast ---------------- */
let audio = null, audioFor = null, audioURL = null, rafT = null;
function czVoice() {
  const vs = (window.speechSynthesis?.getVoices() || []).filter((v) => /^cs/i.test(v.lang));
  return vs.find((v) => /premium/i.test(v.name)) || vs.find((v) => /enhanced|vylepš/i.test(v.name)) || vs[0] || null;
}
try { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; } catch {}
class SpeechAudio extends EventTarget {
  constructor(s) { super(); this.lines = s.podcast.script; this.seg = s.podcast.segments || []; this.duration = s.podcast.duration || 1; this.paused = true; this.ended = false; this.playbackRate = 1; this._t = 0; this.i = 0; this._gen = 0; setTimeout(() => this.dispatchEvent(new Event('loadedmetadata'))); }
  get currentTime() { return this._t; }
  set currentTime(v) {
    this._t = Math.max(0, Math.min(v, this.duration));
    const i = this.seg.findIndex((g) => g && this._t >= g[0] && this._t < g[1]);
    this.i = i < 0 ? (this._t >= this.duration ? this.lines.length : 0) : i;
    if (!this.paused) this._speak();
    this.dispatchEvent(new Event('timeupdate'));
  }
  play() { if (!window.speechSynthesis) { toast('Tohle zařízení neumí číst nahlas.', true); return Promise.resolve(); } if (this.i >= this.lines.length) { this.i = 0; this._t = 0; } this.paused = false; this.ended = false; this._speak(); this.dispatchEvent(new Event('play')); return Promise.resolve(); }
  pause() { this.paused = true; this._gen++; try { speechSynthesis.cancel(); } catch {} clearInterval(this._tick); this.dispatchEvent(new Event('pause')); }
  _speak() {
    const gen = ++this._gen; try { speechSynthesis.cancel(); } catch {} clearInterval(this._tick);
    if (this.i >= this.lines.length) { this.paused = true; this.ended = true; this._t = this.duration; this.dispatchEvent(new Event('ended')); this.dispatchEvent(new Event('pause')); return; }
    const l = this.lines[this.i]; const u = new SpeechSynthesisUtterance(l.text);
    u.lang = 'cs-CZ'; const v = czVoice(); if (v) u.voice = v;
    u.rate = this.playbackRate; u.pitch = l.speaker === 'Nela' ? 1.1 : 0.82;
    const [a, b] = this.seg[this.i] || [this._t, this._t + 5]; this._t = Math.max(this._t, a); const t0 = Date.now(), base = this._t;
    this._tick = setInterval(() => { this._t = Math.min(b - 0.01, base + (Date.now() - t0) / 1000 * this.playbackRate * 0.9); this.dispatchEvent(new Event('timeupdate')); }, 250);
    u.onend = () => { if (gen !== this._gen) return; clearInterval(this._tick); this.i++; this._t = this.seg[this.i]?.[0] ?? this.duration; this.dispatchEvent(new Event('timeupdate')); if (!this.paused) this._speak(); };
    u.onerror = u.onend;
    speechSynthesis.speak(u);
  }
}
function stopAudio() { if (audio) { audio.pause(); } }
async function ensureAudio(s) {
  if (audio && audioFor === s.id + s.podcast.file + s.podcast.engine) return audio;
  if (audio) { audio.pause(); }
  if (audioURL) URL.revokeObjectURL(audioURL);
  if (s.podcast.engine === 'speech') {
    audio = new SpeechAudio(s); audioFor = s.id + s.podcast.file + s.podcast.engine; audioURL = null;
  } else {
  const data = await nell.readFile(s.id, s.podcast.file); if (!data) throw new Error('Soubor podcastu chybí.');
  audioURL = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
  audio = new Audio(audioURL); audioFor = s.id + s.podcast.file + s.podcast.engine;
  }
  audio.playbackRate = +(localStorage.getItem('rate') || 1);
  const pos = +(localStorage.getItem('pos:' + audioFor) || 0); if (pos) audio.currentTime = pos;
  audio.addEventListener('play', syncPlayer); audio.addEventListener('pause', syncPlayer); audio.addEventListener('ended', syncPlayer);
  audio.addEventListener('timeupdate', () => { syncPlayer(); try { localStorage.setItem('pos:' + audioFor, audio.ended ? 0 : audio.currentTime); } catch {} });
  audio.addEventListener('loadedmetadata', syncPlayer);
  return audio;
}
function lenLabel(l) { return { kratky: 'Krátký', stredni: 'Střední', dlouhy: 'Dlouhý' }[l] || 'Střední'; }
function renderPodcast() {
  const s = cur(); const pc = s.podcast || {};
  const hasAudio = !!pc.file || (pc.engine === 'speech' && pc.status === 'done' && !!pc.script);
  const busy = pc.status === 'working' && running.has(s.id) || (running.has(s.id) && !hasAudio);
  const dur = pc.duration || 0;
  let head;
  if (hasAudio) {
    head = `<div class="card player">
      <div class="cover" aria-hidden="true"><span class="ns">NS</span><div class="ct">${esc(s.title)}</div><div class="cs">NELL STUDY podcast</div></div>
      <div>
        <div class="p-title">${esc(s.title)}</div>
        <div class="p-sub">${pc.engine === 'speech' ? 'Čte hlas iPadu' : 'Nela a Daniel'} · ${Math.max(1, Math.round(dur / 60))} min${pc.engine === 'speech' ? ' (odhad)' : ''}</div>
        <div class="controls">
          <button class="skip" id="pBack" aria-label="O 15 sekund zpět" title="O 15 s zpět">${BACK15}<span>15</span></button>
          <button class="play" id="pPlay" aria-label="Přehrát">${PLAY}</button>
          <button class="skip" id="pFwd" aria-label="O 15 sekund dopředu" title="O 15 s dopředu">${FWD15}<span>15</span></button>
          <label class="speed">
            <select id="pRate" aria-label="Rychlost přehrávání">${[0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => `<option value="${r}" ${r === +(localStorage.getItem('rate') || 1) ? 'selected' : ''}>${String(r).replace('.', ',')}×</option>`).join('')}</select>
          </label>
        </div>
        <div class="scrub"><input type="range" id="pSeek" min="0" max="${Math.max(1, dur).toFixed(1)}" step="0.1" value="0" aria-label="Pozice v podcastu" /><div class="times"><span id="pCur">0:00</span><span id="pDur">${fmtT(dur)}</span></div></div>
      </div></div>`;
  } else head = '';
  const working = busy ? `<div class="card working" role="status"><span class="spin" aria-hidden="true"></span><div><b>${hasAudio ? 'Připravuju novou verzi podcastu' : 'Podcast se připravuje'}<div class="hint">Nech aplikaci otevřenou, dokud to nedoběhne.</div></b><div class="muted" id="podWork">${esc(prog[s.id]?.text || 'Pracuju…')}</div></div></div>` : '';
  const err = !busy && pc.status === 'error' && pc.error ? `<div class="err-box">${esc(pc.error)}</div>` : '';
  const note = pc.note && hasAudio && !busy ? `<div class="note-box">${esc(pc.note)}</div>` : '';
  const empty = !hasAudio && !busy ? `<div class="card q-start"><div class="big" style="font-size:40px">🎧</div><h2 style="font-size:20px;margin-top:6px">Podcast zatím není</h2><p class="muted" style="margin-top:6px">${pc.error ? 'Při namlouvání se něco pokazilo – zkus to znovu.' : 'Vytvořím rozhovor, ve kterém Nela s Danielem celou látku vysvětlí.'}</p></div>` : '';
  const acts = !busy ? `<div class="p-actions">
      ${pc.script ? `<button class="btn-primary" id="pRedo">${pc.file ? 'Namluvit znovu' : 'Namluvit AI hlasy'}</button><button class="btn-ghost" id="pMac" title="Bez limitu – čte český hlas iPadu">Číst hlasem iPadu</button>` : `<button class="btn-primary" id="pNew">Vytvořit podcast</button>`}
      <div class="grow"></div>
      <div class="seg" id="pLen" role="radiogroup" aria-label="Délka nového scénáře">${['kratky', 'stredni', 'dlouhy'].map((v) => `<button data-v="${v}" role="radio" aria-checked="${v === (pc.length || settings.podcastLength || 'stredni')}">${lenLabel(v)}</button>`).join('')}</div>
      ${pc.script ? '<button class="btn-ghost" id="pScript">Nový scénář</button>' : ''}
    </div>` : '';
  const script = pc.script ? `<h2 class="sec-title" style="margin-top:14px">Přepis rozhovoru${hasAudio ? '<span class="grow"></span><span class="hint" style="font-weight:400">Kliknutím na repliku tam přeskočíš</span>' : ''}</h2>
    <div class="script" id="pScriptList">${pc.script.map((l, i) => { const sp = l.speaker === 'Nela' ? 'Nela' : 'Daniel'; return `<button class="line" data-i="${i}"><span class="av ${sp}" aria-hidden="true">${sp[0]}</span><span><div class="who">${sp}</div><div class="tx">${esc(l.text)}</div></span></button>`; }).join('')}</div>` : '';
  $('#content').innerHTML = `<div class="narrow view" style="display:flex;flex-direction:column;gap:14px">${head}${working}${err}${note}${empty}${acts}${script}</div>`;
  let selLen = pc.length || settings.podcastLength || 'stredni';
  $('#pLen')?.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; selLen = b.dataset.v; $$('#pLen button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
  const go = (opts) => { stopAudio(); patch(s.id, { podcast: { ...pc, status: 'working', error: '' } }).then(() => { running.add(s.id); renderPodcast(); nell.podcast(s.id, opts).then((r) => { if (!r.ok && r.error) toast(r.error, true); }); }); };
  $('#pRedo')?.addEventListener('click', () => go({}));
  $('#pMac')?.addEventListener('click', () => go({ engine: 'speech' }));
  $('#pNew')?.addEventListener('click', () => go({ newScript: true, length: selLen }));
  $('#pScript')?.addEventListener('click', () => go({ newScript: true, length: selLen }));
  if (hasAudio) setupPlayer(s);
}
async function setupPlayer(s) {
  let a; try { a = await ensureAudio(s); } catch (e) { toast(e.message, true); return; }
  $('#pRate').value = String(a.playbackRate);
  $('#pPlay').onclick = () => a.paused ? a.play() : a.pause();
  $('#pBack').onclick = () => { a.currentTime = Math.max(0, a.currentTime - 15); };
  $('#pFwd').onclick = () => { a.currentTime = Math.min(a.duration || 1e9, a.currentTime + 15); };
  $('#pRate').onchange = (e) => { a.playbackRate = +e.target.value; try { localStorage.setItem('rate', e.target.value); } catch {} };
  $('#pSeek').oninput = (e) => { a.currentTime = +e.target.value; syncPlayer(); };
  $('#pScriptList')?.addEventListener('click', (e) => {
    const b = e.target.closest('.line'); const seg = s.podcast.segments?.[+b?.dataset.i];
    if (b && seg) { a.currentTime = seg[0] + 0.01; a.play(); }
  });
  syncPlayer();
}
let lastLine = -1;
function syncPlayer() {
  if (!audio || !$('#pPlay')) return;
  const s = cur(); if (!s || audioFor !== s.id + s.podcast?.file + s.podcast?.engine) return;
  const d = isFinite(audio.duration) ? audio.duration : (s.podcast.duration || 0);
  $('#pPlay').innerHTML = audio.paused ? PLAY : PAUSE; $('#pPlay').setAttribute('aria-label', audio.paused ? 'Přehrát' : 'Pozastavit');
  const seek = $('#pSeek'); seek.max = Math.max(1, d).toFixed(1); seek.value = audio.currentTime;
  seek.style.setProperty('--p', (d ? audio.currentTime / d * 100 : 0) + '%');
  $('#pCur').textContent = fmtT(audio.currentTime); $('#pDur').textContent = fmtT(d);
  const segs = s.podcast.segments || []; const t = audio.currentTime * (s.podcast.duration && d ? s.podcast.duration / d : 1);
  const i = segs.findIndex((g) => g && t >= g[0] && t < g[1]);
  if (i !== lastLine) {
    $$('#pScriptList .line').forEach((el) => el.classList.toggle('now', +el.dataset.i === i));
    const el = $(`#pScriptList .line[data-i="${i}"]`);
    if (el && !audio.paused) el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    lastLine = i;
  }
}
async function exportPodcast() { const s = cur(); if (!s) return; const r = await nell.exportPodcast(s.id); if (r.ok) toast('Podcast je uložený – můžeš si ho poslat do mobilu.'); else if (r.error) toast(r.error, true); }

/* ---------------- Kvíz ---------------- */
const quiz = { active: false, order: [], i: 0, answers: [], perm: [], picked: null };
const LETTERS = ['a', 'b', 'c'];
function regenBlock(kind) {
  const s = cur();
  return running.has(s.id) && !(s.quiz?.length) ? `<div class="card working" role="status"><span class="spin" aria-hidden="true"></span><div><b>Připravuju ${kind}</b><div class="muted" id="regenWork">${esc(prog[s.id]?.text || 'Pracuju…')}</div></div></div>` : '';
}
function regenStudy() {
  const s = cur(); if (running.has(s.id)) { toast('Na téhle látce se ještě pracuje, chvilku počkej.'); return; }
  running.add(s.id); prog[s.id] = { step: 1, text: 'Připravuju nový kvíz a kartičky…' }; quiz.active = false;
  const box = $('#content .view'); if (box) box.insertAdjacentHTML('afterbegin', `<div class="card working" role="status"><span class="spin"></span><div><b>Připravuju nové otázky a kartičky</b><div class="muted" id="regenWork">Pracuju…</div></div></div>`);
  nell.regenStudy(s.id).then((r) => { if (!r.ok) toast(r.error, true); else toast('Hotovo – nový kvíz i kartičky jsou připravené.'); render(); });
}
function renderQuiz() {
  const s = cur(); const qs = s.quiz || [];
  if (!quiz.active) {
    const st = s.quizStats;
    $('#content').innerHTML = `<div class="narrow view">${regenBlock('kvíz')}
      ${qs.length ? `<div class="card q-start"><div class="eyebrow" style="justify-content:center">Kvíz</div><div class="big">${qs.length} ${plural(qs.length, 'otázka', 'otázky', 'otázek')}</div>
        <p class="muted" style="margin:6px 0 22px">${st ? `Naposledy ${st.last} %, nejlépe ${st.best} %.` : 'Každá otázka má tři možnosti, správná je vždy jen jedna.'}</p>
        <button class="btn-primary lg" id="qStart">Spustit kvíz</button>
        <p class="hint" style="margin-top:16px">Odpovídat můžeš i klávesami <kbd>A</kbd> <kbd>B</kbd> <kbd>C</kbd>, dál <kbd>↩</kbd>.</p></div>
        <div style="text-align:center;margin-top:14px"><button class="btn-ghost" id="qRegen">Vytvořit nové otázky</button></div>`
      : running.has(s.id) ? '' : `<div class="card q-start"><p class="muted">Kvíz se nepodařilo připravit.</p><button class="btn-primary" id="qRegen" style="margin-top:14px">Vytvořit kvíz a kartičky</button></div>`}</div>`;
    $('#qStart')?.addEventListener('click', () => startQuiz());
    $('#qRegen')?.addEventListener('click', regenStudy);
    return;
  }
  if (quiz.i >= quiz.order.length) return renderQuizResult();
  const qi = quiz.order[quiz.i]; const q = qs[qi]; const perm = quiz.perm[quiz.i]; const picked = quiz.picked;
  const done = picked !== null;
  $('#content').innerHTML = `<div class="narrow view">
    <div class="q-top"><span>Otázka ${quiz.i + 1} z ${quiz.order.length}</span><div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${quiz.order.length}" aria-valuenow="${quiz.i + (done ? 1 : 0)}"><i style="width:${(quiz.i + (done ? 1 : 0)) / quiz.order.length * 100}%"></i></div><button class="btn-ghost" id="qEnd">Ukončit</button></div>
    <div class="q-text">${rich(q.q)}</div>
    <div class="opts" role="group" aria-label="Možnosti odpovědi">${perm.map((oi, k) => {
      let cls = '', res = '';
      if (done) { if (oi === q.correct) { cls = 'right'; res = '✓ Správně'; } else if (k === picked) { cls = 'wrong'; res = '✗ Tvoje odpověď'; } else cls = 'faded'; }
      return `<button class="opt ${cls}" data-k="${k}" ${done ? 'disabled' : ''}><span class="k">${LETTERS[k]})</span><span>${rich(q.options[oi])}</span>${res ? `<span class="res">${res}</span>` : ''}</button>`;
    }).join('')}</div>
    ${done ? `<div class="explain" role="status"><b>${perm[picked] === q.correct ? 'Správně! 🎉' : 'Tentokrát ne.'}</b>${rich(q.explain || '')}</div>
    <div class="q-next"><span class="hint">Pokračuj klávesou <kbd>↩</kbd></span><button class="btn-primary" id="qNext">${quiz.i + 1 < quiz.order.length ? 'Další otázka' : 'Zobrazit výsledek'}</button></div>` : ''}
  </div>`;
  $$('.opt').forEach((b) => b.onclick = () => answer(+b.dataset.k));
  $('#qNext')?.addEventListener('click', nextQ); $('#qNext')?.focus();
  $('#qEnd').onclick = () => { quiz.active = false; renderQuiz(); };
}
function startQuiz(only) {
  const qs = cur().quiz; const idx = only || qs.map((_, i) => i);
  Object.assign(quiz, { active: true, order: shuffle(idx), i: 0, answers: [], picked: null });
  quiz.perm = quiz.order.map(() => shuffle([0, 1, 2]));
  renderQuiz();
}
function answer(k) {
  if (quiz.picked !== null) return;
  const q = cur().quiz[quiz.order[quiz.i]];
  quiz.picked = k; quiz.answers[quiz.i] = quiz.perm[quiz.i][k] === q.correct; renderQuiz();
}
function nextQ() { quiz.i++; quiz.picked = null; renderQuiz(); $('#content').scrollTop = 0; }
function renderQuizResult() {
  const s = cur(); const n = quiz.order.length; const ok = quiz.answers.filter(Boolean).length; const pc = Math.round(ok / n * 100);
  if (quiz.order.length === s.quiz.length && !quiz.saved) { quiz.saved = true; const best = Math.max(pc, s.quizStats?.best || 0); patch(s.id, { quizStats: { last: pc, best } }); }
  const wrong = quiz.order.filter((_, i) => !quiz.answers[i]);
  const msg = pc === 100 ? 'Perfektní! Tohle umíš na jedničku.' : pc >= 80 ? 'Skvělá práce, skoro všechno sedí.' : pc >= 50 ? 'Dobrý základ. Zopakuj si chyby a bude to.' : 'Nevadí – projdi si kartičky a zkus to znovu.';
  const C = 2 * Math.PI * 64;
  $('#content').innerHTML = `<div class="narrow view"><div class="card result">
    <div class="ring"><svg viewBox="0 0 156 156" aria-hidden="true"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset=".55" stop-color="#c026d3"/><stop offset="1" stop-color="#db2777"/></linearGradient></defs>
      <circle cx="78" cy="78" r="64" fill="none" stroke="currentColor" stroke-opacity=".1" stroke-width="12"/><circle cx="78" cy="78" r="64" fill="none" stroke="url(#rg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pc / 100)}"/></svg><div class="pc">${pc} %</div></div>
    <h2>${ok} z ${n} správně</h2><p>${msg}</p>
    <div class="acts">${wrong.length ? `<button class="btn-primary" id="qWrong">Zopakovat chyby (${wrong.length})</button>` : ''}<button class="btn-ghost" id="qAgain">Znovu celý kvíz</button><button class="btn-ghost" id="qCards">Učit se z kartiček</button></div>
    ${wrong.length ? `<div class="miss">${wrong.map((qi) => { const q = s.quiz[qi]; return `<div><b>${rich(q.q)}</b><span>✓ ${rich(q.options[q.correct])}</span></div>`; }).join('')}</div>` : ''}
  </div></div>`;
  $('#qWrong')?.addEventListener('click', () => { quiz.saved = false; startQuiz(wrong); });
  $('#qAgain').onclick = () => { quiz.saved = false; startQuiz(); };
  $('#qCards').onclick = () => setTab('cards');
}

/* ---------------- Kartičky ---------------- */
const deck = { order: [], i: 0, flipped: false, onlyUnknown: false, touched: false, forId: null };
function deckInit(s, keep) {
  const known = s.cardState || {};
  const all = (s.cards || []).map((_, i) => i);
  const list = deck.onlyUnknown ? all.filter((i) => !known[i]) : all;
  if (!keep || deck.forId !== s.id) { deck.order = list; deck.i = 0; deck.flipped = false; deck.forId = s.id; }
}
function renderCards() {
  const s = cur(); const cards = s.cards || [];
  if (!cards.length) {
    $('#content').innerHTML = `<div class="narrow view">${regenBlock('kartičky')}${running.has(s.id) ? '' : `<div class="card q-start"><p class="muted">Kartičky se nepodařilo připravit.</p><button class="btn-primary" id="qRegen" style="margin-top:14px">Vytvořit kvíz a kartičky</button></div>`}</div>`;
    $('#qRegen')?.addEventListener('click', regenStudy); return;
  }
  if (deck.forId !== s.id) deckInit(s);
  const known = s.cardState || {}; const nKnown = cards.filter((_, i) => known[i]).length;
  if (!deck.order.length) {
    $('#content').innerHTML = `<div class="narrow view"><div class="card result"><div class="big" style="font-size:44px">🌸</div><h2>Všechny kartičky umíš!</h2><p>${nKnown} z ${cards.length} označeno jako „Umím“.</p>
      <div class="acts"><button class="btn-primary" id="dAll">Projít všechny znovu</button><button class="btn-ghost" id="dReset">Vynulovat postup</button></div></div></div>`;
    $('#dAll').onclick = () => { deck.onlyUnknown = false; deckInit(s); renderCards(); };
    $('#dReset').onclick = async () => { await patch(s.id, { cardState: {} }); deck.onlyUnknown = false; deckInit(cur()); renderCards(); };
    return;
  }
  const ci = deck.order[deck.i]; const c = cards[ci];
  $('#content').innerHTML = `<div class="max view">
    <div class="deck-top" style="max-width:640px;margin-left:auto;margin-right:auto">
      <div class="seg" id="dFilter" role="radiogroup" aria-label="Které kartičky"><button data-v="all" role="radio" aria-checked="${!deck.onlyUnknown}">Všechny</button><button data-v="unk" role="radio" aria-checked="${deck.onlyUnknown}">Jen neumím (${cards.length - nKnown})</button></div>
      <button class="btn-ghost" id="dShuf" title="Zamíchat">${SHUF}Zamíchat</button>
      <span class="stat">${deck.i + 1} / ${deck.order.length} · umíš ${nKnown} z ${cards.length}</span>
    </div>
    <div class="flip ${deck.flipped ? 'flipped' : ''}" id="flip" role="button" tabindex="0" aria-label="${deck.flipped ? 'Odpověď: ' + esc(c.back) : 'Otázka: ' + esc(c.front) + '. Kliknutím otočíš.'}">
      <div class="flip-in">
        <div class="face front">${known[ci] ? '<span class="known-badge">✓ Umím</span>' : ''}<span class="lab">Otázka</span><div class="ft">${rich(c.front)}</div><span class="tap">Klikni nebo zmáčkni mezerník pro otočení</span></div>
        <div class="face back"><span class="lab">Odpověď</span><div class="bt">${rich(c.back)}</div><span class="tap">Klikni pro návrat k otázce</span></div>
      </div>
    </div>
    <div class="deck-acts">
      <button class="nav-btn" id="dPrev" aria-label="Předchozí kartička" ${deck.i === 0 ? 'disabled' : ''}>‹</button>
      <button class="btn-ghost know no" id="dNo">✗ Ještě ne</button>
      <button class="btn-ghost know yes" id="dYes">✓ Umím</button>
      <button class="nav-btn" id="dNext" aria-label="Další kartička" ${deck.i >= deck.order.length - 1 ? 'disabled' : ''}>›</button>
    </div>
    <div class="dots" aria-hidden="true">${deck.order.map((k, i) => `<i class="${known[k] ? 'k' : ''} ${i === deck.i ? 'c' : ''}"></i>`).join('')}</div>
    <p class="hint" style="text-align:center;margin-top:14px"><kbd>mezerník</kbd> otočit · <kbd>←</kbd> <kbd>→</kbd> listovat · <kbd>U</kbd> umím · <kbd>N</kbd> ještě ne</p>
  </div>`;
  $('#flip').onclick = flipCard;
  $('#dPrev').onclick = () => moveCard(-1); $('#dNext').onclick = () => moveCard(1);
  $('#dYes').onclick = () => mark(true); $('#dNo').onclick = () => mark(false);
  $('#dShuf').onclick = () => { deck.order = shuffle(deck.order); deck.i = 0; deck.flipped = false; renderCards(); };
  $('#dFilter').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; deck.onlyUnknown = b.dataset.v === 'unk'; deckInit(s); renderCards(); };
}
function flipCard() { deck.touched = true; deck.flipped = !deck.flipped; $('#flip')?.classList.toggle('flipped', deck.flipped); }
function moveCard(d) { const n = deck.i + d; if (n < 0 || n >= deck.order.length) return; deck.i = n; deck.flipped = false; renderCards(); }
async function mark(k) {
  const s = cur(); const ci = deck.order[deck.i]; const st = { ...(s.cardState || {}) };
  if (k) st[ci] = true; else delete st[ci];
  deck.touched = true;
  await patch(s.id, { cardState: st });
  if (deck.onlyUnknown && k) { deck.order.splice(deck.i, 1); if (deck.i >= deck.order.length) deck.i = Math.max(0, deck.order.length - 1); deck.flipped = false; renderCards(); }
  else if (deck.i < deck.order.length - 1) moveCard(1);
  else { deck.flipped = false; renderCards(); toast(k ? 'Poslední kartička – skvělá práce!' : 'Poslední kartička. Zkus „Jen neumím“.'); }
}

/* ---------------- Klávesy ---------------- */
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select') || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!$('#settings').classList.contains('hidden')) { if (e.key === 'Escape') closeSettings(); return; }
  if (lb) { if (e.key === 'Escape') lbClose(); if (e.key === 'ArrowLeft') $('#lbPrev').click(); if (e.key === 'ArrowRight') $('#lbNext').click(); return; }
  const s = cur(); if (!s?.notes) return;
  const k = e.key.toLowerCase();
  if (tab === 'quiz' && quiz.active) {
    const map = { a: 0, b: 1, c: 2, 1: 0, 2: 1, 3: 2 };
    if (k in map && quiz.picked === null) { e.preventDefault(); answer(map[k]); }
    else if (k === 'enter' && quiz.picked !== null && e.target.id !== 'qNext') { e.preventDefault(); nextQ(); }
  } else if (tab === 'cards' && (s.cards || []).length && deck.order.length) {
    if (k === ' ' && !e.target.closest('button:not(#flip)')) { e.preventDefault(); flipCard(); }
    else if (k === 'enter' && e.target.id === 'flip') { e.preventDefault(); flipCard(); }
    else if (k === 'arrowright') moveCard(1); else if (k === 'arrowleft') moveCard(-1);
    else if (k === 'u') mark(true); else if (k === 'n') mark(false);
  } else if (tab === 'podcast' && audio && k === ' ' && !e.target.closest('button')) { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
});

/* ---------------- Menu ---------------- */
nell.onMenu((a) => {
  if (a === 'settings') openSettings();
  else if (a === 'new') newSet();
  else if (a === 'open') { const s = cur(); if (s && s.status !== 'draft') currentId = null; render(); pickImages(); }
  else if (a === 'exportPodcast') exportPodcast();
  else if (a === 'playpause') { if (audio) audio.paused ? audio.play() : audio.pause(); else if (cur()?.podcast?.file) { setTab('podcast'); } }
  else if (a.startsWith('tab:')) setTab(a.slice(4));
});
$('#btnNew').onclick = () => { document.body.classList.remove('side-open'); newSet(); };
$('#btnSide').onclick = () => document.body.classList.toggle('side-open');
$('#scrim').onclick = () => document.body.classList.remove('side-open');

/* ---------------- Nastavení ---------------- */
const VOICES_F = [['Aoede', 'svěží'], ['Kore', 'pevný'], ['Leda', 'mladistvý'], ['Zephyr', 'jasný'], ['Callirrhoe', 'pohodový'], ['Autonoe', 'jasný'], ['Despina', 'hladký'], ['Laomedeia', 'veselý'], ['Sulafat', 'vřelý'], ['Vindemiatrix', 'jemný'], ['Achernar', 'měkký'], ['Erinome', 'čistý'], ['Pulcherrima', 'výrazný'], ['Gacrux', 'zralý']];
const VOICES_M = [['Puck', 'veselý'], ['Charon', 'informativní'], ['Fenrir', 'energický'], ['Orus', 'pevný'], ['Enceladus', 'dýchavý'], ['Iapetus', 'čistý'], ['Umbriel', 'pohodový'], ['Algieba', 'hladký'], ['Achird', 'přátelský'], ['Sadachbia', 'živý'], ['Sadaltager', 'znalý'], ['Schedar', 'vyrovnaný'], ['Zubenelgenubi', 'neformální'], ['Alnilam', 'pevný'], ['Rasalgethi', 'informativní']];
let sLen = 'stredni', lastFocus = null;
async function openSettings() {
  settings = await nell.getSettings(); lastFocus = document.activeElement;
  $('#sKey').value = ''; $('#sModel').value = settings.model || '';
  $('#sKeyState').textContent = settings.hasGemini ? '✓ Klíč je uložený. Nový vlož jen tehdy, když ho chceš změnit.' : 'Klíč zatím chybí – bez něj aplikace poznámky nepřečte.';
  $('#sVoiceA').innerHTML = VOICES_F.map(([v, d]) => `<option value="${v}">${v} – ${d}</option>`).join(''); $('#sVoiceA').value = settings.voiceA || 'Aoede';
  $('#sVoiceB').innerHTML = VOICES_M.map(([v, d]) => `<option value="${v}">${v} – ${d}</option>`).join(''); $('#sVoiceB').value = settings.voiceB || 'Puck';
  sLen = settings.podcastLength || 'stredni'; $$('#sLen button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === sLen)));
  $('#settings').classList.remove('hidden'); $('#sKey').focus();
}
function closeSettings() { $('#settings').classList.add('hidden'); lastFocus?.focus?.(); }
$('#sLen').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; sLen = b.dataset.v; $$('#sLen button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); };
$('#btnSettings').onclick = () => { document.body.classList.remove('side-open'); openSettings(); };
$('#sCancel').onclick = closeSettings;
$('#settings').addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
$('#sSave').onclick = async () => {
  await nell.saveSettings({ geminiKey: $('#sKey').value, model: $('#sModel').value, voiceA: $('#sVoiceA').value, voiceB: $('#sVoiceB').value, podcastLength: sLen });
  settings = await nell.getSettings(); closeSettings();
  toast(settings.hasGemini ? 'Uloženo.' : 'Uloženo – klíč ale pořád chybí.', !settings.hasGemini);
  if (!cur() || cur().status === 'draft') renderNew();
};
$('#sClear').onclick = async () => { await nell.saveSettings({ clearKey: true }); openSettings(); };

/* ---------------- Start ---------------- */
(async () => {
  sets = await nell.list(); settings = await nell.getSettings();
  for (const id of await nell.running()) running.add(id);
  const first = sets.find((s) => s.status !== 'draft');
  currentId = first ? first.id : (sets.find((s) => s.status === 'draft' && s.images?.length)?.id || null);
  render();
  if (!settings.hasGemini) setTimeout(openSettings, 1500);
})();

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
