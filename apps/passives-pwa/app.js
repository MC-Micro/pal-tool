
const DATA = window.PALWORLD_PASSIVES_DATA;
function storeGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function storeSet(k,v){try{localStorage.setItem(k,v);}catch(e){}}
const SCORE = Object.fromEntries(DATA.prio_order.map((p,i)=>[p, DATA.prio_order.length-i]));
const state = {query:'', roles:new Set(), statuses:new Set(), ranks:new Set(), priorities:new Set(), sort:'name', panelOpen:false, openGroup:storeGet('pw-open-group') || 'Kampf'};
const els = {
  meta: document.getElementById('metaLine'), q: document.getElementById('q'), filterBtn: document.getElementById('filterBtn'),
  panel: document.getElementById('filterPanel'), sort: document.getElementById('sort'), active: document.getElementById('activeFilters'),
  count: document.getElementById('count'), total: document.getElementById('total'), cards: document.getElementById('cards'), reset: document.getElementById('resetBtn'),
  toTop: document.getElementById('toTop'), roleGroups: document.getElementById('roleGroups'), subrolePanel: document.getElementById('subrolePanel'),
  prioChips: document.getElementById('prioChips'), priorityHint: document.getElementById('priorityHint')
};
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function scoreOf(prio){return SCORE[prio]||0;}
function selectedRoles(){return [...state.roles];}
function shortRole(role){return String(role).split(' / ').pop();}
function rolePairsFor(p, roles){return roles.filter(r=>p.role_priorities && p.role_priorities[r]).map(r=>[r,p.role_priorities[r]]);}
function bestRolePairs(p){
  const entries = Object.entries(p.role_priorities||{});
  if(!entries.length) return [];
  const max = Math.max(...entries.map(([,v])=>scoreOf(v)));
  return entries.filter(([,v])=>scoreOf(v)===max);
}
function priorityInActiveRoles(p){
  const roles=selectedRoles();
  if(!roles.length) return {score:p.top_score||0, pairs:bestRolePairs(p)};
  const pairs=rolePairsFor(p, roles);
  const max=pairs.reduce((m,[,v])=>Math.max(m,scoreOf(v)),0);
  return {score:max, pairs};
}
function setPanel(open){state.panelOpen=open; els.panel.classList.toggle('open',open); els.filterBtn.classList.toggle('on',open); els.filterBtn.textContent=open?'Filter ▲':'Filter ▼'; storeSet('pw-filter-open',open?'1':'0');}
function setOpenGroup(group){state.openGroup=group; storeSet('pw-open-group',group); renderRoleGroups();}
function makeChips(containerId, values, kind){
  const node=document.getElementById(containerId); node.innerHTML='';
  values.forEach(value=>{
    const b=document.createElement('button'); b.type='button'; b.className='filter-chip'; b.textContent=value;
    if(state[kind] && state[kind].has && state[kind].has(value)) b.classList.add('active');
    if(kind==='priorities' && !state.roles.size) b.classList.add('disabled');
    b.addEventListener('click',()=>{
      if(kind==='priorities' && !state.roles.size) return;
      const set=state[kind];
      if(set.has(value)){set.delete(value); b.classList.remove('active');}
      else{set.add(value); b.classList.add('active');}
      updateSortOptions(); updatePriorityChips(); render();
    });
    node.appendChild(b);
  });
}
function renderRoleGroups(){
  els.roleGroups.innerHTML='';
  DATA.role_groups.forEach(g=>{
    const b=document.createElement('button'); b.type='button'; b.className='group-chip'; b.textContent=g.group;
    if(state.openGroup===g.group) b.classList.add('open');
    b.addEventListener('click',()=>setOpenGroup(g.group));
    els.roleGroups.appendChild(b);
  });
  const group=DATA.role_groups.find(g=>g.group===state.openGroup) || DATA.role_groups[0];
  if(!group){els.subrolePanel.classList.remove('open'); return;}
  els.subrolePanel.classList.add('open');
  const chips=group.roles.map(r=>{
    const key=group.group+' / '+r;
    const active=state.roles.has(key) ? ' active' : '';
    return `<button type="button" class="filter-chip role-choice${active}" data-role="${escapeHtml(key)}">${escapeHtml(r)}</button>`;
  }).join('');
  els.subrolePanel.innerHTML=`<div class="subrole-title">${escapeHtml(group.group)} auswählen</div><div class="chip-wrap">${chips}</div>`;
  els.subrolePanel.querySelectorAll('[data-role]').forEach(btn=>btn.addEventListener('click',()=>{
    const role=btn.getAttribute('data-role');
    if(state.roles.has(role)){state.roles.delete(role); btn.classList.remove('active');}
    else{state.roles.add(role); btn.classList.add('active');}
    if(!state.roles.size) state.priorities.clear();
    updateSortOptions(); updatePriorityChips(); render();
  }));
}
function updatePriorityChips(){
  makeChips('prioChips', DATA.prio_order, 'priorities');
  els.prioChips.querySelectorAll('.filter-chip').forEach(b=>{if(state.priorities.has(b.textContent)) b.classList.add('active');});
  els.priorityHint.textContent = state.roles.size ? 'Priorität zählt nur innerhalb der gewählten Rolle(n).' : 'Erst eine Rolle auswählen, dann Prioritäten filtern.';
}
function syncFilterHighlights(){
  document.querySelectorAll('#statusChips .filter-chip').forEach(b=>b.classList.toggle('active', state.statuses.has(b.textContent)));
  document.querySelectorAll('#rankChips .filter-chip').forEach(b=>b.classList.toggle('active', state.ranks.has(b.textContent)));
  document.querySelectorAll('#prioChips .filter-chip').forEach(b=>{
    b.classList.toggle('active', state.priorities.has(b.textContent));
    b.classList.toggle('disabled', !state.roles.size);
  });
  document.querySelectorAll('.role-choice').forEach(b=>b.classList.toggle('active', state.roles.has(b.getAttribute('data-role'))));
}
function removeFilter(kind,value){
  if(kind==='query'){state.query=''; els.q.value=''; return;}
  if(kind==='roles') state.roles.delete(value);
  else if(kind==='statuses') state.statuses.delete(value);
  else if(kind==='ranks') state.ranks.delete(value);
  else if(kind==='priorities') state.priorities.delete(value);
}
function updateSortOptions(){
  const opt=els.sort.querySelector('option[value="context"]');
  const roles=selectedRoles();
  if(!roles.length){
    opt.disabled=true; opt.textContent='Priorität nach Filter';
    if(state.sort==='context'){state.sort='name'; els.sort.value='name';}
  }else{
    opt.disabled=false;
    opt.textContent = roles.length===1 ? 'Priorität: '+roles[0] : 'Priorität: '+roles.length+' aktive Rollen';
  }
}
function passQuery(p){
  if(!state.query) return true;
  const hay=norm([p.de,p.en,p.effect_de,p.effect_en,p.explain,p.notes,p.top_note,(p.tags||[]).join(' ')].join(' '));
  return hay.includes(norm(state.query));
}
function passRoles(p){return !state.roles.size || selectedRoles().some(r=>p.role_priorities && p.role_priorities[r]);}
function passStatuses(p){return !state.statuses.size || state.statuses.has(p.status);}
function passRanks(p){return !state.ranks.size || state.ranks.has(String(p.rank));}
function passPriorities(p){
  if(!state.priorities.size) return true;
  const roles=selectedRoles();
  if(!roles.length) return true;
  return roles.some(r=>state.priorities.has(p.role_priorities?.[r]));
}
function filtered(){return DATA.passives.filter(p=>passQuery(p)&&passRoles(p)&&passStatuses(p)&&passRanks(p)&&passPriorities(p));}
function sortItems(items){
  const arr=[...items]; const byName=(a,b)=>a.de.localeCompare(b.de,'de');
  if(state.sort==='name') arr.sort(byName);
  else if(state.sort==='top') arr.sort((a,b)=>(b.top_score-a.top_score)||(b.rank-a.rank)||byName(a,b));
  else if(state.sort==='rank') arr.sort((a,b)=>(b.rank-a.rank)||byName(a,b));
  else if(state.sort==='context') arr.sort((a,b)=>(priorityInActiveRoles(b).score-priorityInActiveRoles(a).score)||(b.rank-a.rank)||byName(a,b));
  return arr;
}
function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function roleText(role){return role.replace(' / ',' / ');}
function displayRole(role){return role==='Negativ / Meiden' ? 'Negativ' : roleText(role);}
function isMeidenPair(pair){return pair && pair[1]==='Meiden';}
function nonNegativePairs(pairs){return pairs.filter(([r])=>r!=='Negativ / Meiden');}
function compactPairsText(pairs){
  if(!pairs.length) return '';
  const usable=pairs.filter(([r,v])=>!(r==='Negativ / Meiden' && v==='Meiden'));
  const list=usable.length ? usable : pairs;
  const allSame=list.every(([,v])=>v===list[0][1]);
  if(allSame) return `${list.map(([r])=>displayRole(r)).join(' · ')} ${list[0][1]}`;
  return list.map(([r,v])=>`${displayRole(r)} ${v}`).join(' · ');
}
function meidenRoleText(pairs){
  const use=nonNegativePairs(pairs);
  const list=use.length ? use : pairs;
  const roles=[...new Set(list.map(([r])=>displayRole(r)))];
  return roles.join(' · ') || 'Negativ';
}
function roleTokenText(role, priority){
  if(priority==='Meiden'){
    if(role==='Negativ / Meiden') return 'Negativ / Meiden';
    return `Meiden: ${displayRole(role)}`;
  }
  return `${displayRole(role)} ${priority}`;
}
function roleBadgeHtml(p){
  const roles=selectedRoles();
  if(!roles.length){
    const pairs=bestRolePairs(p); if(!pairs.length) return '';
    const maxScore=Math.max(...pairs.map(([,v])=>scoreOf(v)));
    const allMeiden=pairs.every(isMeidenPair);
    const txt = (maxScore<=0 || allMeiden) ? `Meiden: ${meidenRoleText(pairs)}` : compactPairsText(pairs);
    return `<span class="badge role">${escapeHtml(txt)}</span>`;
  }
  const info=priorityInActiveRoles(p); if(!info.pairs.length) return '';
  const allMeiden=info.pairs.every(isMeidenPair);
  const label=allMeiden ? 'Meiden' : (roles.length===1 ? 'Aktiv' : 'Treffer');
  const body=allMeiden ? meidenRoleText(info.pairs) : compactPairsText(info.pairs);
  const txt=`${label}: ${body}`;
  return `<span class="badge role">${escapeHtml(txt)}</span>`;
}
function topBadgeHtml(p){
  if((p.top_score||0)<5) return '';
  return `<span class="badge top-badge">Top ${escapeHtml(p.top_priority)}</span>`;
}
function warningHtml(p){
  if(!p.quality || p.quality==='ok') return '';
  let txt=p.quality==='conflict'?'⚠ Datenlage unsicher / Quellenkonflikt.':p.quality==='unchecked'?'⚠ Muss noch geprüft werden.':'⚠ Datenlage prüfen.';
  return `<div class="warnbox">${escapeHtml(txt)}</div>`;
}
function cardHtml(p){
  const statusClass='status-'+p.status.replace(/[^a-zA-ZÄÖÜäöüß]/g,'');
  const roles=Object.entries(p.role_priorities||{}).map(([r,v])=>`<span class="role-token">${escapeHtml(roleTokenText(r,v))}</span>`).join('');
  const topSection=p.top_note?`<div class="section"><div class="label">Top-Hinweis</div><p>${escapeHtml(p.top_note)}</p></div>`:'';
  const contextBadge=roleBadgeHtml(p);
  const topBadge=topBadgeHtml(p);
  return `<details class="card"><summary><div class="rankbar" title="${escapeHtml(p.rank_label)}"><span class="rank-symbol">${escapeHtml(p.rank_symbol)}</span><span class="rank-label-inline">${escapeHtml(p.rank_label)}</span></div><div class="head"><div class="names"><div class="de">${escapeHtml(p.de)}</div><div class="en">${escapeHtml(p.en)}</div><div class="badges meta-badges"><span class="badge ${statusClass}">${escapeHtml(p.status)}</span>${topBadge}</div>${contextBadge?`<div class="context-row">${contextBadge}</div>`:''}<div class="effect">${escapeHtml(p.effect_de)}</div></div><div class="chev">⌄</div></div></summary><div class="body"><div class="section"><div class="label">Einfach erklärt</div><p>${escapeHtml(p.explain)}</p></div>${topSection}<div class="section"><div class="label">Englischer Effekt</div><p>${escapeHtml(p.effect_en)}</p></div><div class="section"><div class="label">Rollen-Prioritäten</div><div class="role-list">${roles}</div></div>${p.notes?`<div class="section"><div class="label">Notiz</div><p>${escapeHtml(p.notes)}</p></div>`:''}<div class="section"><div class="label">Statushinweis</div><p>${escapeHtml(p.status_note||p.change_reason||'')}</p></div>${warningHtml(p)}</div></details>`;
}
function renderActiveFilters(){
  const pills=[];
  if(state.query) pills.push({kind:'query', value:'', label:'Suche: '+state.query, cls:'dim'});
  state.roles.forEach(x=>pills.push({kind:'roles', value:x, label:'Rolle: '+x, cls:''}));
  state.statuses.forEach(x=>pills.push({kind:'statuses', value:x, label:'Status: '+x, cls:''}));
  state.ranks.forEach(x=>pills.push({kind:'ranks', value:x, label:'Rang: '+x, cls:''}));
  state.priorities.forEach(x=>pills.push({kind:'priorities', value:x, label:'Prio: '+x, cls:''}));
  els.active.innerHTML=pills.map(p=>`<button type="button" class="active-pill ${p.cls}" data-kind="${escapeHtml(p.kind)}" data-value="${escapeHtml(p.value)}" title="Filter entfernen">${escapeHtml(p.label)}</button>`).join('');
}
function render(){
  updateSortOptions(); renderActiveFilters(); renderRoleGroups(); updatePriorityChips(); syncFilterHighlights();
  const items=sortItems(filtered());
  els.count.textContent=items.length; els.total.textContent=DATA.passives.length;
  els.cards.innerHTML = items.length ? items.map(cardHtml).join('') : `<div class="empty"><strong>Keine Treffer.</strong><br>Suchtext oder Filter reduzieren.</div>`;
  wireCardBodyCollapse();
}
function resetFilters(){
  state.roles.clear(); state.statuses.clear(); state.ranks.clear(); state.priorities.clear(); state.query=''; state.sort='name';
  els.q.value=''; els.sort.value='name';
  document.querySelectorAll('.filter-chip.active').forEach(b=>b.classList.remove('active'));
  updateSortOptions(); render();
}
function wireCardBodyCollapse(){
  document.querySelectorAll('.card .body').forEach(body=>{
    let down=0,moved=false;
    body.addEventListener('pointerdown',()=>{down=Date.now();moved=false;});
    body.addEventListener('pointermove',()=>{moved=true;});
    body.addEventListener('click',e=>{
      if(e.target.closest('a,button,input,textarea,select')) return;
      if(window.getSelection && String(window.getSelection()).length) return;
      if(moved || Date.now()-down>450) return;
      const d=body.closest('details'); if(d) d.open=false;
    });
  });
}
function init(){
  els.meta.textContent=`${DATA.meta.project_version} · ${DATA.meta.baseline_version} · ${DATA.passives.length} Passives`;
  makeChips('statusChips',['Aktuell','Neu','Geändert','Korrigiert','Entfernt'],'statuses');
  makeChips('rankChips',['4','3','2','1'],'ranks');
  updatePriorityChips(); renderRoleGroups();
  els.filterBtn.addEventListener('click',()=>setPanel(!state.panelOpen));
  els.reset.addEventListener('click',resetFilters);
  els.active.addEventListener('click',e=>{
    const pill=e.target.closest('.active-pill'); if(!pill) return;
    const kind=pill.getAttribute('data-kind');
    const value=pill.getAttribute('data-value');
    removeFilter(kind,value);
    if(!state.roles.size) state.priorities.clear();
    render();
  });
  els.q.addEventListener('input',e=>{state.query=e.target.value.trim(); render();});
  els.sort.addEventListener('change',e=>{state.sort=e.target.value; render();});
  els.sort.value='name';
  setPanel(state.panelOpen);
  window.addEventListener('scroll',()=>els.toTop.classList.toggle('show',window.scrollY>600));
  els.toTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));
  updateSortOptions(); render();
}
init();


// PWA: Service Worker nur bei http/https registrieren. Beim lokalen file:// Preview bleibt die App normal nutzbar.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
