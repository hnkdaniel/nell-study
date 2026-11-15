// NELL STUDY (web/iPad) – úložiště, Gemini a podcast přímo v prohlížeči
(function () {
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const listeners = { progress: [], updated: [] };
const emit = (k, v) => listeners[k].forEach((cb) => { try { cb(v); } catch (e) { console.error(e); } });

/* ---------- IndexedDB ---------- */
let dbP = null;
function db() {
  if (!dbP) dbP = new Promise((ok, no) => {
    const r = indexedDB.open('nell-study', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('sets', { keyPath: 'id' }); r.result.createObjectStore('files'); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  return dbP;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((ok, no) => { const t = d.transaction(store, mode); const st = t.objectStore(store); const res = fn(st); t.oncomplete = () => ok(res && 'result' in res ? res.result : res); t.onerror = () => no(t.error); t.onabort = () => no(t.error || new Error('Úložiště je plné.')); });
}
const putFile = (id, name, blob) => tx('files', 'readwrite', (st) => st.put(blob, id + '/' + name));
const getFile = (id, name) => tx('files', 'readonly', (st) => st.get(id + '/' + name));
const delFile = (id, name) => tx('files', 'readwrite', (st) => st.delete(id + '/' + name));
async function delFilesOf(id) { const d = await db(); return new Promise((ok) => { const t = d.transaction('files', 'readwrite'); t.objectStore('files').delete(IDBKeyRange.bound(id + '/', id + '/￿')); t.oncomplete = ok; t.onerror = ok; }); }

let sets = null;
async function allSets() { if (!sets) { sets = await tx('sets', 'readonly', (st) => st.getAll()); sets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); } return sets; }
const findSet = (id) => sets.find((s) => s.id === id);
const saveSet = (s) => tx('sets', 'readwrite', (st) => st.put(JSON.parse(JSON.stringify(s))));
async function update(id, fn) {
  await allSets(); const s = findSet(id); if (!s) return null;
  fn(s); s.updatedAt = Date.now(); await saveSet(s);
  const copy = JSON.parse(JSON.stringify(s));
  emit('updated', copy);
  return JSON.parse(JSON.stringify(s));
}

/* ---------- nastavení ---------- */
const DEFAULT_SETTINGS = { model: 'gemini-flash-latest', voiceA: 'Aoede', voiceB: 'Puck', podcastLength: 'stredni' };
const getSettings = () => { try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('nell:settings') || '{}') }; } catch { return { ...DEFAULT_SETTINGS }; } };
const saveSettingsLS = (s) => localStorage.setItem('nell:settings', JSON.stringify(s));
const cleanKey = (k) => String(k || '').replace(/[\u2010-\u2015\u2212]/g, '-').replace(/[^\x21-\x7e]/g, '');
const getKey = () => cleanKey(localStorage.getItem('nell:key'));

/* ---------- obrázky ---------- */
async function toJPEG(file) {
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch {
    bmp = await new Promise((ok, no) => { const u = URL.createObjectURL(file); const im = new Image(); im.onload = () => { ok(im); URL.revokeObjectURL(u); }; im.onerror = () => no(new Error(`${file.name || 'Soubor'} není obrázek, který umím otevřít.`)); im.src = u; });
  }
  const w = bmp.width, h = bmp.height, k = Math.min(1, 2000 / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.82));
}
async function importFiles(id, files) {
  const images = [], errors = [];
  for (const f of files || []) {
    if (!(f instanceof Blob)) continue;
    if (f.type && !f.type.startsWith('image/')) { errors.push(`${f.name} není obrázek.`); continue; }
    try {
      const blob = await toJPEG(f);
      const name = `img-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}.jpg`;
      await putFile(id, name, blob); images.push({ file: name, name: f.name || 'Obrázek' });
    } catch (e) { errors.push(e.message); }
  }
  return { images, errors };
}
function pickFiles() {
  return new Promise((ok) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.onchange = () => { ok([...inp.files]); inp.remove(); };
    inp.addEventListener('cancel', () => { ok([]); inp.remove(); });
    inp.click();
  });
}
async function blobToB64(b) { const buf = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); return btoa(s); }

