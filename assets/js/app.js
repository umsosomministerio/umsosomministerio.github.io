(function(){
  'use strict';

  const STORAGE_KEY='muss-data-override';
  const EMPTY={musicas:[],cultos:[],estudos:[],downloads:[],versiculos:[],recado:{}};
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

  function clone(v){ return JSON.parse(JSON.stringify(v)); }
  function loadData(){
    try{
      const saved=localStorage.getItem(STORAGE_KEY);
      if(saved) return JSON.parse(saved);
    }catch(e){ console.warn('MUSS: dados locais indisponíveis.',e); }
    return clone(window.LOUVOR_DATA||EMPTY);
  }
  const D=loadData();
  D.musicas=D.musicas||[]; D.cultos=D.cultos||[]; D.eventos=D.eventos||[]; D.estudos=D.estudos||[]; D.downloads=D.downloads||[]; D.versiculos=D.versiculos||[]; D.recado=D.recado||{};
  const roles={ministro:'Ministro de louvor',back:'Backs vocais',teclado:'Teclado',guitarra:'Guitarra',violao:'Violão',baixo:'Baixo',bateria:'Bateria'}; const roleOrder=['ministro','back','teclado','guitarra','violao','baixo','bateria'];
  const hoje=()=>new Date().toISOString().slice(0,10);
  function momentoCulto(c){ return new Date(`${c.data}T${c.horario||'00:00'}:00`); }
  function jaPassou(c){ return momentoCulto(c) < new Date(); }
  const cultos=[...D.cultos].sort((a,b)=>String(a.data).localeCompare(String(b.data))||String(a.horario||'').localeCompare(String(b.horario||'')));
  const songMap=new Map(D.musicas.map(m=>[m.id,m]));

  function esc(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function normalizar(v){ return String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }
  function fmt(d){
    const x=new Date(String(d||'')+'T12:00:00');
    if(Number.isNaN(x.getTime())) return {day:'--',mon:'---',weekday:'',full:'Data a definir',human:'Data a definir'};
    const weekday=x.toLocaleDateString('pt-BR',{weekday:'long'});
    const month=x.toLocaleDateString('pt-BR',{month:'long'});
    return {day:String(x.getDate()).padStart(2,'0'),mon:x.toLocaleDateString('pt-BR',{month:'short'}).replace('.','').toUpperCase(),weekday:weekday.toUpperCase(),full:x.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}),human:`${weekday} · ${String(x.getDate()).padStart(2,'0')} de ${month}`};
  }
  function diasAte(dataIso){ const a=new Date(dataIso+'T00:00:00'),b=new Date(); b.setHours(0,0,0,0); return Math.round((a-b)/86400000); }
  function textoContagem(n){ if(n===0)return'É hoje!'; if(n===1)return'É amanhã'; if(n>1)return`Daqui a ${n} dias`; return''; }

  function youtubeId(value){
    if(!value) return '';
    const raw=String(value).trim();
    if(/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    try{
      const u=new URL(raw);
      const host=u.hostname.replace(/^www\./,'').toLowerCase();
      if(host==='youtu.be') return u.pathname.split('/').filter(Boolean)[0]||'';
      if(host==='youtube.com' || host==='m.youtube.com'){
        if(u.searchParams.get('v')) return u.searchParams.get('v');
        const parts=u.pathname.split('/').filter(Boolean);
        if(['shorts','embed','live'].includes(parts[0])) return parts[1]||'';
      }
    }catch(e){}
    return '';
  }
  function youtubeUrl(value){ const id=youtubeId(value); return id?`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`:''; }
  function ytThumb(value){ const id=youtubeId(value); return id?`https://img.youtube.com/vi/${id}/hqdefault.jpg`:''; }

  function songLinks(m){
    const letras=Array.isArray(m?.letras)?m.letras:(m?.letra?[{label:'Letra',url:m.letra}]:[]);
    const cifras=Array.isArray(m?.cifras)?m.cifras:[];
    return {letras:letras.filter(x=>safeUrl(x?.url)),cifras:cifras.filter(x=>safeUrl(x?.url))};
  }
  function songActions(m){
    const ouvir=youtubeUrl(m.ouvir)||m.ouvir;
    const links=songLinks(m);
    return `${ouvir?`<a class="mini track-link track-link-listen" target="_blank" rel="noopener" href="${esc(safeUrl(ouvir))}">▶ Ouvir</a>`:''}${links.letras.map((x,i)=>`<a class="mini track-link track-link-letter" target="_blank" rel="noopener" href="${esc(safeUrl(x.url))}">Aa ${esc(x.label||`Letra ${i+1}`)}</a>`).join('')}${links.cifras.map((x,i)=>`<a class="mini track-link track-link-chord" target="_blank" rel="noopener" href="${esc(safeUrl(x.url))}">♫ ${esc(x.label||`Cifra ${i+1}`)}</a>`).join('')}`;
  }
  function textoSetlistWhats(c){ const f=fmt(c.data); const linhas=(c.setlist||[]).map((id,i)=>{const s=songMap.get(id);return `${i+1}. ${s?s.titulo:'Música #'+id}`}).join('\n'); return encodeURIComponent(`*${c.nome}*\n${f.weekday}\n${String(f.day)} de ${f.mon}${c.horario?' · '+c.horario:''}\n\n${linhas||'Setlist ainda não definido.'}`); }
  function textoEscalaWhats(c){ const f=fmt(c.data); const linhas=Object.entries(c.escala||{}).filter(([,v])=>v&&(!Array.isArray(v)||v.length)).map(([r,v])=>`${roles[r]||r}: ${Array.isArray(v)?v.join(', '):v}`).join('\n'); return encodeURIComponent(`*Escala - ${c.nome}*\n${f.weekday}\n${String(f.day)} de ${f.mon}${c.horario?' · '+c.horario:''}\n\n${linhas||'Escala ainda não definida.'}`); }

  function initHeader(){
    const toggle=$('#menu-toggle'),nav=$('.nav-links');
    if(toggle&&nav) toggle.addEventListener('click',()=>nav.classList.toggle('open'));
    $$('.nav-links a').forEach(a=>{ const href=a.getAttribute('href'); if(href && (location.pathname.endsWith(href)||location.href.endsWith(href))) a.classList.add('active'); });
  }

  function renderHome(){
    const n=cultos.find(c=>!jaPassou(c))||cultos[cultos.length-1];
    const card=$('#next-card');
    if(card){
      if(!n){ card.innerHTML='<div class="next-date"><h3>Nenhum culto cadastrado</h3><p>Adicione o próximo culto pelo editor do MUSS.</p></div>'; }
      else { const f=fmt(n.data),dias=diasAte(n.data),cont=textoContagem(dias); card.innerHTML=`<div class="hero-card-top"><span>Próximo culto</span><span>${esc(n.horario||'')}</span></div><div class="next-date"><div class="date-stack"><span class="weekday">${f.weekday}</span><span class="day">${f.day}</span><span class="month">${f.mon}</span></div><div class="gold-line"></div><h3>${esc(n.nome||'Culto')}</h3><p>${esc(n.local||'Templo principal')}</p>${cont?`<span class="countdown-pill">${cont}</span>`:''}</div>`; }
    }
    const list=$('#home-agenda');
    if(list) list.innerHTML=cultos.filter(c=>!jaPassou(c)).slice(0,4).map(c=>{const f=fmt(c.data);return `<a class="service-row" href="agenda.html"><div class="date-chip"><b>${f.day}</b><small>${f.mon}</small></div><div class="row-main"><strong>${esc(c.nome)}</strong><span>${f.weekday} · ${f.day} de ${f.mon} · ${esc(c.horario||'Horário a definir')} · ${esc(c.local||'Templo principal')}</span></div><span class="tag">${(c.setlist||[]).length} músicas</span></a>`}).join('')||'<p style="color:var(--muted)">Nenhum próximo culto cadastrado.</p>';
  }

  function renderSongs(){
    const grid=$('#songs'); if(!grid)return;
    const q=$('#search'),filter=$('#artist'),ordenar=$('#ordenar'),countEl=$('#count'),viewBtns=$$('.view-toggle button');
    let view=localStorage.getItem('muss-repertorio-view')||'cards';
    const artists=[...new Set(D.musicas.map(x=>x.artista).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    if(filter) filter.innerHTML='<option value="">Todos os artistas</option>'+artists.map(a=>`<option value="${esc(a)}">${esc(a)}</option>`).join('');
    const cardHtml=m=>`<article class="song"><div class="song-top"><span class="number">#${String(m.id).padStart(2,'0')}</span><span class="tag">${m.cifras?.length||0} ${(m.cifras?.length||0)===1?'cifra':'cifras'}</span></div><h3>${esc(m.titulo)}</h3><div class="artist">${esc(m.artista||'Artista não informado')}</div><div class="song-actions">${songActions(m)}</div></article>`;
    const rowHtml=m=>`<div class="song-row"><span class="song-row-num">#${String(m.id).padStart(2,'0')}</span><div class="song-row-main"><strong>${esc(m.titulo)}</strong><span class="artist">${esc(m.artista||'Artista não informado')}</span></div><div class="song-row-actions">${songActions(m)}</div></div>`;
    function draw(){
      const s=normalizar(q?.value||''),a=filter?.value||''; let arr=D.musicas.filter(m=>(!s||normalizar(`${m.titulo} ${m.artista}`).includes(s))&&(!a||m.artista===a));
      if(ordenar?.value==='titulo')arr.sort((x,y)=>x.titulo.localeCompare(y.titulo)); else if(ordenar?.value==='artista')arr.sort((x,y)=>(x.artista||'').localeCompare(y.artista||'')); else arr.sort((x,y)=>Number(x.id)-Number(y.id));
      viewBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===view)); grid.classList.toggle('song-grid',view==='cards');grid.classList.toggle('song-list',view==='list');
      grid.innerHTML=arr.length?(view==='list'?arr.map(rowHtml).join(''):arr.map(cardHtml).join('')):'<div class="panel" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Nenhuma música encontrada.</div>';
      if(countEl)countEl.textContent=`${arr.length} ${arr.length===1?'música':'músicas'}`;
    }
    viewBtns.forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;localStorage.setItem('muss-repertorio-view',view);draw();})); if(q)q.addEventListener('input',draw);if(filter)filter.addEventListener('change',draw);if(ordenar)ordenar.addEventListener('change',draw);draw();
  }

  function renderSetlists(){
    const wrap=$('#cultos');if(!wrap)return; const mode=$('#culto-filter'),search=$('#culto-search'),sorter=$('#culto-sort');
    function draw(){ let arr=[...cultos]; const q=normalizar(search?.value||''); if(mode?.value==='futuros')arr=arr.filter(c=>!jaPassou(c));if(mode?.value==='passados')arr=arr.filter(c=>jaPassou(c));if(q)arr=arr.filter(c=>normalizar(`${c.nome} ${c.culto} ${c.local} ${(c.setlist||[]).map(id=>{const s=songMap.get(id);return s?s.titulo+' '+s.artista:''}).join(' ')}`).includes(q));
      arr.sort((a,b)=>sorter?.value==='antigos'?(String(a.data||'').localeCompare(String(b.data||''))||String(a.horario||'').localeCompare(String(b.horario||''))):(String(b.data||'').localeCompare(String(a.data||''))||String(b.horario||'').localeCompare(String(a.horario||''))));
      wrap.innerHTML=arr.length?arr.map(c=>{const f=fmt(c.data);const songs=(c.setlist||[]).map((id,i)=>{const s=songMap.get(id),acts=s?songActions(s):'';return `<li><span class="track-no">${i+1}</span><div class="track-info"><span>${esc(s?s.titulo:'Música #'+id)}</span>${s?`<span class="track-artist">${esc(s.artista)}</span>`:''}</div>${acts?`<div class="track-actions">${acts}</div>`:''}</li>`}).join('')||'<li style="padding:11px 0;color:var(--muted)">Nenhuma música cadastrada.</li>';return `<article class="culto"><div class="culto-head"><div><div class="date-label"><strong>${f.weekday}</strong><span>${f.day} DE ${f.mon}</span></div><h3>${esc(c.nome)}</h3><p>${esc(c.horario||'Horário a definir')} · ${esc(c.local||'Templo principal')}</p></div><span class="tag">${(c.setlist||[]).length} músicas</span></div><div class="culto-body"><strong>Repertório</strong><ol class="setlist">${songs}</ol><div class="card-actions"><a class="mini" target="_blank" rel="noopener" href="https://wa.me/?text=${textoSetlistWhats(c)}">💬 Compartilhar</a><button class="mini" onclick="window.print()">🖨 Imprimir</button></div></div></article>`}).join(''):'<div class="panel" style="padding:40px;text-align:center;color:var(--muted)">Nenhum culto encontrado.</div>';
    }
    if(mode)mode.addEventListener('change',draw);if(search)search.addEventListener('input',draw);if(sorter)sorter.addEventListener('change',draw);draw();
  }

  function renderEscalas(){
    const wrap=$('#escalas');if(!wrap)return;const mode=$('#escala-filter'),search=$('#escala-search'),sorter=$('#escala-sort'),printWrap=$('#print-escalas'),btnPdf=$('#btn-pdf-escalas');
    function draw(){let arr=[...cultos];const q=normalizar(search?.value||'');if(mode?.value==='futuros')arr=arr.filter(c=>!jaPassou(c));if(mode?.value==='passados')arr=arr.filter(c=>jaPassou(c));if(q)arr=arr.filter(c=>normalizar(`${c.nome} ${Object.values(c.escala||{}).flat().join(' ')} ${(c.setlist||[]).map(id=>songMap.get(id)?.titulo||'').join(' ')}`).includes(q));arr.sort((a,b)=>sorter?.value==='antigos'?(String(a.data||'').localeCompare(String(b.data||''))||String(a.horario||'').localeCompare(String(b.horario||''))):(String(b.data||'').localeCompare(String(a.data||''))||String(b.horario||'').localeCompare(String(a.horario||''))));wrap.innerHTML=arr.length?arr.map(c=>{const f=fmt(c.data);const escHtml=roleOrder.filter(r=>c.escala?.[r]&&(!Array.isArray(c.escala[r])||c.escala[r].length)).map(r=>`<div class="role"><small>${esc(roles[r]||r)}</small><strong>${esc(Array.isArray(c.escala[r])?c.escala[r].join(', '):c.escala[r])}</strong></div>`).join('');return `<article class="culto"><div class="culto-head"><div><div class="date-label"><strong>${f.weekday}</strong><span>${f.day} DE ${f.mon}</span></div><h3>${esc(c.nome)}</h3><p>${esc(c.horario||'Horário a definir')} · ${esc(c.local||'Templo principal')}</p></div></div><div class="culto-body"><div class="escala-grid">${escHtml||'<div class="role"><small>Status</small><strong>Escala ainda não definida</strong></div>'}</div><div class="card-actions"><a class="mini" target="_blank" rel="noopener" href="https://wa.me/?text=${textoEscalaWhats(c)}">💬 Compartilhar</a><button class="mini" onclick="window.print()">🖨 Imprimir</button></div></div></article>`}).join(''):'<div class="panel" style="padding:40px;text-align:center;color:var(--muted)">Nenhum culto encontrado.</div>'}
    function drawPrint(){if(!printWrap)return;const cols=['ministro','back','teclado','guitarra','violao','baixo','bateria'];const colLabels=['Ministro','Back','Teclado','Guitarra','Violão','Baixo','Bateria'];const agora=new Date();const mesRef=agora.getMonth(),anoRef=agora.getFullYear();let doMes=cultos.filter(c=>{const d=new Date(c.data+'T00:00:00');return d.getMonth()===mesRef&&d.getFullYear()===anoRef});if(!doMes.length)doMes=cultos.filter(c=>!jaPassou(c));const nomeMes=agora.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});const nomeMesCap=nomeMes.charAt(0).toUpperCase()+nomeMes.slice(1);const geradoEm=agora.toLocaleDateString('pt-BR');const rows=doMes.map((c,i)=>{const f=fmt(c.data);const passou=jaPassou(c);return `<tr class="${i%2?'zebra':''}${passou?' passado':''}"><td class="col-data"><strong>${f.day}/${f.mon}</strong><br><small>${esc(c.nome)}</small></td><td>${esc(c.horario||'—')}</td>${cols.map(k=>{const v=c.escala?.[k];return `<td>${esc(Array.isArray(v)?v.join(', '):v||'—')}</td>`}).join('')}</tr>`}).join('');printWrap.innerHTML=`<div class="print-header"><img src="assets/img/logo-muss-gold.png" alt="" class="print-logo"><div><h1>Escala — ${esc(nomeMesCap)}</h1><p>MUSS · Ministério Um Só Som · gerado em ${geradoEm}</p></div></div><table class="print-table"><thead><tr><th>Culto</th><th>Hora</th>${colLabels.map(l=>`<th>${l}</th>`).join('')}</tr></thead><tbody>${rows||'<tr><td colspan="9" style="text-align:center;padding:16px">Nenhum culto neste período.</td></tr>'}</tbody></table><p class="print-foot">— falta definir · em cinza: culto já realizado</p>`}
    if(mode)mode.addEventListener('change',draw);if(search)search.addEventListener('input',draw);if(sorter)sorter.addEventListener('change',draw);if(btnPdf)btnPdf.addEventListener('click',()=>window.print());draw();drawPrint();
  }

  function agendaItens(){const cultosAgenda=D.cultos.map(c=>({...c,_agendaTipo:'culto'}));const eventosAgenda=D.eventos.map(e=>({...e,_agendaTipo:'evento'}));return [...cultosAgenda,...eventosAgenda].sort((a,b)=>String(a.data||'').localeCompare(String(b.data||''))||((a.horario||'99:99').localeCompare(b.horario||'99:99'))||String(a.nome||'').localeCompare(String(b.nome||'')));}
  function agendaHora(v){return v||'Horário a definir'}
  function agendaTipo(e){return e._agendaTipo==='culto'?'Culto':(e.tipo||'Evento')}
  function agendaEhEnsaio(e){return e._agendaTipo==='evento'&&normalizar(e.tipo||'').includes('ensaio')}
  function renderAgenda(){const wrap=$('#agenda');if(!wrap)return;const search=$('#agenda-search'),mode=$('#agenda-filter'),sorter=$('#agenda-sort'),viewBtns=$$('#agenda-view button');let sort=sorter?.value||'antigos',view=localStorage.getItem('muss-agenda-view')||'lista';function rowHtml(e){const f=fmt(e.data),ensaio=agendaEhEnsaio(e);return `<a class="agenda-item ${ensaio?'is-ensaio':''}" href="dia.html?data=${encodeURIComponent(e.data)}&tipo=${encodeURIComponent(e._agendaTipo)}&id=${encodeURIComponent(e.id)}"><div class="agenda-date"><b>${f.day}</b><small>${f.mon}</small></div><div class="row-main"><strong>${esc(e.nome)}</strong><span>${f.weekday} · ${f.day} de ${f.mon} · ${esc(agendaHora(e.horario))} · ${esc(e.local||'Templo principal')}</span></div><span class="tag ${ensaio?'tag-ensaio':''}">${esc(agendaTipo(e))}</span></a>`}function cardHtml(e){const f=fmt(e.data),ensaio=agendaEhEnsaio(e);return `<a class="agenda-card-item ${ensaio?'is-ensaio':''}" href="dia.html?data=${encodeURIComponent(e.data)}&tipo=${encodeURIComponent(e._agendaTipo)}&id=${encodeURIComponent(e.id)}"><div class="agenda-card-date"><span class="weekday">${f.weekday}</span><span class="day">${f.day}</span><span class="mon">${f.mon}</span></div><span class="tag ${ensaio?'tag-ensaio':''}">${esc(agendaTipo(e))}</span><h3>${esc(e.nome)}</h3><p>${f.human}</p><div class="agenda-card-meta"><span>🕐 ${esc(agendaHora(e.horario))}</span><span>📍 ${esc(e.local||'Templo principal')}</span></div></a>`}function draw(){let arr=agendaItens();const q=normalizar(search?.value||'');if(mode?.value==='futuros')arr=arr.filter(e=>e._agendaTipo==='evento'?`${e.data}T${e.horario||'23:59'}`>=`${hoje()}T00:00`:!jaPassou(e));if(mode?.value==='passados')arr=arr.filter(e=>e._agendaTipo==='evento'?`${e.data}T${e.horario||'23:59'}`<`${hoje()}T00:00`:jaPassou(e));if(q)arr=arr.filter(e=>normalizar(`${e.nome||''} ${e.local||''} ${e.culto||''} ${e.tipo||''} ${e.descricao||''}`).includes(q));arr.sort((a,b)=>sort==='antigos'?(String(a.data||'').localeCompare(String(b.data||''))||String(a.horario||'99:99').localeCompare(String(b.horario||'99:99'))||String(a.nome||'').localeCompare(String(b.nome||''))):(String(b.data||'').localeCompare(String(a.data||''))||String(b.horario||'99:99').localeCompare(String(a.horario||'99:99'))||String(b.nome||'').localeCompare(String(a.nome||''))));viewBtns.forEach(b=>b.classList.toggle('active',b.dataset.view===view));wrap.classList.toggle('agenda-list',view==='lista');wrap.classList.toggle('agenda-card-grid',view==='cards');wrap.innerHTML=arr.map(view==='cards'?cardHtml:rowHtml).join('')||'<div class="panel" style="padding:40px;text-align:center;color:var(--muted)">Nenhum evento encontrado.</div>'}viewBtns.forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;localStorage.setItem('muss-agenda-view',view);draw()}));if(search)search.addEventListener('input',draw);if(mode)mode.addEventListener('change',draw);if(sorter)sorter.addEventListener('change',()=>{sort=sorter.value;draw()});draw()}
  function textoAgendaWhats(data){const f=fmt(data),itens=agendaItens().filter(e=>e.data===data),linhas=[];itens.forEach(e=>{linhas.push(`*${e.nome||'Evento'}*`);linhas.push(`${agendaHora(e.horario)}${e.local?' · '+e.local:''}`);if(e._agendaTipo==='culto'){const escala=roleOrder.filter(r=>e.escala?.[r]&&(!Array.isArray(e.escala[r])||e.escala[r].length)).map(r=>`• ${roles[r]||r}: ${Array.isArray(e.escala[r])?e.escala[r].join(', '):e.escala[r]}`);if(escala.length){linhas.push('');linhas.push('🎤 ESCALA');linhas.push(...escala)}const songs=(e.setlist||[]).map((id,i)=>{const song=songMap.get(id);return `${i+1}. ${song?song.titulo:'Música #'+id}`});if(songs.length){linhas.push('');linhas.push('🎵 REPERTÓRIO');linhas.push(...songs)}}else {if(e.descricao){linhas.push('');linhas.push(e.descricao)}if(e.culto_id){const vinculado=D.cultos.find(c=>String(c.id)===String(e.culto_id));const songs=(vinculado?.setlist||[]).map((id,i)=>{const song=songMap.get(id);return `${i+1}. ${song?song.titulo:'Música #'+id}`});if(songs.length){linhas.push('');linhas.push('🎵 REPERTÓRIO DO CULTO VINCULADO');linhas.push(...songs)}}}if(e.participantes?.length)linhas.push(`👥 ${e.participantes.join(', ')}`);linhas.push('━━━━━━━━━━━━━━━━')});const d=new Date(data+'T12:00:00');return encodeURIComponent(`📅 *AGENDA — ${f.weekday}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}*\n\n${linhas.join('\n')}`)}
  function textoEventoWhats(e){
    const linhas=[`*${e.nome||'Evento'}*`,`${fmt(e.data).weekday}, ${String(e.data||'').split('-').reverse().join('/')}${e.horario?' · '+e.horario:''}`,e.local?'📍 '+e.local:''];
    if(e._agendaTipo==='culto'){
      const escala=roleOrder.filter(r=>e.escala?.[r]&&(!Array.isArray(e.escala[r])||e.escala[r].length)).map(r=>`• ${roles[r]||r}: ${Array.isArray(e.escala[r])?e.escala[r].join(', '):e.escala[r]}`);
      if(escala.length)linhas.push('','🎤 ESCALA',...escala);
      const songs=(e.setlist||[]).map((id,i)=>{const song=songMap.get(id);return `${i+1}. ${song?song.titulo:'Música #'+id}`});
      if(songs.length)linhas.push('','🎵 REPERTÓRIO',...songs);
    }else{
      if(e.descricao)linhas.push('','📝 '+e.descricao);
      if(e.participantes?.length)linhas.push('','👥 '+e.participantes.join(', '));
      if(e.culto_id){const c=D.cultos.find(x=>String(x.id)===String(e.culto_id));if(c){const escala=roleOrder.filter(r=>c.escala?.[r]&&(!Array.isArray(c.escala[r])||c.escala[r].length)).map(r=>`• ${roles[r]||r}: ${Array.isArray(c.escala[r])?c.escala[r].join(', '):c.escala[r]}`);const songs=(c.setlist||[]).map((id,i)=>{const song=songMap.get(id);return `${i+1}. ${song?song.titulo:'Música #'+id}`});linhas.push('','🔗 CULTO VINCULADO',c.nome);if(escala.length)linhas.push('','🎤 ESCALA',...escala);if(songs.length)linhas.push('','🎵 REPERTÓRIO',...songs);}}
    }
    return encodeURIComponent(linhas.filter(Boolean).join('\n'));
  }

  function renderDia(){
    if(!document.querySelector('[data-dia-page]'))return;
    const params=new URLSearchParams(location.search);
    const data=params.get('data'),tipo=params.get('tipo'),id=params.get('id');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(data||''))return;
    const main=document.querySelector('main');if(!main)return;
    const f=fmt(data),todosDoDia=agendaItens().filter(e=>e.data===data);
    const encontrado=(tipo&&id)?todosDoDia.find(e=>e._agendaTipo===tipo&&String(e.id)===String(id)):null;
    const itens=encontrado?[encontrado]:todosDoDia;
    const escalaHtml=c=>{const rows=roleOrder.filter(r=>c.escala?.[r]&&(!Array.isArray(c.escala[r])||c.escala[r].length)).map(r=>`<div class="agenda-role"><span>${esc(roles[r]||r)}</span><strong>${esc(Array.isArray(c.escala[r])?c.escala[r].join(', '):c.escala[r])}</strong></div>`).join('');return rows||'<div class="agenda-empty-detail">Escala ainda não definida.</div>'};
    const repertorioHtml=c=>{const songs=(c.setlist||[]).map((id,i)=>{const song=songMap.get(id);return `<li><span>${i+1}</span><strong>${esc(song?song.titulo:'Música #'+id)}</strong>${song?.artista?`<small>${esc(song.artista)}</small>`:''}${song?`<div class="track-actions">${songActions(song)}</div>`:''}</li>`}).join('');return songs?`<ol class="agenda-repertoire">${songs}</ol>`:'<div class="agenda-empty-detail">Repertório ainda não definido.</div>'};
    const eventoHtml=e=>{
      const cultoVinculado=e._agendaTipo==='evento'&&e.culto_id?D.cultos.find(c=>String(c.id)===String(e.culto_id)):null;
      const extra=e._agendaTipo==='culto'
        ?`<section class="agenda-detail-section"><h3>🎤 Escala</h3><div class="agenda-roles">${escalaHtml(e)}</div></section><section class="agenda-detail-section"><h3>🎵 Repertório</h3>${repertorioHtml(e)}</section>`
        :`${e.descricao?`<section class="agenda-detail-section"><h3>Detalhes</h3><p class="agenda-detail-description">${esc(e.descricao)}</p></section>`:''}${cultoVinculado?`<section class="agenda-detail-section agenda-linked-cult"><h3>🔗 Culto vinculado</h3><p class="agenda-linked-title"><strong>${esc(cultoVinculado.nome)}</strong> · ${esc(fmt(cultoVinculado.data).human)} · ${esc(cultoVinculado.horario||'Horário a definir')}</p><h4>👥 Escala</h4><div class="agenda-roles">${escalaHtml(cultoVinculado)}</div><h4>🎵 Repertório</h4>${repertorioHtml(cultoVinculado)}</section>`:''}${e.participantes?.length?`<section class="agenda-detail-section"><h3>👥 Participantes</h3><p class="agenda-detail-description">${esc(e.participantes.join(', '))}</p></section>`:''}`;
      return `<article class="agenda-detail-event ${e._agendaTipo==='culto'?'agenda-detail-culto':''}"><div class="agenda-detail-event-head"><div><span class="agenda-event-type">${e._agendaTipo==='culto'?'Culto':esc(e.tipo||'Evento')}</span><h2>${esc(e.nome||'Evento')}</h2><p>🕐 ${esc(agendaHora(e.horario))} · 📍 ${esc(e.local||'Templo principal')}</p></div></div>${extra}</article>`;
    };
    const content=itens.length?itens.map(eventoHtml).join(''):'<div class="panel" style="padding:40px;text-align:center;color:var(--muted)">Nenhum evento cadastrado para este dia.</div>';
    const d=new Date(data+'T12:00:00');
    const tituloHero=encontrado?encontrado.nome:`Agenda do dia`;
    const subtituloHero=encontrado?`${fmt(encontrado.data).human} · ${esc(agendaHora(encontrado.horario))} · ${esc(encontrado.local||'Templo principal')}`:`${itens.length} ${itens.length===1?'compromisso':'compromissos'} programados.`;
    const shareHref=encontrado?`https://wa.me/?text=${textoEventoWhats(encontrado)}`:`https://wa.me/?text=${textoAgendaWhats(data)}`;
    const shareLabel=encontrado?'📲 Compartilhar este evento':'📲 Compartilhar agenda';
    main.innerHTML=`<section class="page-hero agenda-day-hero"><div class="container"><div class="eyebrow"><span class="dot"></span> ${encontrado?'Compromisso':'Agenda do dia'}</div><h1>${encontrado?esc(tituloHero):`📅 ${esc(f.weekday)} — ${esc(String(d.getDate()).padStart(2,'0'))}/${esc(String(d.getMonth()+1).padStart(2,'0'))}/${esc(String(d.getFullYear()))}`}</h1><p>${subtituloHero}</p><div class="agenda-day-actions"><a class="btn btn-secondary" href="agenda.html">← Voltar para agenda</a><a class="btn btn-primary" target="_blank" rel="noopener" href="${shareHref}">${shareLabel}</a></div></div></section><section class="section"><div class="container agenda-day-list">${content}</div></section>`;
  }

  function safeRich(html){const box=document.createElement('div');box.innerHTML=String(html||'');box.querySelectorAll('script,style,iframe,object,embed,form,svg,math').forEach(x=>x.remove());box.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||a.name==='style'||a.name==='srcdoc')el.removeAttribute(a.name)});if(el.tagName==='A'){const h=el.getAttribute('href')||'';if(!/^https?:\/\//i.test(h))el.removeAttribute('href');else{el.setAttribute('target','_blank');el.setAttribute('rel','noopener')}}});return box.innerHTML}

  function renderInspiracao(){const vWrap=$('#versiculo-dia');if(vWrap&&D.versiculos.length){const v=D.versiculos[Math.floor((new Date()-new Date(new Date().getFullYear(),0,0))/86400000)%D.versiculos.length];vWrap.innerHTML=`<p class="verse-text">"${esc(v.texto)}"</p><span class="verse-ref">${esc(v.ref)}</span>`;}const rWrap=$('#recado-lideranca');if(rWrap){if(D.recado.texto){const f=D.recado.data?fmt(D.recado.data).human:'';rWrap.innerHTML=`<p class="recado-text">${esc(D.recado.texto)}</p><span class="recado-autor">— ${esc(D.recado.autor||'Liderança')}${f?' · '+esc(f):''}</span>`;}else rWrap.innerHTML='<p style="color:var(--muted)">Nenhum recado no momento.</p>';}}

  function contentType(e){return ['Vídeo','Artigo','Material'].includes(e?.tipo)?e.tipo:(e?.youtube?'Vídeo':'Artigo')}
  function safeUrl(v){const x=String(v??'').trim();if(!x||x==='#')return x;return /^(https?:\/\/|assets\/|downloads\/)/i.test(x)?x:''}
  function renderBlog(){
    const wrapHome=$('#estudos'),wrapAll=$('#blog-all'),search=$('#estudo-search'),type=$('#estudo-tipo'),sorter=$('#estudo-sort');
    const posts=(D.estudos||[]).slice().sort((a,b)=>String(b.data||'').localeCompare(String(a.data||'')));
    function detailLink(e){return `estudos.html?id=${encodeURIComponent(e.id)}`}
    function card(e){const id=youtubeId(e.youtube),isVideo=!!id,thumb=isVideo?ytThumb(id):(e.img||''),hasText=!!String(e.conteudo||'').trim(),link=isVideo?youtubeUrl(id):detailLink(e);const media=thumb?`<img src="${esc(thumb)}" alt="${esc(e.titulo)}" loading="lazy" onerror="this.remove();this.parentElement.classList.add('media-fallback')">`:`<span class="media-fallback-label">MUSS</span>`;return `<article class="blog-card"><a class="blog-thumb ${thumb?'':'media-fallback'}" href="${esc(link)}" ${isVideo?'target="_blank" rel="noopener"':''}>${media}${isVideo?'<span class="play-badge">▶</span>':''}<span class="type-badge">${esc(contentType(e))}</span></a><div class="blog-body"><div class="blog-meta"><span>${esc(e.data?e.data.split('-').reverse().join('/'):'' )}</span><span>•</span><span>${esc(e.autor||'MUSS')}</span></div><h3>${esc(e.titulo)}</h3><p>${esc(e.desc||'')}</p><div class="blog-actions"><a class="btn btn-secondary" style="width:100%" href="${esc(link)}" ${isVideo?'target="_blank" rel="noopener"':''}>${isVideo?'Assistir →':hasText?'Ler conteúdo →':'Ver conteúdo →'}</a></div></div></article>`}
    function drawAll(){if(!wrapAll)return;const q=normalizar(search?.value||''),t=type?.value||'';let arr=posts.filter(e=>(!q||normalizar(`${e.titulo} ${e.desc||''} ${e.autor||''} ${contentType(e)}`).includes(q))&&(!t||contentType(e)===t));arr.sort((a,b)=>sorter?.value==='antigos'?String(a.data||'').localeCompare(String(b.data||'')):String(b.data||'').localeCompare(String(a.data||'')));wrapAll.innerHTML=arr.map(card).join('')||'<div class="panel" style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted)">Nenhum conteúdo encontrado.</div>';}
    function renderDetail(){const id=new URLSearchParams(location.search).get('id'),e=posts.find(x=>String(x.id)===String(id));if(!e)return false;const main=document.querySelector('main');if(!main)return false;const media=e.youtube?`<div class="content-detail-media"><img src="${esc(ytThumb(e.youtube))}" alt="${esc(e.titulo)}" onerror="this.remove();this.parentElement.classList.add('media-fallback')"></div>`:(e.img?`<div class="content-detail-media"><img src="${esc(e.img)}" alt="${esc(e.titulo)}" onerror="this.remove();this.parentElement.classList.add('media-fallback')"></div>`:'');main.innerHTML=`<section class="page-hero"><div class="container"><div class="eyebrow"><span class="dot"></span> ${esc(contentType(e))}</div><h1>${esc(e.titulo)}</h1><p>${esc(e.desc||'')}</p><div class="content-detail-meta">${esc(e.autor||'MUSS')} · ${esc(e.data?fmt(e.data).human:'')}</div></div></section><section class="section"><div class="container"><article class="content-detail">${media}${e.conteudo?`<div class="content-detail-body">${safeRich(e.conteudo)}</div>`:'<div class="panel">Este conteúdo não possui texto completo. Use o botão abaixo para acessar o material.</div>'}${e.youtube||e.link?`<div class="content-detail-actions">${e.youtube?`<a class="btn btn-primary" href="${esc(youtubeUrl(e.youtube))}" target="_blank" rel="noopener">▶ Assistir no YouTube</a>`:''}${e.link?`<a class="btn btn-secondary" href="${esc(safeUrl(e.link))}" target="_blank" rel="noopener">Abrir link →</a>`:''}</div>`:''}</article><a class="back-link" href="estudos.html">← Voltar para conteúdos</a></div></section>`;return true}
    if(renderDetail())return;
    if(wrapHome)wrapHome.innerHTML=posts.slice(0,3).map(card).join('')||'<p style="color:var(--muted)">Nenhum conteúdo publicado ainda.</p>';if(search)search.addEventListener('input',drawAll);if(type)type.addEventListener('change',drawAll);if(sorter)sorter.addEventListener('change',drawAll);drawAll();
  }
  function renderDownloads(){const w=$('#downloads');if(!w)return;w.innerHTML=(D.downloads||[]).map(d=>`<div class="download-card"><div class="icon">${esc(d.icon||'⬇')}</div><h3>${esc(d.titulo)}</h3><p>${esc(d.desc||'')}</p><a class="btn btn-secondary" href="${esc(safeUrl(d.link)||'#')}">Baixar</a></div>`).join('')||'<div class="panel" style="grid-column:1/-1;text-align:center;color:var(--muted)">Nenhum material disponível.</div>';}
  function renderContato(){const form=$('#contato-form');if(!form)return;const whats=form.dataset.whatsapp||'5500000000000';form.addEventListener('submit',ev=>{ev.preventDefault();const nome=$('#c-nome')?.value.trim()||'',msg=$('#c-mensagem')?.value.trim()||'';window.open(`https://wa.me/${whats}?text=${encodeURIComponent(`Olá! Meu nome é ${nome}.\n${msg}`)}`,'_blank');});}


  function initBackToTop(){if(document.querySelector('.back-to-top'))return;const b=document.createElement('button');b.type='button';b.className='back-to-top';b.setAttribute('aria-label','Voltar ao topo');b.title='Voltar ao topo';b.textContent='↑';document.body.appendChild(b);const toggle=()=>b.classList.toggle('show',window.scrollY>420);window.addEventListener('scroll',toggle,{passive:true});b.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));toggle()}
  initHeader();renderHome();renderInspiracao();renderSongs();renderSetlists();renderEscalas();renderAgenda();renderDia();renderBlog();renderDownloads();renderContato();
})();
