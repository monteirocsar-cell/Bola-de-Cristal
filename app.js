// ============ estado ============
let state = {
  view: 'list',        // 'list' | 'detail'
  filterState: 'all',
  query: '',
  site: null,          // site atualmente aberto (preset ou geo ad-hoc)
  dayIdx: 0,
  geoResults: [],
  geoLoading: false,
  geoError: null,
};

const STATES = ['all','ES','RJ','MG','SP'];
const STATE_LABEL = {all:'Todos', ES:'ES', RJ:'RJ', MG:'MG', SP:'SP'};
const WANT_HOURS = [6,8,10,12,14,16,18];
const LEVEL_LABEL = {bom:'Bom pra voar', moderado:'Cuidado', nao:'Não voa', semdado:'Sem dado'};

// ============ util ============
function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,''); }
const kt2kmh = kt => Math.round(kt*1.852);
function dirLabel(dir){
  if (dir==null) return '—';
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(dir/22.5)%16];
}
function weekdayShort(dateStr){
  const d = new Date(dateStr+'T12:00:00');
  return ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()];
}
function fmtDate(dateStr){ return dateStr.slice(8,10)+'/'+dateStr.slice(5,7); }
function todayStr(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ============ heurística de voo ============
function assess(slot){
  if (slot.kmh==null) return {level:'semdado', reasons:['dado indisponível']};
  const kmh = slot.kmh, gust = slot.gkmh;
  const reasons = []; let level = 'bom';
  const chuva = (slot.precipMm && slot.precipMm>=0.3) || (slot.precipProb!=null && slot.precipProb>=60);
  if (chuva){ level='nao'; reasons.push('chuva prevista'); }
  if (kmh > 35){ level='nao'; reasons.push('vento forte, acima do limite seguro'); }
  else if (kmh > 22){ if(level!=='nao') level='moderado'; reasons.push('vento acima do ideal para iniciantes'); }
  if (gust!=null && kmh>8 && gust/kmh > 1.62){ if(level!=='nao') level='moderado'; reasons.push('rajadas fortes / ar mais turbulento'); }
  if (kmh < 6){ if(level==='bom') level='moderado'; reasons.push('vento fraco, pode faltar sustentação'); }
  if (reasons.length===0) reasons.push('condições dentro do esperado para voo');
  return {level, reasons};
}
function dayAssess(day){
  const withWind = (day.slots||[]).filter(s=>s.kmh!=null);
  if (!withWind.length) return {level:'semdado', reasons:['sem dados']};
  const rs = withWind.map(assess);
  if (rs.some(r=>r.level==='nao')) return {level:'nao', reasons:[...new Set(rs.filter(r=>r.level==='nao').flatMap(r=>r.reasons))]};
  if (rs.some(r=>r.level==='moderado')) return {level:'moderado', reasons:[...new Set(rs.filter(r=>r.level==='moderado').flatMap(r=>r.reasons))]};
  return {level:'bom', reasons:['condições dentro do esperado para voo']};
}
function trendText(day){
  const w = (day.slots||[]).filter(s=>s.kmh!=null);
  if (w.length<2) return null;
  const first=w[0].kmh, last=w[w.length-1].kmh;
  const max=Math.max(...w.map(s=>s.kmh)), min=Math.min(...w.map(s=>s.kmh));
  const diff = last-first;
  if (Math.abs(diff)<=4 && (max-min)<=6) return `vento estável ao longo do dia (${min}–${max} km/h)`;
  if (diff>4) return `vento tende a aumentar da manhã pra tarde (${first}→${last} km/h)`;
  return `vento tende a cair ao longo do dia (${first}→${last} km/h)`;
}
function sparkline(values){
  const idxs = values.map((v,i)=>v==null?null:i).filter(i=>i!=null);
  if (idxs.length<2) return '';
  const w=110,h=30,pad=4;
  const vals = idxs.map(i=>values[i]);
  const max=Math.max(...vals), min=Math.min(...vals);
  const range=Math.max(1,max-min);
  const step=(w-2*pad)/(values.length-1);
  const pts = values.map((v,i)=> v==null?null:[pad+i*step, h-pad-((v-min)/range)*(h-2*pad)]);
  const validPts = pts.filter(Boolean);
  const path = validPts.map(p=>p.join(',')).join(' ');
  const last = validPts[validPts.length-1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <polyline points="${path}" fill="none" style="stroke:var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="2.8" style="fill:var(--sun)"/>
  </svg>`;
}

// ============ dados ao vivo (Open-Meteo) ============
function cacheKey(site){ return 'paravoo_v1_' + (site.id || `geo_${site.lat.toFixed(3)}_${site.lon.toFixed(3)}`); }

function parseForecast(json){
  const h = json.hourly;
  const byDate = {};
  for (let i=0;i<h.time.length;i++){
    const iso = h.time[i];
    const date = iso.slice(0,10);
    const hour = parseInt(iso.slice(11,13),10);
    if (!WANT_HOURS.includes(hour)) continue;
    (byDate[date] ||= []).push(i);
  }
  const today = todayStr();
  const nowHour = new Date().getHours();
  const days = Object.keys(byDate).sort().map(date=>{
    let idxs = byDate[date];
    if (date === today) idxs = idxs.filter(i=>parseInt(h.time[i].slice(11,13),10) >= nowHour-1);
    const slots = idxs.map(i=>({
      t: h.time[i].slice(11,16),
      kmh: h.wind_speed_10m?.[i] ?? null,
      gkmh: h.wind_gusts_10m?.[i] ?? null,
      dir: h.wind_direction_10m?.[i] ?? null,
      cloud: h.cloud_cover?.[i] ?? null,
      precipMm: h.precipitation?.[i] ?? null,
      precipProb: h.precipitation_probability?.[i] ?? null,
      temp: h.temperature_2m?.[i] ?? null,
      pressure: h.surface_pressure?.[i] ?? null,
      hum: h.relative_humidity_2m?.[i] ?? null,
    }));
    return {date, wd: weekdayShort(date), slots};
  });
  return {days, elevation: json.elevation, fetchedAt: Date.now()};
}

async function fetchForecast(site){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${site.lat}&longitude=${site.lon}`
    + `&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,cloud_cover,surface_pressure,`
    + `wind_speed_10m,wind_direction_10m,wind_gusts_10m`
    + `&timezone=America%2FSao_Paulo&forecast_days=7&wind_speed_unit=kmh`;
  const key = cacheKey(site);
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP '+res.status);
    const json = await res.json();
    const parsed = parseForecast(json);
    try{ localStorage.setItem(key, JSON.stringify(parsed)); }catch(e){}
    return {ok:true, data:parsed, offline:false};
  }catch(err){
    try{
      const cached = localStorage.getItem(key);
      if (cached) return {ok:true, data:JSON.parse(cached), offline:true};
    }catch(e){}
    return {ok:false, error: err.message||'erro de rede', offline:true};
  }
}

async function geocode(query){
  state.geoLoading = true; state.geoError = null; renderList();
  try{
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=10&language=pt&format=json`;
    const res = await fetch(url);
    const json = await res.json();
    const results = (json.results||[]).filter(r=>r.country_code==='BR');
    state.geoResults = results;
    state.geoLoading = false;
    renderList();
  }catch(err){
    state.geoLoading = false;
    state.geoError = 'Não consegui buscar agora — verifique sua conexão.';
    renderList();
  }
}

// ============ render: lista ============
function matchesFilter(site){
  if (state.filterState!=='all' && site.state!==state.filterState) return false;
  if (state.query.length>=1){
    const q = norm(state.query);
    return norm(site.name).includes(q) || norm(site.city).includes(q) || norm(site.state).includes(q);
  }
  return true;
}

function renderStateChips(){
  const el = document.getElementById('stateChips');
  el.innerHTML = STATES.map(s=>`<button class="chip" data-s="${s}" aria-selected="${state.filterState===s}">${STATE_LABEL[s]}</button>`).join('');
  el.querySelectorAll('.chip').forEach(btn=>btn.addEventListener('click', ()=>{ state.filterState = btn.dataset.s; renderList(); }));
}

function renderList(){
  document.getElementById('listControls').hidden = false;
  document.getElementById('backBtn').hidden = true;
  document.getElementById('pageTag').textContent = 'Levados Fly · rampas do sudeste';
  renderStateChips();
  const app = document.getElementById('app');
  const results = SITES.filter(matchesFilter);
  let html = '';
  if (results.length){
    html += results.map(s=>`
      <div class="site-card" data-id="${s.id}">
        <div>
          <div class="name">${s.name} ${s.coordsApprox?'<span class="tag-pill">coord. aprox.</span>':''}</div>
          <div class="city">${s.city} · ${s.state}${s.altitude?` · ${s.altitude} m`:''}</div>
          ${s.quadrants && s.quadrants.length?`<div class="quad">Quadrantes: ${s.quadrants.join(' / ')}</div>`:''}
        </div>
        <span class="go">›</span>
      </div>`).join('');
  } else {
    html += `<div class="empty-note">Nenhuma rampa da lista corresponde à busca.</div>`;
  }
  if (state.query.trim().length>=3){
    html += `<button class="geo-btn" id="geoSearchBtn">🔎 Buscar “${state.query.trim()}” no Brasil (Open-Meteo)</button>`;
    if (state.geoLoading) html += `<div class="geo-hint"><span class="spinner"></span> buscando…</div>`;
    if (state.geoError) html += `<div class="geo-hint">${state.geoError}</div>`;
    if (state.geoResults.length){
      html += `<div class="section-label">Resultados da busca ao vivo</div>`;
      html += state.geoResults.map((r,i)=>`
        <div class="site-card" data-geo="${i}">
          <div>
            <div class="name">${r.name}</div>
            <div class="city">${[r.admin1,r.country].filter(Boolean).join(' · ')}${r.elevation!=null?` · ${Math.round(r.elevation)} m`:''}</div>
          </div>
          <span class="go">›</span>
        </div>`).join('');
    }
  }
  app.innerHTML = html;
  app.querySelectorAll('.site-card[data-id]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const site = SITES.find(s=>s.id===card.dataset.id);
      openDetail(site);
    });
  });
  app.querySelectorAll('.site-card[data-geo]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const r = state.geoResults[Number(card.dataset.geo)];
      openDetail({
        id:null, name:r.name, city:[r.admin1,r.country].filter(Boolean).join(', '), state:'',
        lat:r.latitude, lon:r.longitude, altitude:r.elevation?Math.round(r.elevation):null,
        coordsApprox:false, category:'geo', quadrants:[],
        note:'Local encontrado por busca ao vivo — sem ficha técnica de rampa de voo livre (verifique se há decolagem segura no local).'
      });
    });
  });
  const geoBtn = document.getElementById('geoSearchBtn');
  if (geoBtn) geoBtn.addEventListener('click', ()=>geocode(state.query.trim()));
}

// ============ render: detalhe ============
async function openDetail(site){
  state.site = site; state.dayIdx = 0; state.view = 'detail';
  document.getElementById('listControls').hidden = true;
  document.getElementById('backBtn').hidden = false;
  document.getElementById('pageTag').textContent = site.state ? `${site.city} · ${site.state}` : site.city;
  const app = document.getElementById('app');
  app.innerHTML = `<div class="notice"><span class="spinner"></span> Buscando previsão ao vivo…</div>` + techCard(site);
  const result = await fetchForecast(site);
  if (state.site !== site) return; // usuário já saiu da tela
  if (!result.ok){
    app.innerHTML = `<div class="notice err">Não consegui buscar a previsão (${result.error}) e ainda não há dados salvos deste local. Verifique sua conexão e tente de novo.</div>` + techCard(site);
    return;
  }
  site._forecast = result.data;
  state.dayIdx = result.data.days.findIndex(d=>d.slots.length>0);
  if (state.dayIdx<0) state.dayIdx = 0;
  renderDetail(result.offline);
}

function techCard(site){
  const rows = [];
  if (site.altitude!=null) rows.push(['Altitude', site.altitude+' m'+(site.coordsApprox?' (aprox.)':'')]);
  rows.push(['Coordenadas', `${site.lat.toFixed(4)}, ${site.lon.toFixed(4)}${site.coordsApprox?' (aproximada)':''}`]);
  if (site.quadrants && site.quadrants.length) rows.push(['Quadrantes favoráveis', site.quadrants.join(' / ')]);
  return `<div class="tech-card">
    <h3 style="font-size:1rem;margin-bottom:8px;">${site.name}</h3>
    ${rows.map(([k,v])=>`<div class="tech-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    ${site.note?`<p style="font-size:.8rem;color:var(--ink-soft);margin:10px 0 0;">${site.note}</p>`:''}
  </div>`;
}

function renderDetail(offline){
  const site = state.site;
  const fc = site._forecast;
  const app = document.getElementById('app');
  if (!fc || !fc.days.length){
    app.innerHTML = `<div class="notice err">Sem dados de previsão para este local.</div>` + techCard(site);
    return;
  }
  const day = fc.days[state.dayIdx];
  const da = dayAssess(day);
  const rep = day.slots.find(s=>s.t==='12:00') || day.slots[Math.floor(day.slots.length/2)] || day.slots[0];
  const kmh=rep?.kmh, gust=rep?.gkmh, dir=rep?.dir;
  const trend = trendText(day);
  const spark = sparkline(day.slots.map(s=>s.kmh));

  let html = '';
  if (offline) html += `<div class="notice">Sem conexão agora — mostrando o último dado salvo (${new Date(fc.fetchedAt).toLocaleString('pt-BR')}).</div>`;
  else html += `<div class="notice ok">Atualizado agora · ${new Date(fc.fetchedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div>`;

  html += `<div class="hero">
    <div class="hero-top">
      <div class="hero-site"><h2>${site.name}</h2><div class="sub">${site.city}${site.state?' · '+site.state:''}${fc.elevation!=null?' · '+Math.round(fc.elevation)+' m (modelo)':''}</div></div>
      <span class="badge ${da.level}"><span class="dot"></span>${LEVEL_LABEL[da.level]}</span>
    </div>
    <div class="hero-metrics">
      <div class="metric"><div class="v mono">${kmh!=null?kmh:'—'}</div><div class="l">km/h</div></div>
      <div class="metric"><div class="v mono">${gust!=null?gust:'—'}</div><div class="l">rajada</div></div>
      <div class="metric"><span class="mono" style="display:inline-block;font-size:1.05rem;transform:rotate(${dir??0}deg);">↑</span><div class="l">${dirLabel(dir)}</div></div>
      <div class="metric"><div class="v mono">${rep?.pressure!=null?Math.round(rep.pressure):'—'}</div><div class="l">hPa</div></div>
      <div class="metric"><div class="v mono">${rep?.hum!=null?Math.round(rep.hum)+'%':'—'}</div><div class="l">umidade</div></div>
    </div>
    <div class="hero-reason"><b>${day.wd} ${fmtDate(day.date)}, ${rep?.t||'—'} (ref.):</b> ${da.reasons.join(' · ')}</div>
    ${trend?`<div class="trend-line">${spark}<span>${trend}</span></div>`:''}
  </div>`;

  html += `<div class="day-tabs">${fc.days.map((d,i)=>`
    <button class="day-tab" data-i="${i}" aria-selected="${i===state.dayIdx}">
      <span class="wd">${i===0?'Hoje':d.wd}</span><span class="dt">${fmtDate(d.date)}</span>
    </button>`).join('')}</div>`;

  html += `<div class="slots">${day.slots.length? day.slots.map(s=>{
    const a = assess(s);
    const extras = [];
    if (s.cloud!=null) extras.push(`☁ ${Math.round(s.cloud)}%`);
    if (s.precipProb!=null && s.precipProb>0) extras.push(`💧 ${Math.round(s.precipProb)}%`);
    if (s.hum!=null) extras.push(`💦 ${Math.round(s.hum)}%`);
    if (s.pressure!=null) extras.push(`${Math.round(s.pressure)} hPa`);
    if (s.temp!=null) extras.push(`${Math.round(s.temp)}°C`);
    return `<div class="slot">
      <div class="time mono">${s.t}</div>
      <div>
        <div class="wind-line">
          <span class="mono" style="display:inline-block;transform:rotate(${s.dir??0}deg);">↑</span>
          <span class="kmh mono">${s.kmh!=null?s.kmh+' km/h':'—'}</span>
          ${s.gkmh!=null?`<span class="gust mono">raj. ${s.gkmh}</span>`:''}
          <span style="font-size:.72rem;color:var(--ink-mute);">${dirLabel(s.dir)}</span>
        </div>
        ${extras.length?`<div class="extra">${extras.map(x=>`<span>${x}</span>`).join('')}</div>`:''}
      </div>
      <span class="pill ${a.level}">${LEVEL_LABEL[a.level]}</span>
    </div>`;
  }).join('') : '<div class="empty-note">Sem mais janelas de luz do dia hoje — veja amanhã.</div>'}</div>`;

  html += techCard(site);

  app.innerHTML = html;
  app.querySelectorAll('.day-tab').forEach(btn=>{
    btn.addEventListener('click', ()=>{ state.dayIdx = Number(btn.dataset.i); renderDetail(offline); });
  });
}

// ============ navegação ============
document.getElementById('backBtn').addEventListener('click', ()=>{
  state.view='list'; state.site=null;
  renderList();
});
document.getElementById('searchInput').addEventListener('input', (e)=>{
  state.query = e.target.value;
  state.geoResults = []; state.geoError = null;
  renderList();
});

// ============ boot ============
renderList();
if ('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}