/* ---------- Gemini ---------- */
const G = 'https://generativelanguage.googleapis.com';
function needKey() { const k = getKey(); if (!k) throw new Error('Chybí Gemini API klíč. Otevři Nastavení a vlož ho – je zdarma z aistudio.google.com/apikey.'); return k; }
async function gfetch(url, opts) {
  let last;
  for (let i = 0; i < 3; i++) {
    try { return await fetch(url, opts); }
    catch (e) { last = e; if (!navigator.onLine) break; await sleep(1500 * (i + 1)); }
  }
  const why = String(last?.message || last || '');
  if (!navigator.onLine) throw new Error('Zařízení je offline – připoj se k internetu a zkus to znovu.');
  throw new Error(`Spojení s Google Gemini se přerušilo (${why || 'neznámý důvod'}). Zkus to znovu – během zpracování nech iPad odemčený a aplikaci otevřenou.`);
}
const retryDelay = (j) => { const d = (j?.error?.details || []).find((x) => x.retryDelay)?.retryDelay; return d ? Math.ceil(parseFloat(d)) : 0; };
const isDaily = (msg) => /per ?day|PerDay|daily/i.test(msg || '');
async function readSSE(res) {
  const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '', text = '', finish = '';
  const eat = (line) => {
    line = line.trim(); if (!line.startsWith('data:')) return;
    try { const j = JSON.parse(line.slice(5)); const c = j.candidates?.[0]; if (!c) return; for (const p of c.content?.parts || []) if (!p.thought && p.text) text += p.text; if (c.finishReason) finish = c.finishReason; } catch {}
  };
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    buf += dec.decode(value, { stream: true }); let i;
    while ((i = buf.indexOf('\n')) >= 0) { eat(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  eat(buf);
  return { text, finish };
}
let wake = null;
async function keepAwake(on) {
  try { if (on && !wake && navigator.wakeLock) wake = await navigator.wakeLock.request('screen'); if (!on && wake) { await wake.release(); wake = null; } } catch {}
}
async function callGemini(parts, { json = false, maxTokens = 32768, temperature = 0.3, onWait } = {}) {
  const key = needKey();
  const models = [getSettings().model, 'gemini-flash-latest', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-flash-lite-latest'].filter((v, i, a) => v && a.indexOf(v) === i);
  let lastErr, thinking = true;
  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await gfetch(`${G}/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { temperature, maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}), ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) } })
      });
      if (res.ok) {
        let out;
        try { out = await readSSE(res); }
        catch (e) { lastErr = new Error(`Spojení s Gemini se během odpovědi přerušilo (${e.message}).`); await sleep(2000); continue; }
        if (out.text) return { text: out.text, model };
        lastErr = new Error('Gemini vrátil prázdnou odpověď' + (out.finish ? ` (${out.finish})` : '') + '.'); break;
      }
      let body = {}; try { body = await res.json(); if (Array.isArray(body)) body = body[0] || {}; } catch {}
      const msg = body.error?.message || '';
      if ((res.status === 400 && /API key/i.test(msg)) || res.status === 401) throw new Error('Google odmítl Gemini klíč (' + res.status + (msg ? ': ' + msg : '') + '). Zkontroluj ho v Nastavení.');
      if (res.status === 403) throw new Error('Gemini klíč nemá přístup (403). Vytvoř nový klíč na aistudio.google.com/apikey.');
      lastErr = new Error(`Gemini ${model}: ${res.status} ${msg}`);
      if (res.status === 400 && /thinking/i.test(msg) && thinking) { thinking = false; attempt--; continue; }
      if (res.status === 429 && !isDaily(msg)) { const d = retryDelay(body) || 20; if (d <= 70) { onWait?.(d); await sleep(d * 1000 + 500); continue; } }
      if (res.status === 404 || res.status === 400 || res.status === 429) break;
      if (res.status >= 500) { await sleep(3000 * (attempt + 1)); continue; }
      break;
    }
  }
  if (lastErr && /\b(503|500|429)\b/.test(lastErr.message)) throw new Error('Servery Gemini jsou teď přetížené nebo je vyčerpaný limit zdarma. Zkus to prosím za chvíli – fotky zůstávají uložené.');
  throw lastErr || new Error('Žádný model Gemini není dostupný.');
}
function extractJSON(text) {
  text = String(text).replace(/^﻿/, '').trim();
  try { const j = JSON.parse(text); return Array.isArray(j) ? j[0] : j; } catch {}
  const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  try { return JSON.parse(raw); } catch { return JSON.parse(raw.replace(/,\s*([}\]])/g, '$1')); }
}

// ---------- prompty ----------
const notesPrompt = (topic) => `Na obrázcích jsou fotky nebo screenshoty ručně psaných studijních poznámek (ze sešitu nebo psané tužkou na iPadu). Poznámky jsou česky (mohou obsahovat odborné, latinské nebo anglické termíny).${topic ? `\nStudentka k nim napsala: „${topic}“.` : ''}

POZOR – co jsou poznámky a co ne:
- Obrázky mohou být screenshoty z iPadu nebo jiné aplikace (GoodNotes, Notability, Poznámky, OneNote, prohlížeč PDF…). Ber v úvahu JEN obsah samotných poznámek.
- Úplně ignoruj rozhraní aplikace: název aplikace, lištu se stavem (čas, baterie, Wi-Fi), panely nástrojů, tlačítka, menu, karty a seznamy dokumentů, názvy souborů, čísla stránek, data úprav, reklamy, notifikace, okraje sešitu a vše, co nenapsala studentka ani to není část studijního materiálu.
- Když je na fotce víc věcí (např. kus jiné stránky, stůl, ruka), vezmi jen čitelný studijní obsah.

Úkol:
1. "prepis": věrně přepiš VEŠKERÝ text z poznámek (jen poznámky, bez textů rozhraní aplikace) v pořadí stránek. Rukopis čti pečlivě; nejisté slovo odvoď z kontextu oboru. Nečitelné místo označ [nečitelné]. Nákresy, schémata a šipky popiš slovy v hranatých závorkách.
2. "nazev": krátký výstižný název látky (max 6 slov). "predmet": obor nebo předmět (např. Biologie, Patologie, Dějepis).
3. "shrnuti": 2–4 věty, o čem látka je a co je na ní nejdůležitější.
4. "sekce": zkrácené poznámky na učení. Zkrať je a zpřehledni, ale NIC důležitého nevynechávej: všechny definice, pojmy, čísla, data, jména, vzorce, příčiny a následky, příznaky, rozdělení, postupy, výjimky. Rozděl je do logických sekcí s nadpisy, v každé sekci "body" = stručné heslovité body (srozumitelné i bez původních poznámek). Klíčová slova v bodech zvýrazni **takto**. Nepřidávej fakta, která v poznámkách nejsou – smíš jen opravit zjevnou chybu a rozepsat zkratku.
5. "pojmy": slovníček 5–20 nejdůležitějších pojmů s krátkým vysvětlením (1 věta).
Když na obrázcích nejsou žádné poznámky, vrať {"chyba":"krátké vysvětlení"}.
Piš česky se správnou diakritikou. Vrať POUZE platný JSON:
{"nazev":"","predmet":"","shrnuti":"","sekce":[{"nadpis":"","body":[""]}],"pojmy":[{"pojem":"","vysvetleni":""}],"prepis":""}`;

const notesText = (s) => `NÁZEV: ${s.title}\nSHRNUTÍ: ${s.notes.summary}\n\n${s.notes.sections.map((x) => `## ${x.heading}\n${x.points.map((p) => '- ' + p).join('\n')}`).join('\n\n')}\n\nPOJMY:\n${(s.notes.terms || []).map((t) => `- ${t.term}: ${t.def}`).join('\n')}\n\nPŮVODNÍ PŘEPIS POZNÁMEK:\n"""\n${s.notes.transcript || ''}\n"""`;

const studyPrompt = (s) => `Jsi skvělá lektorka. Z této látky připrav materiály na učení (česky, se správnou diakritikou).

1. "kviz": 8–15 otázek podle rozsahu látky (pokryj celou látku: definice, porozumění, souvislosti, čísla a fakta). Každá otázka má PŘESNĚ 3 možnosti odpovědí, právě jedna je správná. Špatné možnosti musí být věrohodné (žádné nesmysly), ale jednoznačně špatné. "spravna" = index správné možnosti (0, 1 nebo 2) – střídej pozici správné odpovědi. "vysvetleni" = 1–2 věty, proč je odpověď správná. Možnosti piš bez písmen a) b) c).
2. "karticky": 10–30 učících kartiček. "predni" = krátká otázka nebo pojem (např. „Co je rakovina prostaty?“), "zadni" = správná odpověď, 1–3 věty, srozumitelně.
Vycházej jen z látky. Vrať POUZE platný JSON:
{"kviz":[{"otazka":"","moznosti":["","",""],"spravna":0,"vysvetleni":""}],"karticky":[{"predni":"","zadni":""}]}

LÁTKA:
${notesText(s)}`;

const LEN = { kratky: [450, '3–4 minuty'], stredni: [900, '6–8 minut'], dlouhy: [1500, '10–12 minut'] };
const podcastPrompt = (s, len) => { const [w, t] = LEN[len] || LEN.stredni; return `Napiš scénář českého vzdělávacího podcastu „NELL STUDY“, který studentce srozumitelně vysvětlí celou tuto látku, aby se ji naučila poslechem.

Moderátoři:
- Nela – průvodkyně, látku vysvětluje jasně, vřele a s nadšením.
- Daniel – zvídavý parťák, ptá se na to, na co by se zeptal student, shrnuje vlastními slovy, přidává příklady z praxe a mnemotechnické pomůcky.

Pravidla:
- Vysvětli VŠECHNO důležité z látky (definice, pojmy, čísla, souvislosti), nic podstatného nevynech. Vysvětluj pochopitelně, s příklady a přirovnáními, ale fakta neměň a nevymýšlej.
- Přirozená spisovná čeština, jak se mluví v dobrém podcastu: krátké věty, plynulý rozhovor, občas lehký humor. Žádné odrážky, markdown, emoji ani poznámky v závorkách.
- Čísla, jednotky a zkratky piš tak, jak se mají vyslovit (např. „dvacet procent“, „deset na minus třetí“, zkratku DNA jako „dé en á“). Latinské a odborné termíny ponech, jen je jednou vysvětli.
- Začni krátkým přivítáním („Ahoj, tady NELL STUDY…“) a představením tématu. Na konci shrňte 3–6 nejdůležitějších věcí, které si zapamatovat, a rozlučte se.
- Délka zhruba ${w} slov (asi ${t} poslechu). Jedna replika max. 4 věty.
Vrať POUZE platný JSON: {"repliky":[{"mluvci":"Nela","text":""},{"mluvci":"Daniel","text":""}]}

LÁTKA:
${notesText(s)}`; };



const progress = (id, step, text) => emit('progress', { id, step, text });
const running = new Set();

async function makeNotes(s) {
  const parts = [];
  for (const im of s.images) { const b = await getFile(s.id, im.file); if (b) parts.push({ inline_data: { mime_type: 'image/jpeg', data: await blobToB64(b) } }); }
  if (!parts.length) throw new Error('Nejsou tu žádné fotky poznámek.');
  parts.push({ text: notesPrompt(s.topic) });
  const r = await callGemini(parts, { json: true, temperature: 0.2, onWait: (d) => progress(s.id, 0, `Čekám na limit zdarma (${d} s)…`) });
  const j = extractJSON(r.text);
  if (j.chyba && !(j.sekce || []).length) throw new Error('Na fotkách jsem nenašla poznámky: ' + j.chyba);
  return { title: String(j.nazev || '').trim(), subject: String(j.predmet || '').trim(), notes: {
    summary: String(j.shrnuti || '').trim(),
    sections: (j.sekce || []).map((x) => ({ heading: String(x.nadpis || '').trim(), points: (x.body || []).map(String).filter(Boolean) })).filter((x) => x.points.length),
    terms: (j.pojmy || []).map((t) => ({ term: String(t.pojem || '').trim(), def: String(t.vysvetleni || '').trim() })).filter((t) => t.term),
    transcript: String(j.prepis || '').trim() } };
}
async function makeStudy(s) {
  const r = await callGemini([{ text: studyPrompt(s) }], { json: true, temperature: 0.5, onWait: (d) => progress(s.id, 1, `Čekám na limit zdarma (${d} s)…`) });
  const j = extractJSON(r.text);
  const quiz = (j.kviz || []).map((q) => ({ q: String(q.otazka || '').trim(), options: (q.moznosti || []).slice(0, 3).map((o) => String(o).replace(/^\s*[abc]\)\s*/i, '').trim()), correct: Math.max(0, Math.min(2, parseInt(q.spravna, 10) || 0)), explain: String(q.vysvetleni || '').trim() })).filter((q) => q.q && q.options.length === 3);
  const cards = (j.karticky || []).map((c) => ({ front: String(c.predni || '').trim(), back: String(c.zadni || '').trim() })).filter((c) => c.front && c.back);
  return { quiz, cards };
}
async function makeScript(s, len) {
  const r = await callGemini([{ text: podcastPrompt(s, len) }], { json: true, temperature: 0.8, onWait: (d) => progress(s.id, 2, `Čekám na limit zdarma (${d} s)…`) });
  const j = extractJSON(r.text);
  const lines = (j.repliky || []).map((l) => ({ speaker: /dani|ondr/i.test(l.mluvci) ? 'Daniel' : 'Nela', text: String(l.text || '').replace(/[*_#]/g, '').trim() })).filter((l) => l.text);
  if (lines.length < 2) throw new Error('Scénář podcastu se nepodařilo napsat.');
  return lines;
}

/* ---------- podcast: Gemini TTS ---------- */
const TTS_MODELS = ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts'];
function chunkLines(lines, maxWords = 280) {
  const out = []; let cur = [], words = 0;
  lines.forEach((l, i) => { const w = l.text.split(/\s+/).length; if (cur.length && words + w > maxWords) { out.push(cur); cur = []; words = 0; } cur.push(i); words += w; });
  if (cur.length) out.push(cur); return out;
}
async function ttsChunk(text, onWait) {
  const key = needKey(); const st = getSettings(); let lastErr;
  for (const model of TTS_MODELS) {
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await gfetch(`${G}/v1beta/models/${model}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { multiSpeakerVoiceConfig: { speakerVoiceConfigs: [
          { speaker: 'Nela', voiceConfig: { prebuiltVoiceConfig: { voiceName: st.voiceA || 'Aoede' } } },
          { speaker: 'Daniel', voiceConfig: { prebuiltVoiceConfig: { voiceName: st.voiceB || 'Puck' } } }] } } } })
      });
      if (res.ok) {
        const j = await res.json(); const p = (j.candidates?.[0]?.content?.parts || []).find((x) => x.inlineData || x.inline_data); const d = p && (p.inlineData || p.inline_data);
        if (d?.data) { const bin = atob(d.data); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return { pcm: u, rate: parseInt((/rate=(\d+)/.exec(d.mimeType || d.mime_type || '') || [])[1], 10) || 24000 }; }
        lastErr = new Error('Gemini nevrátil zvuk.'); continue;
      }
      let body = {}; try { body = await res.json(); } catch {}
      const msg = body.error?.message || '';
      if (res.status === 400 && /API key/i.test(msg)) throw new Error('Neplatný Gemini API klíč. Zkontroluj ho v Nastavení.');
      lastErr = new Error(`TTS ${model}: ${res.status} ${msg}`); lastErr.status = res.status; lastErr.daily = isDaily(msg);
      if (res.status === 429 && !isDaily(msg)) { const dl = retryDelay(body) || 25; if (dl <= 90) { onWait?.(dl); await sleep(dl * 1000 + 500); continue; } }
      if (res.status >= 500) { await sleep(4000 * (attempt + 1)); continue; }
      break;
    }
  }
  throw lastErr || new Error('Namluvení se nepovedlo.');
}
function wavHeader(bytes, rate) {
  const b = new ArrayBuffer(44), v = new DataView(b); const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + bytes, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, bytes, true);
  return new Uint8Array(b);
}
function timeLines(lines, idxs, start, dur, seg) {
  const tot = idxs.reduce((a, i) => a + lines[i].text.length + 25, 0) || 1; let t = start;
  for (const i of idxs) { const d = dur * (lines[i].text.length + 25) / tot; seg[i] = [+t.toFixed(2), +(t + d).toFixed(2)]; t += d; }
}
async function podcastGemini(s) {
  const lines = s.podcast.script; const chunks = chunkLines(lines);
  const parts = []; let rate = 24000, t = 0; const seg = [];
  for (let c = 0; c < chunks.length; c++) {
    progress(s.id, 3, `Namlouvám podcast… ${c + 1}/${chunks.length}`);
    const text = `Přečti česky tento rozhovor dvou moderátorů vzdělávacího podcastu NELL STUDY. Mluví přirozeně, vřele a s chutí, se správnou českou výslovností, v klidném srozumitelném tempu – jako kamarádi, kteří si spolu vysvětlují látku.\n\n${chunks[c].map((i) => `${lines[i].speaker === 'Nela' ? 'Nela' : 'Daniel'}: ${lines[i].text}`).join('\n')}`;
    const r = await ttsChunk(text, (d) => progress(s.id, 3, `Čekám na limit zdarma (${d} s), pak namluvím díl ${c + 1}/${chunks.length}…`));
    rate = r.rate; const dur = r.pcm.length / (rate * 2);
    timeLines(lines, chunks[c], t, dur, seg); t += dur; parts.push(r.pcm);
    if (c < chunks.length - 1) { parts.push(new Uint8Array(Math.round(rate * 0.35) * 2)); t += 0.35; }
  }
  const bytes = parts.reduce((a, p) => a + p.length, 0);
  const name = `podcast-${Date.now().toString(36)}.wav`;
  await putFile(s.id, name, new Blob([wavHeader(bytes, rate), ...parts], { type: 'audio/wav' }));
  return { file: name, duration: bytes / (rate * 2), segments: seg, engine: 'gemini' };
}
// záložní: hlas iPadu (čte živě, bez souboru)
function speechPodcast(s) {
  const lines = s.podcast.script; const seg = []; const dur = lines.reduce((a, l) => a + l.text.length, 0) / 14.5;
  timeLines(lines, lines.map((_, i) => i), 0, dur, seg);
  return { file: '', duration: dur, segments: seg, engine: 'speech' };
}
async function voicePodcast(id, engine) {
  const s = findSet(id); const old = s.podcast?.file;
  let res, note = '';
  if (engine === 'mac' || engine === 'speech') res = speechPodcast(s);
  else {
    try { res = await podcastGemini(s); }
    catch (e) {
      if (/API klíč/.test(e.message)) throw e;
      note = e.daily || e.status === 429 ? 'Dnešní limit zdarma na AI hlasy je vyčerpaný, proto podcast čte hlas iPadu. Zítra ho můžeš přegenerovat AI hlasy.' : 'AI hlasy teď nejsou dostupné (' + e.message.slice(0, 140) + '), proto podcast čte hlas iPadu.';
      res = speechPodcast(s);
    }
  }
  if (old && old !== res.file) { try { await delFile(id, old); } catch {} }
  await update(id, (x) => { x.podcast = { ...x.podcast, ...res, status: 'done', error: '', note }; });
}

async function processSet(id, opts = {}) {
  if (running.has(id)) return { ok: false, error: 'Tahle látka se už zpracovává.' };
  running.add(id); keepAwake(true);
  const len = opts.podcastLength || getSettings().podcastLength;
  try {
    needKey();
    await update(id, (s) => { s.status = 'processing'; s.error = ''; });
    let s = findSet(id);
    if (!s.notes) {
      progress(id, 0, 'Čtu tvoje poznámky…');
      const n = await makeNotes(s);
      s = await update(id, (x) => { x.title = n.title || x.title; x.subject = n.subject; x.notes = n.notes; });
    }
    progress(id, 1, 'Připravuju kvíz, kartičky a scénář podcastu…');
    const [study, script] = await Promise.allSettled([makeStudy(s), s.podcast?.script ? Promise.resolve(s.podcast.script) : makeScript(s, len)]);
    if (study.status === 'fulfilled') await update(id, (x) => { x.quiz = study.value.quiz; x.cards = study.value.cards; x.quizStats = null; x.cardState = {}; });
    if (script.status === 'fulfilled') await update(id, (x) => { x.podcast = { ...(x.podcast || {}), script: script.value, length: len, status: 'working', error: '' }; });
    else await update(id, (x) => { x.podcast = { ...(x.podcast || {}), status: 'error', error: script.reason.message }; });
    await update(id, (x) => { x.status = 'done'; x.error = study.status === 'rejected' ? 'Kvíz a kartičky se nepovedly: ' + study.reason.message : ''; });
    if (script.status === 'fulfilled') {
      try { await voicePodcast(id, opts.engine); }
      catch (e) { await update(id, (x) => { x.podcast.status = 'error'; x.podcast.error = e.message; }); }
    }
    return { ok: true };
  } catch (e) {
    await update(id, (x) => { x.status = x.notes ? 'done' : 'error'; x.error = e.message; });
    return { ok: false, error: e.message };
  } finally { running.delete(id); progress(id, -1, ''); if (!running.size) keepAwake(false); }
}

window.nell = {
  web: true,
  getSettings: async () => { const s = getSettings(); return { ...s, hasGemini: !!getKey() }; },
  saveSettings: async (d) => {
    const s = getSettings();
    if (typeof d.model === 'string') s.model = d.model.trim() || DEFAULT_SETTINGS.model;
    for (const k of ['voiceA', 'voiceB', 'podcastLength']) if (typeof d[k] === 'string' && d[k]) s[k] = d[k];
    saveSettingsLS(s);
    if (typeof d.geminiKey === 'string' && cleanKey(d.geminiKey)) localStorage.setItem('nell:key', cleanKey(d.geminiKey));
    if (d.clearKey) localStorage.removeItem('nell:key');
    return true;
  },
  list: async () => {
    const list = await allSets(); let ch = false;
    for (const s of list) {
      if (s.status === 'processing' && !running.has(s.id)) { s.status = s.notes ? 'done' : 'error'; s.error = s.notes ? '' : 'Zpracování se přerušilo (aplikace se zavřela). Zkus to znovu.'; ch = true; await saveSet(s); }
      if (s.podcast?.status === 'working' && !running.has(s.id)) { s.podcast.status = s.podcast.file || s.podcast.engine === 'speech' ? 'done' : 'error'; s.podcast.error = 'Namlouvání se přerušilo – aplikace musí zůstat otevřená.'; await saveSet(s); }
    }
    try { navigator.storage?.persist?.(); } catch {}
    return JSON.parse(JSON.stringify(list));
  },
  create: async (s) => { await allSets(); const n = { ...s, createdAt: Date.now(), updatedAt: Date.now() }; sets.unshift(n); await saveSet(n); return JSON.parse(JSON.stringify(n)); },
  patch: async (id, p) => update(id, (s) => Object.assign(s, p)),
  remove: async (id) => { await allSets(); sets = sets.filter((x) => x.id !== id); await tx('sets', 'readwrite', (st) => st.delete(id)); await delFilesOf(id); return true; },
  pickImages: pickFiles,
  importImages: importFiles,
  pasteImage: async (id) => {
    try {
      const items = await navigator.clipboard.read(); const files = [];
      for (const it of items) { const t = it.types.find((x) => x.startsWith('image/')); if (t) files.push(new File([await it.getType(t)], 'Vložený obrázek', { type: t })); }
      if (!files.length) return { images: [], errors: ['Ve schránce není žádný obrázek.'] };
      return importFiles(id, files);
    } catch { return { images: [], errors: ['Schránku se nepodařilo přečíst. Zkus obrázek vybrat přes „Vybrat fotky“.'] }; }
  },
  importBlobs: importFiles,
  removeImage: async (id, f) => { await delFile(id, f); return true; },
  readFile: async (id, f) => (f ? getFile(id, f) : null),
  pathForFile: (file) => file,
  process: (id, opts) => processSet(id, opts || {}),
  regenStudy: async (id) => {
    try { progress(id, 1, 'Připravuju nový kvíz a kartičky…'); const r = await makeStudy(findSet(id)); await update(id, (x) => { x.quiz = r.quiz; x.cards = r.cards; x.quizStats = null; x.cardState = {}; }); return { ok: true }; }
    catch (e) { return { ok: false, error: e.message }; } finally { progress(id, -1, ''); }
  },
  podcast: async (id, { engine, newScript, length } = {}) => {
    if (running.has(id)) return { ok: false, error: 'Na téhle látce se už pracuje.' };
    running.add(id);
    try {
      if (engine !== 'mac' && engine !== 'speech' || newScript) needKey();
      let s = findSet(id);
      if (newScript || !s.podcast?.script) {
        await update(id, (x) => { x.podcast = { ...(x.podcast || {}), status: 'working', error: '' }; });
        progress(id, 2, 'Píšu scénář podcastu…');
        const sc = await makeScript(s, length || s.podcast?.length || getSettings().podcastLength);
        s = await update(id, (x) => { x.podcast = { ...(x.podcast || {}), script: sc, length: length || x.podcast?.length }; });
      }
      await update(id, (x) => { x.podcast.status = 'working'; x.podcast.error = ''; });
      await voicePodcast(id, engine);
      return { ok: true };
    } catch (e) {
      await update(id, (x) => { x.podcast = { ...(x.podcast || {}), status: x.podcast?.file ? 'done' : 'error', error: e.message }; });
      return { ok: false, error: e.message };
    } finally { running.delete(id); progress(id, -1, ''); }
  },
  running: async () => [...running],
  testKey: async (k) => {
    const key = cleanKey(k) || getKey();
    if (!key) return { ok: false, msg: 'Nejdřív vlož klíč.' };
    try {
      const r = await fetch(`${G}/v1beta/models?pageSize=1`, { headers: { 'x-goog-api-key': key } });
      if (r.ok) return { ok: true, msg: '✓ Klíč funguje, spojení s Gemini je v pořádku.' };
      let m = ''; try { m = (await r.json()).error?.message || ''; } catch {}
      return { ok: false, msg: `Google klíč odmítl (${r.status}${m ? ': ' + m : ''}). Zkopíruj ho celý znovu z aistudio.google.com/apikey – nový klíč začíná „AQ.“, starší „AIza“.` };
    } catch (e) { return { ok: false, msg: `Spojení se nepovedlo (${e.message}). Je zapnutý blokátor reklam, VPN nebo omezení obsahu?` }; }
  },
  exportPodcast: async (id) => {
    const s = findSet(id); if (!s?.podcast?.file) return { ok: false, error: s?.podcast?.engine === 'speech' ? 'Podcast čtený hlasem iPadu nejde uložit do souboru – namluv ho AI hlasy.' : 'Podcast zatím není hotový.' };
    const blob = await getFile(id, s.podcast.file);
    const name = `NELL STUDY – ${(s.title || 'Podcast').replace(/[\/:*?"<>|]/g, '-')}.wav`;
    const file = new File([blob], name, { type: 'audio/wav' });
    try { if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: s.title }); return { ok: true }; } } catch (e) { if (e.name === 'AbortError') return { canceled: true }; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return { ok: true };
  },
  copy: async (t) => { try { await navigator.clipboard.writeText(String(t || '')); } catch {} return true; },
  openExternal: async (u) => { window.open(u, '_blank', 'noopener'); },
  onProgress: (cb) => listeners.progress.push(cb),
  onUpdated: (cb) => listeners.updated.push(cb),
  onMenu: () => {}
};
})();
