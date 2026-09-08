
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const FIREBASE_CONFIG = window.STREAMER_ARENA_FIREBASE_CONFIG || null;
const FIREBASE_VERSION = "12.18.0";
const ui = { chessSelected: null, fortyHand: null, fortyTable: new Set() };

const games = [
  {id:"guess", name:"Adivina el juego", icon:"🧩", category:"preguntas", desc:"El host revela pistas y el chat intenta descubrir el videojuego.", tags:["2–100 jugadores","Chat"]},
  {id:"forty", name:"Las 40 / Cuarenta", icon:"🃏", category:"cartas", desc:"Cuarenta con baraja española: emparejar, sumar, escalera, caída, limpia, ronda y cartón.", tags:["2 jugadores","40 puntos"]},
  {id:"chess", name:"Ajedrez", icon:"♟️", category:"estrategia", desc:"Tablero sincronizado para 2 jugadores con movimientos reales de piezas.", tags:["2 jugadores","Estrategia"]},
  {id:"parchis", name:"Parchís", icon:"🎲", category:"estrategia", desc:"Parchís clásico con 4 fichas, seguros, barreras, capturas, pasillo de meta y reglas del 5 y del 6.", tags:["2–4 jugadores","Reglas clásicas"]},
  {id:"oca", name:"Juego de la Oca", icon:"🪿", category:"mesa", desc:"Tablero clásico de 63 casillas con ocas, puentes, posada, pozo, laberinto, cárcel, dados y muerte.", tags:["2–8 jugadores","Juego de mesa"]},
  {id:"racing", name:"Carrera de coches", icon:"🏎️", category:"arcade", desc:"Carrera por turnos con turbo, boxes y gestión de combustible.", tags:["2–8 jugadores","Arcade"]},
  {id:"trivia", name:"Trivia relámpago", icon:"⚡", category:"preguntas", desc:"Preguntas rápidas en multijugador. Al terminar: 25 Coins al ganador y 10 a cada perdedor.", tags:["2–100 jugadores","Rápido"]},
  {id:"emoji", name:"Adivina por emojis", icon:"😎", category:"preguntas", desc:"Modo extra para futuras fases: películas, juegos y personajes por emojis.", tags:["Próximamente","Quiz"]},
  {id:"blackjack", name:"Blackjack", icon:"🂡", category:"cartas", desc:"Preparado para futura ampliación con mesa casino.", tags:["Próximamente","Cartas"]}
];

const guessBank = [
  {answer:"Halo", clues:["El protagonista suele llevar una armadura verde.","Su compañero artificial más famoso es una IA.","La saga enfrenta a la humanidad contra el Covenant.","El protagonista es conocido como Master Chief."]},
  {answer:"Minecraft", clues:["Su mundo está formado por bloques.","Tiene criaturas que aparecen principalmente de noche.","Una criatura verde explota cerca del jugador.","Se puede construir casi cualquier cosa."]},
  {answer:"Grand Theft Auto V", clues:["Tiene tres protagonistas jugables.","Una gran ciudad inspirada en Los Ángeles.","Incluye un modo online enorme.","Uno de sus protagonistas se llama Trevor."]},
  {answer:"Fortnite", clues:["Tiene construcción y combate.","Su mapa cambia por temporadas.","Es famoso por sus colaboraciones.","Su modo más conocido es Battle Royale."]},
  {answer:"Counter-Strike 2", clues:["Terroristas y antiterroristas compiten por rondas.","Hay compra de armas al inicio de ronda.","Uno de los objetivos clásicos es plantar una bomba.","Es la continuación moderna de CS:GO."]}
];

const triviaBank = [
  {q:"¿Qué compañía creó la saga Half-Life?", a:["Valve","Nintendo","Rockstar","Ubisoft"], ok:0},
  {q:"¿Cuál de estos juegos usa una baraja española?", a:["Las 40","Poker Texas","Blackjack","Uno"], ok:0},
  {q:"¿Cuántos palos tiene la baraja española clásica?", a:["4","3","5","6"], ok:0},
  {q:"¿Qué personaje es el protagonista más conocido de Halo?", a:["Master Chief","Kratos","Sonic","Link"], ok:0}
];

const state = {
  profile: JSON.parse(localStorage.getItem("sa_profile") || '{"name":"","coins":0,"gems":0}'),
  roomCode: null,
  room: null,
  myId: localStorage.getItem("sa_id") || (crypto.randomUUID ? crypto.randomUUID() : `u_${Date.now()}_${Math.random().toString(36).slice(2)}`),
  myName: "",
  isHost: false,
  backend: "demo",
  db: null,
  dbApi: null,
  unsubscribe: null,
  channel: null
};
localStorage.setItem("sa_id", state.myId);
// Economy v2: remove the old demo starting balance once. From now on Coins
// are earned only when a match finishes: 25 for the winner, 10 for each loser.
if(localStorage.getItem("sa_economy_v2")!=="1"){
  state.profile.coins=0;
  localStorage.setItem("sa_profile", JSON.stringify(state.profile));
  localStorage.setItem("sa_economy_v2","1");
}

function saveProfile(){ localStorage.setItem("sa_profile", JSON.stringify(state.profile)); renderWallet(); }
function renderWallet(){ $("#coins").textContent = state.profile.coins; $("#gems").textContent = state.profile.gems; $("#modalCoins").textContent = state.profile.coins; $("#modalGems").textContent = state.profile.gems; }
function toast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2400); }
function esc(s=""){ return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function clone(o){ return JSON.parse(JSON.stringify(o)); }
function randomItem(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function now(){ return Date.now(); }
function roomPath(code){ return `rooms/${code}`; }
function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function demoKey(code){ return `sa_room_${code}`; }

function gameCard(g){
  return `<article class="panel game-card" data-game="${g.id}" data-category="${g.category}">
    <div class="game-icon">${g.icon}</div>
    <h3>${g.name}</h3><p>${g.desc}</p>
    <div class="game-meta">${g.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    <span class="play-arrow">→</span>
  </article>`;
}
$("#featuredGames").innerHTML = games.slice(0,5).map(gameCard).join("");
$("#allGames").innerHTML = games.map(gameCard).join("");

function showView(name){
  $$(".view").forEach(v=>v.classList.toggle("active", v.id===`view-${name}`));
  $$(".nav-btn").forEach(v=>v.classList.toggle("active", v.dataset.view===name));
  scrollTo({top:0,behavior:"smooth"});
}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-view-target]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.viewTarget)));
$("#heroCreate").onclick=$("#gamesCreate").onclick=()=>{showView("sala"); setTimeout(()=>$("#hostName").focus(),120)};
$$(".game-card").forEach(c=>c.addEventListener("click",()=>{
  showView("sala");
  const valid = ["guess","forty","chess","parchis","oca","racing","trivia"];
  $("#gameSelector").value = valid.includes(c.dataset.game) ? c.dataset.game : "guess";
}));
$$(".chip").forEach(ch=>ch.onclick=()=>{ $$(".chip").forEach(c=>c.classList.remove("active")); ch.classList.add("active"); const filter=ch.dataset.filter; $$("#allGames .game-card").forEach(c=>c.style.display=(filter==="all"||c.dataset.category===filter)?"":"none"); });

$("#profileBtn").onclick=()=>{ $("#profileName").value=state.profile.name || state.myName; renderWallet(); $("#profileDialog").showModal(); };
$("#saveProfileBtn").onclick=()=>{ state.profile.name=$("#profileName").value.trim(); saveProfile(); toast("Perfil guardado"); };

async function initBackend(){
  if(!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes("PEGA_")){ state.backend="demo"; return; }
  try{
    const appMod=await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    const dbMod=await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-database.js`);
    const app=appMod.initializeApp(FIREBASE_CONFIG);
    state.db=dbMod.getDatabase(app);
    state.dbApi=dbMod;
    state.backend="firebase";
    $("#connectionBadge").textContent="● ONLINE FIREBASE";
    $("#connectionBadge").classList.add("online");
  }catch(err){ console.error(err); toast("Firebase no pudo iniciar; se usa modo demo"); }
}
await initBackend();

function getDemoRoom(code){ return JSON.parse(localStorage.getItem(demoKey(code)) || "null"); }
function setDemoRoom(code, room){ localStorage.setItem(demoKey(code), JSON.stringify(room)); if(state.channel) state.channel.postMessage({type:"room", code}); renderRoom(room); }

async function createRoom(){
  const name=($("#hostName").value||state.profile.name||"Streamer").trim().slice(0,18);
  state.myName=name; state.profile.name=name; saveProfile();
  const code=randomCode();
  const room={
    code, createdAt:now(), hostId:state.myId, status:"lobby", activeGame:"guess",
    locked:false, maxPlayers:20,
    players:{[state.myId]:{name, coins:state.profile.coins, joinedAt:now(), host:true}},
    chat:{}, gameState:null
  };
  if(state.backend==="firebase"){
    const {ref,set}=state.dbApi; await set(ref(state.db, roomPath(code)), room);
  }else{ setupDemoChannel(code); setDemoRoom(code, room); }
  enterRoom(code,true);
}
async function joinRoom(){
  const name=($("#joinName").value||state.profile.name||"Jugador").trim().slice(0,18);
  const code=$("#joinCode").value.trim().toUpperCase();
  if(code.length<4) return toast("Escribe un código de sala");
  state.myName=name; state.profile.name=name; saveProfile();
  if(state.backend==="firebase"){
    const {ref,get,update}=state.dbApi;
    const snap=await get(ref(state.db,roomPath(code)));
    if(!snap.exists()) return toast("Esa sala no existe");
    const room=snap.val();
    if(room.locked) return toast("La sala está bloqueada por el host");
    const playerCount=Object.values(room.players||{}).filter(Boolean).length;
    const maxPlayers=Number(room.maxPlayers||20);
    if(playerCount>=maxPlayers) return toast(`La sala está llena (${maxPlayers} jugadores)`);
    await update(ref(state.db,`${roomPath(code)}/players/${state.myId}`),{name,coins:state.profile.coins,joinedAt:now(),host:false});
  }else{
    const room=getDemoRoom(code); if(!room) return toast("Sala demo no encontrada en este navegador");
    if(room.locked) return toast("La sala está bloqueada por el host");
    const playerCount=Object.values(room.players||{}).filter(Boolean).length;
    const maxPlayers=Number(room.maxPlayers||20);
    if(playerCount>=maxPlayers) return toast(`La sala está llena (${maxPlayers} jugadores)`);
    room.players[state.myId]={name,coins:state.profile.coins,joinedAt:now(),host:false};
    setupDemoChannel(code); setDemoRoom(code,room);
  }
  enterRoom(code,false);
}
$("#createRoomBtn").onclick=createRoom; $("#joinRoomBtn").onclick=joinRoom;
$("#joinCode").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");

function setupDemoChannel(code){
  if(state.channel) state.channel.close();
  state.channel=new BroadcastChannel(`sa_${code}`);
  state.channel.onmessage=()=>{ const r=getDemoRoom(code); if(r) renderRoom(r); };
  window.addEventListener("storage", e=>{ if(e.key===demoKey(code)){ const r=getDemoRoom(code); if(r) renderRoom(r); } });
}
function enterRoom(code,isHost){
  state.roomCode=code; state.isHost=isHost;
  $("#roomGate").classList.add("hidden"); $("#roomLive").classList.remove("hidden");
  $("#roomCode").textContent=code; $("#heroRoomCode").textContent=code; $("#roomTitle").textContent=`Sala ${code}`;
  if(state.backend==="firebase"){
    const {ref,onValue}=state.dbApi;
    if(state.unsubscribe) state.unsubscribe();
    state.unsubscribe = onValue(ref(state.db,roomPath(code)), snap=>{ if(snap.exists()) renderRoom(snap.val()); });
  } else { setupDemoChannel(code); renderRoom(getDemoRoom(code)); }
}
function leaveRoomUi(message){
  if(state.unsubscribe){ state.unsubscribe(); state.unsubscribe=null; }
  state.roomCode=null; state.room=null; state.isHost=false; ui.chessSelected=null;
  $("#roomLive").classList.add("hidden"); $("#roomGate").classList.remove("hidden");
  $("#roomTitle").textContent="Aún no estás en una sala";
  $("#playersList").innerHTML='<div class="empty">Crea o entra en una sala.</div>';
  $("#playerCount").textContent="0";
  if(message) toast(message);
}

function getSortedPlayers(limit=null){
  const entries = Object.entries(state.room?.players||{}).filter(([,p])=>p).sort((a,b)=>(a[1].joinedAt||0)-(b[1].joinedAt||0));
  return limit ? entries.slice(0,limit) : entries;
}
function myPlayerName(){ return state.myName || state.profile.name || "Jugador"; }

function renderRoom(room){
  if(!room) return;
  state.room=room; state.isHost=room.hostId===state.myId;
  const players=room.players||{};
  if(!state.isHost && state.roomCode && !players[state.myId]){ leaveRoomUi("El host te ha expulsado de la sala"); return; }
  const myPlayer=players[state.myId];
  if(myPlayer && Number(myPlayer.coins||0)>Number(state.profile.coins||0)){ state.profile.coins=Number(myPlayer.coins||0); saveProfile(); }

  $("#hostControls").classList.toggle("hidden",!state.isHost);
  $("#gameSelector").value=room.activeGame||"guess";
  $("#maxPlayersSelect").value=String(room.maxPlayers||20);
  $("#lockRoomBtn").textContent=room.locked?"🔒 Desbloquear sala":"🔓 Bloquear sala";
  $("#roomStatusText").textContent=room.locked?"Sala bloqueada":"Sala abierta";
  $("#roomStatusText").classList.toggle("locked", !!room.locked);

  const entries=getSortedPlayers();
  $("#playerCount").textContent=entries.length;
  $("#playersList").innerHTML=entries.map(([id,p])=>`<div class="player">
      <div class="player-left">
        <div class="player-avatar">${p.host?"🎙️":"🎮"}</div>
        <div class="player-info"><b>${esc(p.name)}</b><small>${p.host?"Host":"Jugador"}</small></div>
      </div>
      <div class="player-right">
        <span class="player-coins">${Number(p.coins||0)} 🪙</span>
        ${state.isHost && id!==room.hostId?`<div class="player-actions"><button class="mini-action kick-action" data-player="${id}" title="Expulsar jugador">✕</button></div>`:""}
      </div>
    </div>`).join("") || `<div class="empty">Sin jugadores</div>`;

  if(state.isHost){
    $$(".kick-action",$("#playersList")).forEach(btn=>btn.onclick=async()=>{ const id=btn.dataset.player; const player=(state.room.players||{})[id]; if(!player) return; if(confirm(`¿Expulsar a ${player.name} de la sala?`)){ await updateNested(`players/${id}`,null); toast(`${player.name} ha sido expulsado`); } });
  }

  renderChat(room.chat||{});
  renderStage(room);
}

function renderChat(chat){
  const el=$("#chatMessages");
  const items=Object.values(chat).sort((a,b)=>a.at-b.at).slice(-50);
  el.innerHTML=items.map(m=>`<div class="chat-msg"><b>${esc(m.name)}</b> ${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</small></div>`).join("");
  el.scrollTop=el.scrollHeight;
}
async function updateRoom(patch){
  if(!state.roomCode) return;
  if(state.backend==="firebase"){
    const {ref,update}=state.dbApi; await update(ref(state.db, roomPath(state.roomCode)), patch);
  }else{
    const room=getDemoRoom(state.roomCode); Object.assign(room, patch); setDemoRoom(state.roomCode, room);
  }
}
async function updateNested(path,value){
  if(state.backend==="firebase"){
    const {ref,set}=state.dbApi; await set(ref(state.db, `${roomPath(state.roomCode)}/${path}`), value);
  }else{
    const room=getDemoRoom(state.roomCode); const bits=path.split("/"); let cur=room;
    bits.slice(0,-1).forEach(b=>cur=cur[b]??={});
    const key=bits.at(-1); if(value===null) delete cur[key]; else cur[key]=value; setDemoRoom(state.roomCode, room);
  }
}

$("#copyRoomBtn").onclick=async()=>{ const url=`${location.origin}${location.pathname}?room=${state.roomCode}`; try{ await navigator.clipboard.writeText(url); toast("Enlace copiado"); }catch{ toast(`Código: ${state.roomCode}`); } };
$("#chatForm").onsubmit=async e=>{ e.preventDefault(); const text=$("#chatInput").value.trim(); if(!text||!state.roomCode) return; const id=`m_${now()}_${Math.random().toString(36).slice(2,6)}`; await updateNested(`chat/${id}`, {name:myPlayerName(), text, at:now()}); $("#chatInput").value=""; };
$("#gameSelector").onchange=e=>state.isHost&&updateRoom({activeGame:e.target.value,gameState:null,status:"lobby"});
$("#maxPlayersSelect").onchange=e=>{ if(!state.isHost)return; const maxPlayers=Number(e.target.value||20); const current=Object.values(state.room?.players||{}).filter(Boolean).length; if(maxPlayers<current){ toast(`Ya hay ${current} jugadores conectados`); e.target.value=String(state.room.maxPlayers||20); return; } updateRoom({maxPlayers}); };
$("#lockRoomBtn").onclick=()=>state.isHost&&updateRoom({locked:!state.room?.locked});
$("#cancelGameBtn").onclick=()=>{ if(!state.isHost)return; updateRoom({status:"lobby", gameState:null}); toast("Partida cancelada"); };
$("#startGameBtn").onclick=async()=>{ if(!state.isHost)return; startSelectedGame(); };

function startSelectedGame(){
  const game=$("#gameSelector").value;
  if(game==="guess"){ const q=randomItem(guessBank); updateRoom({activeGame:"guess",status:"playing",gameState:{type:"guess",playerIds:getActivePlayerIds(),answer:q.answer,clues:q.clues,revealed:1,winner:null,rewardsGiven:false,startedAt:now()}}); return; }
  if(game==="trivia"){ const q=randomItem(triviaBank); updateRoom({activeGame:"trivia",status:"playing",gameState:{type:"trivia",playerIds:getActivePlayerIds(),q:q.q,a:q.a,ok:q.ok,winner:null,rewardsGiven:false,startedAt:now()}}); return; }
  if(game==="forty"){ return startFortyGame(); }
  if(game==="chess"){ return startChessGame(); }
  if(game==="parchis"){ return startParchisGame(); }
  if(game==="oca"){ return startOcaGame(); }
  if(game==="racing"){ return startRacingGame(); }
}

function renderStage(room){
  const stage=$("#gameStage"), gs=room.gameState;
  if(!gs){ stage.innerHTML=`<div class="stage-empty"><div class="big">🎲</div><h3>Esperando partida</h3><p>${state.isHost?"Elige un juego y pulsa “Iniciar partida”.":"El host está preparando el siguiente juego."}</p></div>`; return; }
  if(gs.type==="guess") renderGuess(stage,gs);
  if(gs.type==="trivia") renderTrivia(stage,gs);
  if(gs.type==="forty") renderForty(stage,gs);
  if(gs.type==="chess") renderChess(stage,gs);
  if(gs.type==="parchis") renderParchis(stage,gs);
  if(gs.type==="oca") renderOca(stage,gs);
  if(gs.type==="racing") renderRacing(stage,gs);
}

function renderGuess(stage,gs){
  stage.innerHTML=`<div class="guess-wrap"><span class="eyebrow">ADIVINA EL JUEGO</span><h3>¿Qué videojuego es?</h3>
    <div class="clues-list">${gs.clues.map((c,i)=>`<div class="clue-item ${i>=gs.revealed?"locked":""}"><b>Pista ${i+1}</b> · ${esc(c)}</div>`).join("")}</div>
    ${state.isHost&&gs.revealed<gs.clues.length&&!gs.winner?`<button id="revealClue" class="btn ghost">Revelar otra pista</button>`:""}
    ${!gs.winner?`<form id="guessForm" class="guess-form"><input id="guessInput" placeholder="Escribe tu respuesta..." autocomplete="off"><button class="btn primary">Responder</button></form>`:`<div class="answer-reveal">🏆 ${esc(gs.winner)} acertó: ${esc(gs.answer)}</div>`}
  </div>`;
  $("#revealClue")?.addEventListener("click",()=>updateNested("gameState/revealed", Math.min(gs.revealed+1, gs.clues.length)));
  $("#guessForm")?.addEventListener("submit", async e=>{ e.preventDefault(); const answer=$("#guessInput").value.trim().toLowerCase(); if(answer===gs.answer.toLowerCase()){ await updateNested("gameState/winner", myPlayerName()); await awardMatchResult(state.myId, gs.playerIds||getActivePlayerIds()); toast("¡Ganaste! +25 Coins · los demás reciben +10"); } else toast("No es correcto. Sigue intentando."); });
}
function renderTrivia(stage,gs){
  stage.innerHTML=`<div class="trivia-wrap"><span class="eyebrow">TRIVIA RELÁMPAGO</span><h3>${esc(gs.q)}</h3><div class="clues-list">${gs.a.map((a,i)=>`<button class="answer-btn clue-item" data-i="${i}">${String.fromCharCode(65+i)} · ${esc(a)}</button>`).join("")}</div>${gs.winner?`<div class="answer-reveal">🏆 ${esc(gs.winner)} respondió primero.</div>`:""}</div>`;
  $$(".answer-btn", stage).forEach(b=>b.onclick=async()=>{ if(gs.winner) return; if(+b.dataset.i===gs.ok){ await updateNested("gameState/winner", myPlayerName()); await awardMatchResult(state.myId, gs.playerIds||getActivePlayerIds()); toast("¡Ganaste! +25 Coins · los demás reciben +10"); } else toast("Respuesta incorrecta"); });
}

function spanishDeck(){
  const suits=["oros","copas","espadas","bastos"];
  const ranks=[1,2,3,4,5,6,7,10,11,12];
  return suits.flatMap(suit=>ranks.map(rank=>({id:`${suit}-${rank}`,rank,suit})));
}
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function suitShort(s){ return ({oros:"Oros",copas:"Copas",espadas:"Espadas",bastos:"Bastos"})[s]||s; }
function rankName(r){ return ({1:"As",10:"Sota",11:"Caballo",12:"Rey"})[r]||String(r); }
function suitGlyph(s){ return ({oros:"●",copas:"♛",espadas:"†",bastos:"♣"})[s]||"●"; }
function pipCount(rank){ return rank>=1&&rank<=7?rank:1; }
function cardHtml(card, extra=""){
  if(!card) return '<div class="spanish-card back"><div class="back-pattern">SA</div></div>';
  const face=card.rank>=10;
  const pips=Array.from({length:pipCount(card.rank)},(_,i)=>`<i class="pip p${i+1}">${suitGlyph(card.suit)}</i>`).join("");
  const faceMark=card.rank===10?"S":card.rank===11?"C":card.rank===12?"R":"";
  return `<div class="spanish-card suit-${card.suit} ${face?"figure":""} ${extra}">
    <div class="card-corner top"><b>${rankName(card.rank)}</b><span>${suitGlyph(card.suit)}</span></div>
    <div class="card-art">${face?`<div class="figure-medallion"><strong>${faceMark}</strong><small>${rankName(card.rank)}</small><em>${suitShort(card.suit)}</em></div>`:`<div class="pip-field">${pips}</div>`}</div>
    <div class="card-corner bottom"><b>${rankName(card.rank)}</b><span>${suitGlyph(card.suit)}</span></div>
  </div>`;
}
function getActivePlayerIds(limit){ return getSortedPlayers(limit).map(([id])=>id); }
const CUARENTA_ORDER=[1,2,3,4,5,6,7,10,11,12];
function cuarentaNextRank(rank){ const i=CUARENTA_ORDER.indexOf(rank); return i>=0&&i<CUARENTA_ORDER.length-1?CUARENTA_ORDER[i+1]:null; }
function numericCardValue(card){ return card && card.rank>=1&&card.rank<=7 ? card.rank : null; }
function dealCuarentaFive(gs){
  gs.hands=gs.hands||{};
  for(const id of gs.playerIds) gs.hands[id]=(gs.deck||[]).splice(0,5);
  gs.handNumber=(gs.handNumber||0)+1;
  gs.lastLooseCardId=null; gs.lastLoosePlayer=null;
  const messages=[];
  for(const id of gs.playerIds){
    const counts={}; for(const c of gs.hands[id]) counts[c.rank]=(counts[c.rank]||0)+1;
    const four=Object.entries(counts).find(([,n])=>n>=4);
    const three=Object.entries(counts).find(([,n])=>n===3);
    if(four){ gs.score[id]=40; gs.winner=id; gs.phase="finished"; messages.push(`${state.room?.players?.[id]?.name||"Jugador"} recibió doble ronda y gana la partida.`); }
    else if(three && gs.score[id]!==38){ gs.score[id]=Math.min(40,(gs.score[id]||0)+2); messages.push(`${state.room?.players?.[id]?.name||"Jugador"} canta ronda: +2.`); }
  }
  if(messages.length) gs.log=[...messages,...(gs.log||[])].slice(0,30);
}
function startFortyGame(){
  const ids=getActivePlayerIds(2);
  if(ids.length<2) return toast("Para Las 40 / Cuarenta hacen falta 2 jugadores");
  ui.fortyHand=null; ui.fortyTable=new Set();
  const deck=shuffle(spanishDeck());
  const dealer=ids[1], starter=ids[0];
  const gs={type:"forty",playerIds:ids,dealer,currentTurn:starter,deck,hands:{},table:[],captured:Object.fromEntries(ids.map(id=>[id,[]])),score:Object.fromEntries(ids.map(id=>[id,0])),handNumber:0,roundNumber:1,lastLooseCardId:null,lastLoosePlayer:null,phase:"play",winner:null,rewardsGiven:false,log:["Comienza Cuarenta. El primero en llegar a 40 puntos gana."]};
  dealCuarentaFive(gs);
  updateRoom({activeGame:"forty",status:"playing",gameState:gs});
}
function nextCuarentaPlayer(gs,id){ const i=gs.playerIds.indexOf(id); return gs.playerIds[(i+1)%gs.playerIds.length]; }
function selectedCuarentaCards(gs){ return [...ui.fortyTable].map(id=>(gs.table||[]).find(c=>c.id===id)).filter(Boolean); }
function validCuarentaBaseCapture(played,selected){
  if(!played||!selected.length) return false;
  if(selected.length===1 && selected[0].rank===played.rank) return true;
  const pv=numericCardValue(played); if(pv===null) return false;
  if(selected.some(c=>numericCardValue(c)===null)) return false;
  return selected.reduce((s,c)=>s+c.rank,0)===pv;
}
function addCuarentaEscalera(table, playedRank, capturedIds){
  let next=cuarentaNextRank(playedRank); const extra=[];
  while(next!==null){
    const found=table.find(c=>!capturedIds.has(c.id)&&c.rank===next);
    if(!found) break;
    capturedIds.add(found.id); extra.push(found); next=cuarentaNextRank(next);
  }
  return extra;
}
function canScoreCuarenta(gs,id,kind){
  if((gs.score[id]||0)!==38) return true;
  return kind==="caida";
}
function applyCuarentaPoints(gs,id,amount,kind){
  if(!canScoreCuarenta(gs,id,kind)) return 0;
  const before=gs.score[id]||0;
  gs.score[id]=Math.min(40,before+amount);
  return gs.score[id]-before;
}
function checkCuarentaWinner(gs){
  const w=gs.playerIds.find(id=>(gs.score[id]||0)>=40);
  if(w){ gs.winner=w; gs.phase="finished"; return w; }
  return null;
}
function cartonPoints(count){ if(count<20) return 0; if(count===20) return 6; return 6 + 2*Math.ceil((count-20)/2); }
function scoreCuarentaCarton(gs){
  const [a,b]=gs.playerIds; const ca=(gs.captured[a]||[]).length, cb=(gs.captured[b]||[]).length;
  const notes=[];
  if(ca===cb){ if(canScoreCuarenta(gs,gs.dealer,"carton")){ const n=applyCuarentaPoints(gs,gs.dealer,2,"carton"); if(n) notes.push(`${state.room?.players?.[gs.dealer]?.name||"Jugador"}: dos por dar +${n}.`); } }
  else{
    const leader=ca>cb?a:b, count=Math.max(ca,cb);
    if((gs.score[leader]||0)<30 && canScoreCuarenta(gs,leader,"carton")){
      let pts=count>=20?cartonPoints(count):2; const n=applyCuarentaPoints(gs,leader,pts,"carton");
      if(n) notes.push(`${state.room?.players?.[leader]?.name||"Jugador"}: cartón +${n} (${count} cartas).`);
    }
  }
  if(notes.length) gs.log=[...notes,...(gs.log||[])].slice(0,30);
  checkCuarentaWinner(gs);
}
function finishCuarentaRound(gs){
  scoreCuarentaCarton(gs);
  gs.phase=gs.winner?"finished":"roundEnd";
  gs.currentTurn=null;
  return gs;
}
async function continueCuarenta(){
  const gs=clone(state.room.gameState); if(gs.type!=="forty"||gs.winner) return;
  gs.roundNumber=(gs.roundNumber||1)+1;
  gs.dealer=nextCuarentaPlayer(gs,gs.dealer);
  gs.currentTurn=nextCuarentaPlayer(gs,gs.dealer);
  gs.deck=shuffle(spanishDeck()); gs.table=[]; gs.captured=Object.fromEntries(gs.playerIds.map(id=>[id,[]])); gs.hands={}; gs.handNumber=0; gs.phase="play"; gs.lastLooseCardId=null; gs.lastLoosePlayer=null;
  gs.log=[`Comienza la ronda ${gs.roundNumber}.`,...(gs.log||[])].slice(0,30);
  dealCuarentaFive(gs); ui.fortyHand=null; ui.fortyTable=new Set();
  await updateNested("gameState",gs);
}
async function playCuarentaCard(mode){
  const gs=clone(state.room.gameState); const id=state.myId;
  if(gs.type!=="forty"||gs.phase!=="play"||gs.currentTurn!==id) return;
  const hand=gs.hands?.[id]||[]; const idx=ui.fortyHand;
  if(idx===null||!hand[idx]) return toast("Primero selecciona una carta de tu mano");
  const played=hand.splice(idx,1)[0];
  const selected=selectedCuarentaCards(gs);
  if(mode==="capture" && !validCuarentaBaseCapture(played,selected)) return toast("Esa captura no es válida");
  let event=[];
  if(mode==="throw"){
    gs.table=gs.table||[]; gs.table.push(played); gs.lastLooseCardId=played.id; gs.lastLoosePlayer=id;
    event.push(`${myPlayerName()} tira ${rankName(played.rank)} de ${suitShort(played.suit)}.`);
  }else{
    const capturedIds=new Set(selected.map(c=>c.id));
    const wasCaida = selected.length===1 && selected[0].id===gs.lastLooseCardId && gs.lastLoosePlayer && gs.lastLoosePlayer!==id && selected[0].rank===played.rank;
    const escalera=addCuarentaEscalera(gs.table||[],played.rank,capturedIds);
    const taken=(gs.table||[]).filter(c=>capturedIds.has(c.id));
    gs.table=(gs.table||[]).filter(c=>!capturedIds.has(c.id));
    gs.captured[id]=[...(gs.captured[id]||[]),played,...taken];
    let gained=0;
    if(wasCaida){ const n=applyCuarentaPoints(gs,id,2,"caida"); gained+=n; if(n) event.push(`¡CAÍDA! ${myPlayerName()} +${n}.`); }
    const limpia=gs.table.length===0;
    if(limpia){ const n=applyCuarentaPoints(gs,id,2,"limpia"); gained+=n; if(n) event.push(`¡LIMPIA! ${myPlayerName()} +${n}.`); }
    if(escalera.length) event.push(`Escalera: ${escalera.map(c=>rankName(c.rank)).join(" → ")}.`);
    if(!gained) event.push(`${myPlayerName()} captura ${taken.length} carta${taken.length===1?"":"s"}.`);
    gs.lastLooseCardId=null; gs.lastLoosePlayer=null;
    checkCuarentaWinner(gs);
  }
  ui.fortyHand=null; ui.fortyTable=new Set();
  if(gs.winner){ gs.log=[...event,...(gs.log||[])].slice(0,30); await updateNested("gameState",gs); await awardMatchResult(gs.winner,gs.playerIds||[]); return; }
  gs.currentTurn=nextCuarentaPlayer(gs,id);
  gs.log=[...event,...(gs.log||[])].slice(0,30);
  const allEmpty=gs.playerIds.every(pid=>(gs.hands?.[pid]||[]).length===0);
  if(allEmpty){
    if((gs.deck||[]).length>=10){ dealCuarentaFive(gs); gs.currentTurn=nextCuarentaPlayer(gs,gs.dealer); }
    else finishCuarentaRound(gs);
  }
  await updateNested("gameState",gs);
  if(gs.winner) await awardMatchResult(gs.winner,gs.playerIds||[]);
}
function renderForty(stage,gs){
  const ids=gs.playerIds||[]; const me=state.myId; const myTurn=gs.phase==="play"&&gs.currentTurn===me; const myHand=gs.hands?.[me]||[];
  if(ui.fortyHand!==null && !myHand[ui.fortyHand]) ui.fortyHand=null;
  const selectedHand=ui.fortyHand!==null?myHand[ui.fortyHand]:null; const selectedTable=selectedCuarentaCards(gs); const captureValid=selectedHand&&validCuarentaBaseCapture(selectedHand,selectedTable);
  const opponent=ids.find(id=>id!==me);
  stage.innerHTML=`<div class="cuarenta-layout">
    <div class="cuarenta-table">
      <div class="cuarenta-topbar"><div><span class="eyebrow">LAS 40 / CUARENTA</span><h2>${gs.winner?`Ganador: ${esc(state.room.players?.[gs.winner]?.name||"Jugador")}`:`Ronda ${gs.roundNumber||1} · mano ${gs.handNumber||1}`}</h2></div><div class="turn-pill">${gs.currentTurn?`Turno de <b>${esc(state.room.players?.[gs.currentTurn]?.name||"...")}</b>`:gs.phase==="roundEnd"?"Fin de ronda":"Partida terminada"}</div></div>
      <div class="opponent-zone"><div><b>${esc(state.room.players?.[opponent]?.name||"Rival")}</b><small>${(gs.hands?.[opponent]||[]).length} cartas en mano</small></div><div class="opponent-backs">${(gs.hands?.[opponent]||[]).map(()=>cardHtml(null)).join("")}</div></div>
      <div class="cuarenta-felt"><div class="table-label">MESA · selecciona las cartas que quieras capturar</div><div class="cuarenta-table-cards">${(gs.table||[]).map(c=>`<button class="table-card-btn ${ui.fortyTable.has(c.id)?"selected":""}" data-table-card="${c.id}" ${myTurn?"":"disabled"}>${cardHtml(c)}</button>`).join("")||'<div class="empty-table">La mesa está vacía</div>'}</div></div>
      <div class="my-zone"><div class="zone-title"><div><b>${esc(state.room.players?.[me]?.name||"Tú")}</b><small>${myTurn?"Es tu turno":"Espera tu turno"}</small></div><div class="captured-count">Capturadas: <b>${(gs.captured?.[me]||[]).length}</b></div></div><div class="cuarenta-hand">${myHand.map((c,i)=>`<button class="hand-card-btn ${ui.fortyHand===i?"selected":""}" data-hand-card="${i}" ${myTurn?"":"disabled"}>${cardHtml(c)}</button>`).join("")||'<div class="notice">Sin cartas en esta mano.</div>'}</div></div>
      ${myTurn?`<div class="cuarenta-actions"><button id="cuarentaCaptureBtn" class="btn primary" ${captureValid?"":"disabled"}>Capturar</button><button id="cuarentaThrowBtn" class="btn ghost" ${selectedHand?"":"disabled"}>Tirar carta a la mesa</button><span class="capture-help">${selectedHand?(captureValid?"Captura válida. También se recogerá la escalera consecutiva.":"Selecciona una carta igual o una suma que coincida con tu carta."):"Selecciona una carta de tu mano."}</span></div>`:""}
    </div>
    <aside class="cuarenta-panel"><div class="score-board"><span class="eyebrow">MARCADOR · META 40</span>${ids.map(pid=>`<div class="cuarenta-score ${gs.currentTurn===pid?"active":""}"><span>${esc(state.room.players?.[pid]?.name||"Jugador")}</span><strong>${gs.score?.[pid]||0}</strong><small>${(gs.captured?.[pid]||[]).length} capturadas</small></div>`).join("")}</div><div class="rules-mini"><b>Cómo capturar</b><p>Iguala una carta del mismo valor o, con cartas del 1 al 7, selecciona una suma que dé el valor de tu carta. Después se aplica automáticamente la escalera.</p><div class="rule-badges"><span>Caída +2</span><span>Limpia +2</span><span>Ronda +2</span><span>Meta 40</span></div></div>${gs.phase==="roundEnd"&&state.isHost?`<button id="cuarentaNextRound" class="btn primary full">Repartir nueva ronda</button>`:""}${gs.winner?`<div class="winner-banner">🏆 ${esc(state.room.players?.[gs.winner]?.name||"Jugador")} gana +25 Coins · el rival recibe +10</div>`:""}<div><span class="eyebrow">EVENTOS</span><div class="race-log">${(gs.log||[]).map(m=>`<div class="race-log-item">${esc(m)}</div>`).join("")}</div></div></aside>
  </div>`;
  $$("[data-hand-card]",stage).forEach(btn=>btn.onclick=()=>{ ui.fortyHand=+btn.dataset.handCard; ui.fortyTable=new Set(); renderForty(stage,gs); });
  $$("[data-table-card]",stage).forEach(btn=>btn.onclick=()=>{ const id=btn.dataset.tableCard; if(ui.fortyTable.has(id)) ui.fortyTable.delete(id); else ui.fortyTable.add(id); renderForty(stage,gs); });
  $("#cuarentaCaptureBtn")?.addEventListener("click",()=>playCuarentaCard("capture"));
  $("#cuarentaThrowBtn")?.addEventListener("click",()=>playCuarentaCard("throw"));
  $("#cuarentaNextRound")?.addEventListener("click",continueCuarenta);
}

const pieceIcons = { wr:"♖",wn:"♘",wb:"♗",wq:"♕",wk:"♔",wp:"♙", br:"♜",bn:"♞",bb:"♝",bq:"♛",bk:"♚",bp:"♟" };
const chessPieceNames={p:"Peón",r:"Torre",n:"Caballo",b:"Alfil",q:"Dama",k:"Rey"};
const chessFiles="abcdefgh";

function startChessGame(){
  const ids=getActivePlayerIds(2);
  if(ids.length<2) return toast("Para ajedrez hacen falta 2 jugadores");
  ui.chessSelected=null;
  const board=[
    "br","bn","bb","bq","bk","bb","bn","br",
    "bp","bp","bp","bp","bp","bp","bp","bp",
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    "wp","wp","wp","wp","wp","wp","wp","wp",
    "wr","wn","wb","wq","wk","wb","wn","wr"
  ];
  updateRoom({activeGame:"chess",status:"playing",gameState:{
    type:"chess",white:ids[0],black:ids[1],board,turn:"white",history:[],winner:null,
    result:null,rewardsGiven:false,
    castling:{whiteK:true,whiteQ:true,blackK:true,blackQ:true}
  }});
}
function pieceColor(piece){ return piece ? (piece[0]==='w'?'white':'black') : null; }
function pieceType(piece){ return piece ? piece[1] : null; }
function oppositeChessColor(color){ return color==='white'?'black':'white'; }
function idxToRC(i){ return [Math.floor(i/8), i%8]; }
function rcToIdx(r,c){ return r*8+c; }
function inside(r,c){ return r>=0&&r<8&&c>=0&&c<8; }
function chessSquareName(i){ const [r,c]=idxToRC(i); return `${chessFiles[c]}${8-r}`; }
function chessKingIndex(board,color){ return board.findIndex(p=>p===(color==='white'?'wk':'bk')); }

function isSquareAttacked(board,target,byColor){
  for(let i=0;i<64;i++){
    const piece=board[i]; if(!piece||pieceColor(piece)!==byColor) continue;
    const [r,c]=idxToRC(i), type=pieceType(piece);
    if(type==='p'){
      const dir=byColor==='white'?-1:1;
      for(const dc of [-1,1]){ const rr=r+dir,cc=c+dc; if(inside(rr,cc)&&rcToIdx(rr,cc)===target) return true; }
    }else if(type==='n'){
      for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
        const rr=r+dr,cc=c+dc; if(inside(rr,cc)&&rcToIdx(rr,cc)===target) return true;
      }
    }else if(type==='k'){
      for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc){ const rr=r+dr,cc=c+dc; if(inside(rr,cc)&&rcToIdx(rr,cc)===target) return true; }
    }else{
      const dirs=[];
      if(type==='b'||type==='q') dirs.push([-1,-1],[-1,1],[1,-1],[1,1]);
      if(type==='r'||type==='q') dirs.push([-1,0],[1,0],[0,-1],[0,1]);
      for(const [dr,dc] of dirs){
        let rr=r+dr,cc=c+dc;
        while(inside(rr,cc)){
          const idx=rcToIdx(rr,cc);
          if(idx===target) return true;
          if(board[idx]) break;
          rr+=dr; cc+=dc;
        }
      }
    }
  }
  return false;
}
function chessInCheck(board,color){
  const king=chessKingIndex(board,color);
  return king>=0 && isSquareAttacked(board,king,oppositeChessColor(color));
}
function canCastleChess(board,color,side,gs){
  const rights=gs.castling||{};
  const enemy=oppositeChessColor(color);
  if(color==='white'){
    if(board[60]!=='wk') return false;
    if(chessInCheck(board,'white')) return false;
    if(side==='K') return !!rights.whiteK && board[63]==='wr' && !board[61]&&!board[62] && !isSquareAttacked(board,61,enemy) && !isSquareAttacked(board,62,enemy);
    return !!rights.whiteQ && board[56]==='wr' && !board[59]&&!board[58]&&!board[57] && !isSquareAttacked(board,59,enemy) && !isSquareAttacked(board,58,enemy);
  }
  if(board[4]!=='bk') return false;
  if(chessInCheck(board,'black')) return false;
  if(side==='K') return !!rights.blackK && board[7]==='br' && !board[5]&&!board[6] && !isSquareAttacked(board,5,enemy) && !isSquareAttacked(board,6,enemy);
  return !!rights.blackQ && board[0]==='br' && !board[3]&&!board[2]&&!board[1] && !isSquareAttacked(board,3,enemy) && !isSquareAttacked(board,2,enemy);
}
function pseudoChessMoves(board,from,gs){
  const piece=board[from]; if(!piece) return [];
  const color=pieceColor(piece), enemy=oppositeChessColor(color), type=pieceType(piece);
  const [r,c]=idxToRC(from), moves=[];
  const add=(rr,cc)=>{
    if(!inside(rr,cc)) return;
    const idx=rcToIdx(rr,cc), target=board[idx];
    if(!target) moves.push(idx);
    else if(pieceColor(target)===enemy && pieceType(target)!=='k') moves.push(idx);
  };
  if(type==='p'){
    const dir=color==='white'?-1:1, start=color==='white'?6:1;
    const one=r+dir;
    if(inside(one,c)&&!board[rcToIdx(one,c)]){
      moves.push(rcToIdx(one,c));
      const two=r+dir*2;
      if(r===start&&inside(two,c)&&!board[rcToIdx(two,c)]) moves.push(rcToIdx(two,c));
    }
    for(const dc of [-1,1]){
      const rr=r+dir,cc=c+dc;
      if(inside(rr,cc)){
        const idx=rcToIdx(rr,cc), target=board[idx];
        if(target&&pieceColor(target)===enemy&&pieceType(target)!=='k') moves.push(idx);
      }
    }
  }
  if(type==='n') for(const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,c+dc);
  if(type==='k'){
    for(let dr=-1;dr<=1;dr++) for(let dc=-1;dc<=1;dc++) if(dr||dc) add(r+dr,c+dc);
    if(color==='white'&&from===60){ if(canCastleChess(board,color,'K',gs)) moves.push(62); if(canCastleChess(board,color,'Q',gs)) moves.push(58); }
    if(color==='black'&&from===4){ if(canCastleChess(board,color,'K',gs)) moves.push(6); if(canCastleChess(board,color,'Q',gs)) moves.push(2); }
  }
  const slide=(dirs)=>{
    for(const [dr,dc] of dirs){
      let rr=r+dr,cc=c+dc;
      while(inside(rr,cc)){
        const idx=rcToIdx(rr,cc), target=board[idx];
        if(!target) moves.push(idx);
        else{ if(pieceColor(target)===enemy&&pieceType(target)!=='k') moves.push(idx); break; }
        rr+=dr; cc+=dc;
      }
    }
  };
  if(type==='b'||type==='q') slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  if(type==='r'||type==='q') slide([[-1,0],[1,0],[0,-1],[0,1]]);
  return moves;
}
function simulateChessMove(board,from,to){
  const b=[...board], moving=b[from];
  b[to]=moving; b[from]=null;
  if(moving==='wk'&&from===60&&to===62){ b[61]='wr'; b[63]=null; }
  if(moving==='wk'&&from===60&&to===58){ b[59]='wr'; b[56]=null; }
  if(moving==='bk'&&from===4&&to===6){ b[5]='br'; b[7]=null; }
  if(moving==='bk'&&from===4&&to===2){ b[3]='br'; b[0]=null; }
  return b;
}
function legalMoves(board,from,gs=state.room?.gameState){
  const piece=board[from]; if(!piece) return [];
  const color=pieceColor(piece);
  return pseudoChessMoves(board,from,gs||{}).filter(to=>!chessInCheck(simulateChessMove(board,from,to),color));
}
function chessHasLegalMove(board,color,gs){
  for(let i=0;i<64;i++) if(board[i]&&pieceColor(board[i])===color&&legalMoves(board,i,gs).length) return true;
  return false;
}
function updateCastlingRights(rights,moving,from,captured,to){
  const r={whiteK:rights?.whiteK!==false,whiteQ:rights?.whiteQ!==false,blackK:rights?.blackK!==false,blackQ:rights?.blackQ!==false};
  if(moving==='wk'){ r.whiteK=false; r.whiteQ=false; }
  if(moving==='bk'){ r.blackK=false; r.blackQ=false; }
  if(moving==='wr'&&from===63) r.whiteK=false;
  if(moving==='wr'&&from===56) r.whiteQ=false;
  if(moving==='br'&&from===7) r.blackK=false;
  if(moving==='br'&&from===0) r.blackQ=false;
  if(captured==='wr'&&to===63) r.whiteK=false;
  if(captured==='wr'&&to===56) r.whiteQ=false;
  if(captured==='br'&&to===7) r.blackK=false;
  if(captured==='br'&&to===0) r.blackQ=false;
  return r;
}
function myChessColor(gs){ return state.myId===gs.white?"white":state.myId===gs.black?"black":null; }
function chessMoveNotation(moving,from,to,captured,isCastle,promotion=null,suffix=""){
  if(isCastle) return (to===62||to===6?'O-O':'O-O-O')+suffix;
  const letter={p:"",r:"T",n:"C",b:"A",q:"D",k:"R"}[pieceType(moving)]||"";
  return `${letter}${chessSquareName(from)}${captured?'×':'–'}${chessSquareName(to)}${promotion?`=${promotion.toUpperCase()}`:""}${suffix}`;
}
async function finalizeChessMove(gs,board,moving,from,to,captured,isCastle,promotion=null){
  const moverColor=pieceColor(moving), next=oppositeChessColor(moverColor);
  const temp={...gs,board,turn:next,pendingPromotion:null};
  const inCheck=chessInCheck(board,next);
  const hasMoves=chessHasLegalMove(board,next,temp);
  let winner=null,result=null,suffix="";
  if(inCheck&&!hasMoves){ winner=moverColor; result="checkmate"; suffix="#"; }
  else if(inCheck){ result="check"; suffix="+"; }
  else if(!hasMoves){ result="stalemate"; }
  const history=[chessMoveNotation(moving,from,to,captured,isCastle,promotion,suffix), ...(gs.history||[])].slice(0,80);
  const nextGs={...temp,history,winner,result};
  await updateNested("gameState",nextGs);
  if(winner){
    const winnerId=winner==='white'?gs.white:gs.black;
    await awardMatchResult(winnerId,[gs.white,gs.black]);
    toast("Jaque mate · ganador +25 Coins · perdedor +10");
  }
}
async function clickChessSquare(index){
  const gs=state.room.gameState;
  if(!gs||gs.type!=="chess"||gs.winner||gs.result==='stalemate') return;
  if(gs.pendingPromotion){ toast("Primero hay que elegir la promoción del peón"); return; }
  const myColor=myChessColor(gs);
  if(!myColor){ toast("Ahora mismo eres espectador"); return; }
  if(gs.turn!==myColor){ toast("Es el turno del rival"); return; }
  const board=Array.from({length:64},(_,i)=>gs.board?.[i]??null), selected=ui.chessSelected, piece=board[index];
  if(selected===null){ if(piece&&pieceColor(piece)===myColor){ ui.chessSelected=index; renderStage(state.room); } return; }
  if(selected===index){ ui.chessSelected=null; renderStage(state.room); return; }
  if(piece&&pieceColor(piece)===myColor){ ui.chessSelected=index; renderStage(state.room); return; }
  const moves=legalMoves(board,selected,gs);
  if(!moves.includes(index)){ toast("Movimiento no válido o dejaría al rey en jaque"); return; }

  const moving=board[selected], captured=board[index]||null, isCastle=pieceType(moving)==='k'&&Math.abs(index-selected)===2;
  const newBoard=simulateChessMove(board,selected,index);
  const castling=updateCastlingRights(gs.castling,moving,selected,captured,index);
  ui.chessSelected=null;
  const [row]=idxToRC(index);
  const promotionNeeded=(moving==='wp'&&row===0)||(moving==='bp'&&row===7);
  if(promotionNeeded){
    await updateNested("gameState",{...gs,board:newBoard,castling,pendingPromotion:{playerId:state.myId,color:myColor,square:index,from:selected,to:index,captured:!!captured,moving},result:null});
    return;
  }
  await finalizeChessMove({...gs,castling},newBoard,moving,selected,index,captured,isCastle,null);
}
async function promoteChessPawn(type){
  const gs=clone(state.room.gameState), pending=gs.pendingPromotion;
  if(!pending||pending.playerId!==state.myId) return;
  if(!['q','r','b','n'].includes(type)) return;
  const board=Array.from({length:64},(_,i)=>gs.board?.[i]??null);
  board[pending.square]=(pending.color==='white'?'w':'b')+type;
  const moving=pending.moving||((pending.color==='white'?'w':'b')+'p');
  const captured=pending.captured?'captured':null;
  gs.pendingPromotion=null;
  await finalizeChessMove(gs,board,moving,pending.from,pending.to,captured,false,type);
}
function renderChess(stage,gs){
  const board=Array.from({length:64},(_,i)=>gs.board?.[i]??null);
  const selected=ui.chessSelected;
  const valid=selected!==null?legalMoves(board,selected,gs):[];
  const myColor=myChessColor(gs);
  const flipped=myColor==='black';
  const displayIndices=Array.from({length:64},(_,i)=>flipped?63-i:i);
  const currentCheck=chessInCheck(board,gs.turn);
  const whiteName=esc(state.room.players?.[gs.white]?.name||'Jugador 1');
  const blackName=esc(state.room.players?.[gs.black]?.name||'Jugador 2');
  const status=gs.winner
    ? `Jaque mate · gana ${gs.winner==='white'?whiteName:blackName}`
    : gs.result==='stalemate' ? 'Tablas por ahogado' : currentCheck ? `Jaque al rey ${gs.turn==='white'?'blanco':'negro'}` : 'Partida en curso';

  stage.innerHTML=`<div class="chess-pro-layout">
    <div class="chess-main">
      <div class="game-info-bar"><div><span class="eyebrow">AJEDREZ CLÁSICO</span><h2>${status}</h2></div><div class="turn-pill">Turno: <b>${gs.turn==='white'?'Blancas':'Negras'}</b></div></div>
      <div class="chess-player-strip top"><span>${flipped?whiteName:blackName}</span><b>${flipped?'⚪ Blancas':'⚫ Negras'}</b></div>
      <div class="chess-board-frame">
        <div class="chess-board-pro">${displayIndices.map((actual,pos)=>{
          const piece=board[actual], [r,c]=idxToRC(actual), displayRow=Math.floor(pos/8), displayCol=pos%8;
          const light=(r+c)%2===0;
          const extra=[selected===actual?'selected':'',valid.includes(actual)?'legal':'',currentCheck&&actual===chessKingIndex(board,gs.turn)?'in-check':''].join(' ');
          const fileLabel=displayRow===7?`<span class="coord file">${chessFiles[c]}</span>`:'';
          const rankLabel=displayCol===0?`<span class="coord rank">${8-r}</span>`:'';
          return `<button class="chess-square ${light?'light':'dark'} ${extra}" data-cell="${actual}" aria-label="${chessSquareName(actual)}">${rankLabel}${fileLabel}<span class="chess-piece-pro ${piece?`piece-${pieceColor(piece)}`:''}">${piece?pieceIcons[piece]:''}</span></button>`;
        }).join('')}</div>
      </div>
      <div class="chess-player-strip bottom"><span>${flipped?blackName:whiteName}</span><b>${flipped?'⚫ Negras':'⚪ Blancas'}</b></div>
      ${gs.pendingPromotion?`<div class="promotion-panel"><div><b>Promoción del peón</b><small>${gs.pendingPromotion.playerId===state.myId?'Elige la pieza nueva.':'Esperando al jugador...'}</small></div>${gs.pendingPromotion.playerId===state.myId?`<div class="promotion-actions"><button data-promote="q">${pieceIcons[(gs.pendingPromotion.color==='white'?'w':'b')+'q']} Dama</button><button data-promote="r">${pieceIcons[(gs.pendingPromotion.color==='white'?'w':'b')+'r']} Torre</button><button data-promote="b">${pieceIcons[(gs.pendingPromotion.color==='white'?'w':'b')+'b']} Alfil</button><button data-promote="n">${pieceIcons[(gs.pendingPromotion.color==='white'?'w':'b')+'n']} Caballo</button></div>`:''}</div>`:''}
    </div>
    <aside class="chess-side-pro">
      <div class="chess-card"><span class="eyebrow">JUGADORES</span><div class="chess-player-row"><span>⚪ ${whiteName}</span>${gs.turn==='white'?'<b>Turno</b>':''}</div><div class="chess-player-row"><span>⚫ ${blackName}</span>${gs.turn==='black'?'<b>Turno</b>':''}</div><div class="chess-player-row"><span>Tu lado</span><b>${myColor?myColor==='white'?'Blancas':'Negras':'Espectador'}</b></div></div>
      <div class="chess-card"><span class="eyebrow">REGLAS ACTIVAS</span><div class="rule-chip">✓ Movimientos legales</div><div class="rule-chip">✓ Jaque y jaque mate</div><div class="rule-chip">✓ Enroque corto y largo</div><div class="rule-chip">✓ Promoción de peón</div><div class="rule-chip">✓ El rey no puede quedar en jaque</div></div>
      <div class="chess-card"><span class="eyebrow">HISTORIAL</span><div class="history-list chess-history">${(gs.history||[]).map((m,i)=>`<div class="history-item"><b>${(gs.history||[]).length-i}.</b> ${esc(m)}</div>`).join('')||'<div class="history-item">Aún no hay movimientos.</div>'}</div></div>
      ${currentCheck&&!gs.winner?'<div class="chess-alert">⚠ JAQUE</div>':''}
      ${gs.winner?`<div class="winner-banner">🏆 Ganador +25 Coins · perdedor +10 Coins</div>`:''}
      ${gs.result==='stalemate'?'<div class="notice">Partida terminada en tablas por ahogado. No se reparten premios de victoria/derrota.</div>':''}
    </aside>
  </div>`;
  $$(".chess-square",stage).forEach(btn=>btn.onclick=()=>clickChessSquare(+btn.dataset.cell));
  $$('[data-promote]',stage).forEach(btn=>btn.onclick=()=>promoteChessPawn(btn.dataset.promote));
}

const PARCHIS_COLORS=["red","blue","yellow","green"];
const PARCHIS_START_CELL={red:39,blue:22,yellow:5,green:56};
const PARCHIS_SAFE_CELLS=new Set([5,12,17,22,29,34,39,46,51,56,63,68]);
const PARCHIS_TRACK=68;
const PARCHIS_GOAL=75;

function buildParchisTrackCoords(){
  // Tablero 19 x 19. Cada una de las 68 casillas del recorrido exterior
  // tiene una coordenada visual única. La versión anterior usaba un tablero
  // 17 x 17 y cuatro pares de casillas terminaban superpuestos; por eso una
  // ficha podía seguir existiendo en Firebase pero quedar escondida.
  const c={};

  // Sector inferior: 1..8 suben por la derecha; 60..67 bajan por la izquierda;
  // 68 es la casilla central inferior.
  for(let n=1;n<=8;n++) c[n]=[20-n,11];          // 1=(19,11), 8=(12,11)
  for(let n=60;n<=67;n++) c[n]=[12+(n-60),9];  // 60=(12,9), 67=(19,9)
  c[68]=[19,10];

  // Sector derecho: 9..16 avanzan por la fila inferior, 17 gira en el extremo,
  // 18..25 regresan por la fila superior hacia el centro.
  for(let n=9;n<=16;n++) c[n]=[11,12+(n-9)];   // 9=(11,12), 16=(11,19)
  c[17]=[10,19];
  for(let n=18;n<=25;n++) c[n]=[9,19-(n-18)]; // 18=(9,19), 25=(9,12)

  // Sector superior.
  for(let n=26;n<=33;n++) c[n]=[8-(n-26),11]; // 26=(8,11), 33=(1,11)
  c[34]=[1,10];
  for(let n=35;n<=42;n++) c[n]=[1+(n-35),9];  // 35=(1,9), 42=(8,9)

  // Sector izquierdo.
  for(let n=43;n<=50;n++) c[n]=[9,8-(n-43)];  // 43=(9,8), 50=(9,1)
  c[51]=[10,1];
  for(let n=52;n<=59;n++) c[n]=[11,1+(n-52)]; // 52=(11,1), 59=(11,8)

  return c;
}
const PARCHIS_TRACK_COORDS=buildParchisTrackCoords();
const PARCHIS_LANE_COORDS={
  // Siete casillas de pasillo de meta por color, desde el exterior al centro.
  red:Array.from({length:7},(_,i)=>[2+i,10]),
  blue:Array.from({length:7},(_,i)=>[10,18-i]),
  green:Array.from({length:7},(_,i)=>[10,2+i]),
  yellow:Array.from({length:7},(_,i)=>[18-i,10])
};

function startParchisGame(){
  const ids=getActivePlayerIds(4); if(ids.length<2) return toast("Para parchís necesitas al menos 2 jugadores");
  const players=ids.map((id,i)=>({id,color:PARCHIS_COLORS[i],pieces:[-1,-1,-1,-1],sixes:0,lastMoved:null}));
  updateRoom({activeGame:"parchis",status:"playing",gameState:{
    type:"parchis",players,phase:"rolloff",rollQueue:[...ids],rollIndex:0,startRolls:{},currentTurn:ids[0],
    dice:null,effectiveRoll:null,repeatAfterMove:false,pendingBonus:null,winner:null,rewardsGiven:false,
    log:["Cada jugador tira el dado. El número más alto empieza."]
  }});
}
function parchisPlayer(gs,id){ return (gs.players||[]).find(p=>p.id===id); }
function nextParchisTurn(gs,current){ const ids=(gs.players||[]).map(p=>p.id); const idx=ids.indexOf(current); return ids[(idx+1)%ids.length]; }
function diceFace(n){ return ["⚀","⚁","⚂","⚃","⚄","⚅"][Math.max(1,Math.min(6,n))-1]||"⚀"; }
function globalParchisCell(player,progress){ if(progress<0||progress>=PARCHIS_TRACK) return null; return ((PARCHIS_START_CELL[player.color]-1+progress)%PARCHIS_TRACK)+1; }
function parchisOccupants(gs,cell,excludeId=null,excludePiece=null){
  const out=[];
  (gs.players||[]).forEach(p=>p.pieces.forEach((progress,i)=>{ if(p.id===excludeId&&i===excludePiece)return; if(globalParchisCell(p,progress)===cell) out.push({player:p,piece:i,progress}); }));
  return out;
}
function isParchisBarrier(gs,cell,excludeId=null,excludePiece=null){ return parchisOccupants(gs,cell,excludeId,excludePiece).length>=2; }
function allParchisPiecesOut(player){ return player.pieces.every(p=>p!==-1); }
function parchisAdvance(progress,steps){ const raw=progress+steps; return raw<=PARCHIS_GOAL?raw:PARCHIS_GOAL-(raw-PARCHIS_GOAL); }
function parchisCanTravel(gs,player,pieceIndex,steps){
  const progress=player.pieces[pieceIndex]; if(progress<0||progress===PARCHIS_GOAL)return false;
  const target=parchisAdvance(progress,steps);
  const forward=target>=progress;
  if(forward){
    for(let p=progress+1;p<=Math.min(target,PARCHIS_TRACK-1);p++){
      const cell=globalParchisCell(player,p); if(isParchisBarrier(gs,cell,player.id,pieceIndex)) return false;
    }
  }
  if(target<PARCHIS_TRACK){ const cell=globalParchisCell(player,target); if(isParchisBarrier(gs,cell,player.id,pieceIndex)) return false; }
  return true;
}
function ownBarrierPieces(gs,player){
  const map=new Map(); player.pieces.forEach((progress,i)=>{ const cell=globalParchisCell(player,progress); if(!cell)return; const list=map.get(cell)||[]; list.push(i); map.set(cell,list); });
  return [...map.values()].filter(v=>v.length>=2).flat();
}
function legalParchisPieces(gs,playerId){
  const player=parchisPlayer(gs,playerId); if(!player)return[];
  if(gs.pendingBonus){
    return player.pieces.map((p,i)=>({p,i})).filter(({p,i})=>p>=0&&p<PARCHIS_GOAL&&i!==gs.pendingBonus.excludePiece&&parchisCanTravel(gs,player,i,gs.pendingBonus.steps)).map(x=>x.i);
  }
  if(!gs.dice)return[];
  const startCell=PARCHIS_START_CELL[player.color];
  const home=player.pieces.map((p,i)=>p===-1?i:null).filter(i=>i!==null);
  const startOwn=player.pieces.filter(p=>globalParchisCell(player,p)===startCell).length;
  if(gs.dice===5 && home.length && startOwn<2) return home;
  let candidates=player.pieces.map((p,i)=>({p,i})).filter(({p})=>p>=0&&p<PARCHIS_GOAL).map(x=>x.i);
  if(gs.dice===6){ const barrierPieces=ownBarrierPieces(gs,player); if(barrierPieces.length) candidates=candidates.filter(i=>barrierPieces.includes(i)); }
  return candidates.filter(i=>parchisCanTravel(gs,player,i,gs.effectiveRoll||gs.dice));
}
async function rollParchisStart(){
  const gs=clone(state.room.gameState); if(gs.type!=="parchis"||gs.phase!=="rolloff")return;
  if(gs.currentTurn!==state.myId)return toast("Ahora tira otro jugador");

  // Firebase Realtime Database elimina los objetos vacíos. Por eso startRolls:{}
  // puede volver como undefined al navegador. Lo recreamos antes de guardar la tirada.
  gs.startRolls = gs.startRolls || {};
  const queue=Array.isArray(gs.rollQueue) ? gs.rollQueue : Object.values(gs.rollQueue||{});
  if(!queue.length)return toast("No se pudo recuperar el orden de jugadores");

  const value=Math.floor(Math.random()*6)+1;
  gs.startRolls[state.myId]=value;
  gs.lastStartRoll={playerId:state.myId,value,at:now()};
  gs.log=[`${myPlayerName()} saca ${value} para decidir el inicio.`,...(gs.log||[])].slice(0,30);

  const nextIndex=(Number(gs.rollIndex)||0)+1;
  if(nextIndex<queue.length){
    gs.rollIndex=nextIndex;
    gs.currentTurn=queue[nextIndex];
  }else{
    const max=Math.max(...queue.map(id=>Number(gs.startRolls?.[id]||0)));
    const tied=queue.filter(id=>Number(gs.startRolls?.[id]||0)===max);
    if(tied.length>1){
      gs.rollQueue=tied;
      gs.rollIndex=0;
      gs.startRolls=null;
      gs.currentTurn=tied[0];
      gs.log=[`Empate con ${max}. Los empatados vuelven a tirar.`,...(gs.log||[])].slice(0,30);
    }else{
      gs.phase="play";
      gs.currentTurn=tied[0];
      gs.rollQueue=[];
      gs.rollIndex=0;
      gs.startRolls=null;
      gs.dice=null;
      gs.log=[`${state.room.players?.[tied[0]]?.name||"Jugador"} empieza la partida.`,...(gs.log||[])].slice(0,30);
    }
  }
  await updateNested("gameState",gs);
}
async function rollParchis(){
  const gs=clone(state.room.gameState); if(gs.type!=="parchis"||gs.phase!=="play"||gs.winner)return;
  if(gs.currentTurn!==state.myId)return toast("No es tu turno");
  if(gs.dice||gs.pendingBonus)return;
  const player=parchisPlayer(gs,state.myId); if(!player)return toast("Eres espectador");
  const value=Math.floor(Math.random()*6)+1; gs.dice=value; gs.effectiveRoll=(value===6&&allParchisPiecesOut(player))?7:value; gs.repeatAfterMove=value===6;
  if(value===6) player.sixes=(player.sixes||0)+1; else player.sixes=0;
  gs.log=[`${myPlayerName()} tira ${value}${gs.effectiveRoll===7?' (vale 7 porque las 4 fichas están fuera)':''}.`,...(gs.log||[])].slice(0,30);
  if(player.sixes>=3){
    const last=player.lastMoved; if(last!==null&&last!==undefined&&player.pieces[last]>=0&&player.pieces[last]<68){ player.pieces[last]=-1; gs.log=[`Tres 6 seguidos: la última ficha movida de ${myPlayerName()} vuelve a casa.`,...(gs.log||[])].slice(0,30); }
    else gs.log=[`Tres 6 seguidos: termina el turno de ${myPlayerName()}.`,...(gs.log||[])].slice(0,30);
    player.sixes=0; gs.dice=null; gs.effectiveRoll=null; gs.repeatAfterMove=false; gs.currentTurn=nextParchisTurn(gs,state.myId); await updateNested("gameState",gs); return;
  }
  const legal=legalParchisPieces(gs,state.myId);
  if(!legal.length){ gs.log=[`${myPlayerName()} no tiene ninguna jugada válida.`,...(gs.log||[])].slice(0,30); await finishParchisTurn(gs); return; }
  await updateNested("gameState",gs);
}
async function finishParchisTurn(gs){
  const current=gs.currentTurn; const repeat=!!gs.repeatAfterMove;
  gs.dice=null; gs.effectiveRoll=null; gs.pendingBonus=null; gs.repeatAfterMove=false;
  if(repeat){ gs.currentTurn=current; gs.log=[`${state.room.players?.[current]?.name||"Jugador"} repite turno por haber sacado un 6.`,...(gs.log||[])].slice(0,30); }
  else gs.currentTurn=nextParchisTurn(gs,current);
  await updateNested("gameState",gs);
}
async function moveParchisPiece(pieceIndex){
  const gs=clone(state.room.gameState); if(gs.type!=="parchis"||gs.phase!=="play"||gs.winner)return;
  if(gs.currentTurn!==state.myId)return toast("No es tu turno");
  const player=parchisPlayer(gs,state.myId); if(!player)return;
  const legal=legalParchisPieces(gs,state.myId); if(!legal.includes(pieceIndex))return toast("Esa ficha no puede moverse ahora");
  const bonus=gs.pendingBonus?clone(gs.pendingBonus):null; const steps=bonus?bonus.steps:(gs.effectiveRoll||gs.dice); const old=player.pieces[pieceIndex];
  gs.pendingBonus=null;
  if(old===-1){ player.pieces[pieceIndex]=0; gs.log=[`${myPlayerName()} saca la ficha ${pieceIndex+1} de casa con un 5.`,...(gs.log||[])].slice(0,30); }
  else{
    player.pieces[pieceIndex]=parchisAdvance(old,steps); gs.log=[`${myPlayerName()} mueve la ficha ${pieceIndex+1} ${steps} casillas.`,...(gs.log||[])].slice(0,30);
  }
  player.lastMoved=pieceIndex;
  const newProgress=player.pieces[pieceIndex];
  if(newProgress<PARCHIS_TRACK){
    const cell=globalParchisCell(player,newProgress);
    if(!PARCHIS_SAFE_CELLS.has(cell)){
      const victims=parchisOccupants(gs,cell,player.id,pieceIndex).filter(x=>x.player.id!==player.id);
      if(victims.length){ const victim=victims[0]; victim.player.pieces[victim.piece]=-1; gs.pendingBonus={type:"capture",steps:20,excludePiece:pieceIndex}; gs.log=[`${myPlayerName()} come una ficha de ${state.room.players?.[victim.player.id]?.name||"otro jugador"}: bonus de 20 casillas.`,...(gs.log||[])].slice(0,30); }
    }
  }
  if(newProgress===PARCHIS_GOAL && old!==PARCHIS_GOAL){
    gs.pendingBonus={type:"goal",steps:10,excludePiece:pieceIndex}; gs.log=[`${myPlayerName()} mete una ficha en meta: bonus de 10 casillas.`,...(gs.log||[])].slice(0,30);
  }
  if(player.pieces.every(p=>p===PARCHIS_GOAL)){
    gs.winner=state.myId; gs.phase="finished"; gs.dice=null; gs.pendingBonus=null; gs.repeatAfterMove=false;
    gs.log=[`${myPlayerName()} mete sus 4 fichas en meta y gana la partida.`,...(gs.log||[])].slice(0,30);
    await updateNested("gameState",gs); await awardMatchResult(state.myId,(gs.players||[]).map(p=>p.id)); toast("¡Victoria! +25 Coins · los demás +10"); return;
  }
  if(gs.pendingBonus){
    const possible=legalParchisPieces(gs,state.myId); if(possible.length){ await updateNested("gameState",gs); return; }
    gs.log=[`No hay ficha válida para usar el bonus de ${gs.pendingBonus.steps}.`,...(gs.log||[])].slice(0,30); gs.pendingBonus=null;
  }
  await finishParchisTurn(gs);
}
// Posicion visual independiente para CADA ficha y CADA color.
// La ficha ya no se dibuja "dentro" de la casilla. Se coloca en una capa
// superior del tablero usando su coordenada exacta. Así rojo, azul, amarillo
// y verde usan el mismo sistema y ninguna ficha puede quedar tapada por una
// casilla, un seguro, un pasillo o el centro del tablero.
function parchisVisualPosition(player,progress){
  const value=Number(progress);
  if(!Number.isFinite(value)) return null;
  if(value<0) return {zone:"home"};
  if(value<PARCHIS_TRACK){
    const cell=globalParchisCell(player,value);
    const coord=PARCHIS_TRACK_COORDS[cell];
    return coord?{zone:"track",cell,row:coord[0],col:coord[1],key:`t-${cell}`} : null;
  }
  if(value<PARCHIS_GOAL){
    const laneIndex=value-PARCHIS_TRACK;
    const coord=PARCHIS_LANE_COORDS[player.color]?.[laneIndex];
    return coord?{zone:"lane",laneIndex,row:coord[0],col:coord[1],key:`l-${player.color}-${laneIndex}`} : null;
  }
  if(value===PARCHIS_GOAL) return {zone:"goal",key:`g-${player.color}`};
  return null;
}

function parchisTokenHtml(gs,player,pieceIndex,extra=""){
  const mine=player.id===state.myId;
  const legal=mine&&legalParchisPieces(gs,state.myId).includes(pieceIndex);
  const tag=mine?'button':'span';
  return `<${tag} class="parchis-token ${player.color} ${legal?'movable':''} ${extra}" ${mine?`data-parchis-piece="${pieceIndex}" ${legal?'':'disabled'}`:''} title="${esc(state.room.players?.[player.id]?.name||'Jugador')} · ficha ${pieceIndex+1}">${pieceIndex+1}</${tag}>`;
}

function renderParchisHome(gs,player,color){
  const pieces=player?.pieces||[];
  const homePieces=player?[0,1,2,3].filter(i=>Number(pieces[i]??-1)===-1):[];
  const name=player?(state.room.players?.[player.id]?.name||"Jugador"):"Libre";
  return `<div class="parchis-home home-${color}"><div class="home-circle"><b>${esc(name)}</b><small>${player?`${homePieces.length} en casa`:"Sin jugador"}</small><div class="home-token-grid">${player?homePieces.map(i=>parchisTokenHtml(gs,player,i)).join(''):''}</div></div></div>`;
}

function buildParchisBoardTokenLayer(gs){
  const entries=[];
  (gs.players||[]).forEach(player=>{
    const pieces=player.pieces||[];
    [0,1,2,3].forEach(pieceIndex=>{
      const progress=Number(pieces[pieceIndex]??-1);
      const pos=parchisVisualPosition(player,progress);
      if(!pos || pos.zone==="home" || pos.zone==="goal") return;
      entries.push({player,pieceIndex,progress,...pos});
    });
  });

  // Si dos o más fichas comparten una casilla (barrera/captura), las separamos
  // ligeramente en la capa superior para que TODAS sigan siendo visibles.
  const groups=new Map();
  entries.forEach(entry=>{
    const list=groups.get(entry.key)||[];
    list.push(entry);
    groups.set(entry.key,list);
  });
  const offsets=[[-7,-7],[7,-7],[-7,7],[7,7],[0,0],[-10,0],[10,0],[0,10]];
  return [...groups.values()].flatMap(group=>group.map((entry,slot)=>{
    const [dx,dy]=offsets[slot%offsets.length];
    return `<div class="parchis-token-anchor" style="grid-row:${entry.row};grid-column:${entry.col};--token-x:${dx}px;--token-y:${dy}px" data-zone="${entry.zone}" data-progress="${entry.progress}" data-player-color="${entry.player.color}">${parchisTokenHtml(gs,entry.player,entry.pieceIndex,'board-token')}</div>`;
  })).join('');
}

function renderParchisBoard(gs){
  // Las casillas son SOLO el tablero. Las fichas van en boardTokens, una capa
  // común para los cuatro jugadores. Esto elimina el bug que hacía desaparecer
  // la ficha del segundo (o de cualquier otro) jugador al cambiar de casilla.
  const cells=Array.from({length:68},(_,i)=>i+1).map(cell=>{
    const [r,c]=PARCHIS_TRACK_COORDS[cell];
    const startColor=Object.entries(PARCHIS_START_CELL).find(([,n])=>n===cell)?.[0];
    return `<div class="parchis-cell ${PARCHIS_SAFE_CELLS.has(cell)?'safe':''} ${startColor?`start-${startColor}`:''}" style="grid-row:${r};grid-column:${c}"><span class="cell-number">${cell}</span></div>`;
  }).join('');

  const lanes=PARCHIS_COLORS.flatMap(color=>PARCHIS_LANE_COORDS[color].map(([r,c],i)=>
    `<div class="parchis-lane-cell lane-${color}" style="grid-row:${r};grid-column:${c}"><span>${i+1}</span></div>`
  )).join('');

  const homes=PARCHIS_COLORS.map(color=>renderParchisHome(gs,(gs.players||[]).find(p=>p.color===color),color)).join('');
  const boardTokens=buildParchisBoardTokenLayer(gs);
  const goalTokens=(gs.players||[]).flatMap(p=>[0,1,2,3].map(i=>Number((p.pieces||[])[i]??-1)===PARCHIS_GOAL?parchisTokenHtml(gs,p,i,'goal-token'):null).filter(Boolean)).join('');

  return `<div class="parchis-classic-board">${homes}${cells}${lanes}<div class="parchis-goal"><div class="goal-tri red"></div><div class="goal-tri blue"></div><div class="goal-tri yellow"></div><div class="goal-tri green"></div><div class="goal-tokens">${goalTokens}</div></div>${boardTokens}</div>`;
}
function renderParchis(stage,gs){
  const me=parchisPlayer(gs,state.myId);
  const legal=legalParchisPieces(gs,state.myId);
  const phaseText=gs.phase==="rolloff"?'Sorteo de inicio':gs.phase==="finished"?'Partida terminada':'Partida en curso';
  const displayDice = gs.phase==="rolloff" ? Number(gs.lastStartRoll?.value||0) : Number(gs.dice||0);
  const rollResults = gs.phase==="rolloff" ? Object.entries(gs.startRolls||{}).map(([id,value])=>`<div class="score-item"><span>${esc(state.room.players?.[id]?.name||'Jugador')}</span><b>${diceFace(Number(value))} ${Number(value)}</b></div>`).join('') : '';
  const canStartRoll = gs.phase==="rolloff" && gs.currentTurn===state.myId;

  stage.innerHTML=`<div class="parchis-real-wrap"><div class="parchis-main"><div class="game-info-bar"><div><span class="eyebrow">PARCHÍS CLÁSICO</span><h2>${gs.winner?`Ganador: ${esc(state.room.players?.[gs.winner]?.name||'Jugador')}`:phaseText}</h2></div><div class="turn-pill">Turno de <b>${esc(state.room.players?.[gs.currentTurn]?.name||'...')}</b></div></div>${renderParchisBoard(gs)}</div><div class="parchis-control-panel"><div class="parchis-dice-box"><span>DADO</span><div class="dice big-dice">${displayDice?diceFace(displayDice):'—'}</div>${displayDice?`<small>Última tirada: ${displayDice}</small>`:''}${gs.effectiveRoll&&gs.effectiveRoll!==gs.dice?`<small>El 6 vale ${gs.effectiveRoll}</small>`:''}</div><div class="legend"><div><span>Tu color</span><b>${me?me.color:'Espectador'}</b></div><div><span>Fichas en meta</span><b>${me?me.pieces.filter(p=>p===PARCHIS_GOAL).length:0}/4</b></div><div><span>Premios</span><b>Ganar +25 · Perder +10</b></div></div>${gs.phase==="rolloff"?`<button id="parchisStartRollBtn" class="btn primary full" ${canStartRoll?'':'disabled'}>🎲 ${canStartRoll?'Tirar para decidir quién empieza':'Esperando a '+esc(state.room.players?.[gs.currentTurn]?.name||'otro jugador')}</button><div class="notice">Todos tiran. El número más alto empieza; si hay empate, los empatados vuelven a tirar.</div>${rollResults?`<div class="score-list">${rollResults}</div>`:''}`:gs.winner?`<div class="winner-banner">🏆 ${esc(state.room.players?.[gs.winner]?.name||'Jugador')} ha metido sus 4 fichas en la meta.</div>`:`<button id="parchisRollBtn" class="btn primary full" ${gs.currentTurn!==state.myId||gs.dice||gs.pendingBonus?'disabled':''}>🎲 Tirar dado</button>${gs.pendingBonus?`<div class="winner-banner">Bonus de ${gs.pendingBonus.steps} casillas: elige otra ficha.</div>`:gs.dice?`<div class="notice">Elige una de tus fichas resaltadas (${legal.length} movimiento${legal.length===1?'':'s'} posible${legal.length===1?'':'s'}).</div>`:`<div class="notice">Salida con 5 · 6 repite · tres 6 penalizan · seguros · barreras · bonus de 20 al comer y 10 al llegar a meta.</div>`}`}<div><span class="eyebrow">Eventos</span><div class="race-log">${(gs.log||[]).map(m=>`<div class="race-log-item">${esc(m)}</div>`).join('')}</div></div></div></div>`;
  $("#parchisStartRollBtn")?.addEventListener("click",rollParchisStart);
  $("#parchisRollBtn")?.addEventListener("click",rollParchis);
  $$('[data-parchis-piece]',stage).forEach(btn=>btn.onclick=()=>moveParchisPiece(+btn.dataset.parchisPiece));
}


// -----------------------------------------------------------------------------
// JUEGO DE LA OCA · tablero clásico de 63 casillas
// -----------------------------------------------------------------------------
const OCA_LAST=63;
// El archivo de reglas del proyecto enumera "5, 9, 14...". Para completar
// la secuencia usamos la progresión tradicional de ocas hasta la casilla 59.
const OCA_GEESE=[5,9,14,18,23,27,32,36,41,45,50,54,59];
const OCA_BRIDGES=[6,12];
const OCA_DICE=[26,53];
const OCA_SPECIAL={19:"inn",31:"well",42:"maze",56:"jail",58:"death",63:"finish"};
const OCA_COLORS=["red","blue","green","yellow","purple","orange","cyan","pink"];

function buildOcaSpiralCoords(){
  // Espiral circular propia: 63 posiciones desde el exterior hasta el centro.
  // Usamos porcentajes para que el tablero mantenga el dibujo en móvil y PC.
  return Array.from({length:OCA_LAST},(_,i)=>{
    const t=i/(OCA_LAST-1);
    const turns=5;
    const angle=Math.PI/2-(turns*Math.PI*2*t);
    const radius=44-(31*t);
    const x=50+Math.cos(angle)*radius;
    const y=50+Math.sin(angle)*radius;
    return [y,x];
  });
}
const OCA_COORDS=buildOcaSpiralCoords();

function ocaSpecialType(cell){
  if(OCA_GEESE.includes(cell)) return "goose";
  if(OCA_BRIDGES.includes(cell)) return "bridge";
  if(OCA_DICE.includes(cell)) return "dice";
  return OCA_SPECIAL[cell]||null;
}
function ocaSpecialIcon(cell){
  return ({goose:"🪿",bridge:"🌉",dice:"🎲",inn:"🏨",well:"🕳️",maze:"🌀",jail:"🔒",death:"💀",finish:"🏁"})[ocaSpecialType(cell)]||"";
}
function ocaPlayer(gs,id){ return (gs.players||[]).find(p=>p.id===id); }
function nextOcaPlayerId(gs,current){
  const ids=(gs.players||[]).map(p=>p.id); if(!ids.length)return current;
  return ids[(ids.indexOf(current)+1)%ids.length];
}
function startOcaGame(){
  const ids=getActivePlayerIds(8); if(ids.length<2) return toast("Para el Juego de la Oca necesitas al menos 2 jugadores");
  const players=ids.map((id,i)=>({id,color:OCA_COLORS[i],pos:1,skipTurns:0,trapped:false}));
  updateRoom({activeGame:"oca",status:"playing",gameState:{
    type:"oca",players,phase:"rolloff",rollQueue:[...ids],rollIndex:0,startRolls:{},currentTurn:ids[0],
    dice:null,lastRoll:null,winner:null,rewardsGiven:false,extraRoll:false,
    log:["Todos tiran un dado. El número más alto empieza."]
  }});
}
async function rollOcaStart(){
  const gs=clone(state.room.gameState); if(gs.type!=="oca"||gs.phase!=="rolloff")return;
  if(gs.currentTurn!==state.myId)return toast("Ahora tira otro jugador");
  gs.startRolls=gs.startRolls||{};
  const queue=Array.isArray(gs.rollQueue)?gs.rollQueue:Object.values(gs.rollQueue||{});
  if(!queue.length)return toast("No se pudo recuperar el orden de jugadores");
  const value=Math.floor(Math.random()*6)+1;
  gs.startRolls[state.myId]=value; gs.lastRoll={playerId:state.myId,value,at:now()};
  gs.log=[`${myPlayerName()} saca ${value} para decidir el inicio.`,...(gs.log||[])].slice(0,40);
  const nextIndex=(Number(gs.rollIndex)||0)+1;
  if(nextIndex<queue.length){ gs.rollIndex=nextIndex; gs.currentTurn=queue[nextIndex]; }
  else{
    const max=Math.max(...queue.map(id=>Number(gs.startRolls?.[id]||0)));
    const tied=queue.filter(id=>Number(gs.startRolls?.[id]||0)===max);
    if(tied.length>1){
      gs.rollQueue=tied; gs.rollIndex=0; gs.startRolls=null; gs.currentTurn=tied[0];
      gs.log=[`Empate con ${max}. Los empatados vuelven a tirar.`,...(gs.log||[])].slice(0,40);
    }else{
      gs.phase="play"; gs.currentTurn=tied[0]; gs.rollQueue=[]; gs.rollIndex=0; gs.startRolls=null; gs.dice=null;
      gs.log=[`${state.room.players?.[tied[0]]?.name||"Jugador"} empieza la partida.`,...(gs.log||[])].slice(0,40);
    }
  }
  await updateNested("gameState",gs);
}

function ocaBouncePosition(pos,roll){
  const raw=pos+roll;
  if(raw<=OCA_LAST)return raw;
  return OCA_LAST-(raw-OCA_LAST);
}
function nextGoose(cell){ return OCA_GEESE.find(n=>n>cell)||cell; }

async function advanceOcaTurn(gs,current,{repeat=false}={}){
  gs.dice=null;
  if(repeat){
    gs.currentTurn=current; gs.extraRoll=true;
    return;
  }
  gs.extraRoll=false;
  let next=nextOcaPlayerId(gs,current);
  // Saltamos automáticamente turnos de posada/cárcel. Los atrapados en el
  // pozo se omiten hasta que otro jugador caiga allí y los libere.
  let guard=0;
  while(guard++<(gs.players||[]).length*4){
    const p=ocaPlayer(gs,next); if(!p)break;
    if(p.trapped){ next=nextOcaPlayerId(gs,next); continue; }
    if(Number(p.skipTurns||0)>0){
      p.skipTurns=Math.max(0,Number(p.skipTurns)-1);
      gs.log=[`${state.room.players?.[p.id]?.name||"Jugador"} pierde un turno.`,...(gs.log||[])].slice(0,40);
      next=nextOcaPlayerId(gs,next); continue;
    }
    break;
  }
  gs.currentTurn=next;
}

async function rollOca(){
  const gs=clone(state.room.gameState); if(gs.type!=="oca"||gs.phase!=="play"||gs.winner)return;
  if(gs.currentTurn!==state.myId)return toast("No es tu turno");
  if(gs.dice)return;
  const me=ocaPlayer(gs,state.myId); if(!me)return toast("Eres espectador");
  if(me.trapped)return toast("Estás atrapado en el pozo");
  const value=Math.floor(Math.random()*6)+1; gs.dice=value; gs.lastRoll={playerId:state.myId,value,at:now()};
  gs.log=[`${myPlayerName()} tira ${value}.`,...(gs.log||[])].slice(0,40);
  await updateNested("gameState",gs);
}

async function moveOca(){
  const gs=clone(state.room.gameState); if(gs.type!=="oca"||gs.phase!=="play"||gs.winner)return;
  if(gs.currentTurn!==state.myId)return toast("No es tu turno");
  if(!gs.dice)return toast("Primero tira el dado");
  const me=ocaPlayer(gs,state.myId); if(!me)return;
  const roll=Number(gs.dice||0); const old=Number(me.pos||1);
  let target=ocaBouncePosition(old,roll);
  me.pos=target;
  gs.log=[`${myPlayerName()} avanza de ${old} a ${target}.`,...(gs.log||[])].slice(0,40);

  let repeat=false;
  const type=ocaSpecialType(target);
  if(type==="goose"){
    const dest=nextGoose(target);
    if(dest!==target){ me.pos=dest; gs.log=[`De oca a oca: ${myPlayerName()} salta hasta la ${dest} y vuelve a tirar.`,...(gs.log||[])].slice(0,40); }
    repeat=true;
  }else if(type==="bridge"){
    const dest=target===6?12:6; me.pos=dest; repeat=true;
    gs.log=[`De puente a puente: ${myPlayerName()} va a la casilla ${dest} y vuelve a tirar.`,...(gs.log||[])].slice(0,40);
  }else if(type==="inn"){
    me.skipTurns=(me.skipTurns||0)+1;
    gs.log=[`${myPlayerName()} cae en la Posada y pierde 1 turno.`,...(gs.log||[])].slice(0,40);
  }else if(type==="well"){
    const trapped=(gs.players||[]).find(p=>p.id!==me.id&&p.trapped);
    if(trapped){
      trapped.trapped=false;
      me.trapped=true;
      gs.log=[`${state.room.players?.[trapped.id]?.name||"Jugador"} sale del Pozo; ${myPlayerName()} queda atrapado.`,...(gs.log||[])].slice(0,40);
    }else{
      me.trapped=true;
      gs.log=[`${myPlayerName()} cae en el Pozo y espera a que otro jugador lo rescate.`,...(gs.log||[])].slice(0,40);
    }
  }else if(type==="maze"){
    me.pos=30; gs.log=[`${myPlayerName()} cae en el Laberinto y retrocede a la casilla 30.`,...(gs.log||[])].slice(0,40);
  }else if(type==="jail"){
    me.skipTurns=(me.skipTurns||0)+2; gs.log=[`${myPlayerName()} cae en la Cárcel y pierde 2 turnos.`,...(gs.log||[])].slice(0,40);
  }else if(type==="dice"){
    const dest=target===26?53:26; me.pos=dest; repeat=true;
    gs.log=[`De dados a dados: ${myPlayerName()} va a la casilla ${dest} y vuelve a tirar.`,...(gs.log||[])].slice(0,40);
  }else if(type==="death"){
    me.pos=1; gs.log=[`${myPlayerName()} cae en la Muerte y vuelve a la salida.`,...(gs.log||[])].slice(0,40);
  }else if(type==="finish"){
    gs.winner=state.myId; gs.phase="finished"; gs.dice=null;
    gs.log=[`${myPlayerName()} llega exactamente a la casilla 63 y gana la partida.`,...(gs.log||[])].slice(0,40);
    await updateNested("gameState",gs);
    await awardMatchResult(state.myId,(gs.players||[]).map(p=>p.id));
    toast("¡Ganaste! +25 Coins · los demás reciben +10");
    return;
  }

  await advanceOcaTurn(gs,state.myId,{repeat});
  await updateNested("gameState",gs);
}

function renderOcaBoard(gs){
  const tokensByCell={};
  (gs.players||[]).forEach((p,i)=>{ const cell=Math.max(1,Math.min(63,Number(p.pos||1))); (tokensByCell[cell]??=[]).push({...p,index:i}); });
  const tokenOffsets=[[25,62],[67,62],[25,34],[67,34],[46,48],[18,48],[76,48],[46,72]];
  const cells=Array.from({length:63},(_,i)=>i+1).map(cell=>{
    const [y,x]=OCA_COORDS[cell-1]; const type=ocaSpecialType(cell); const icon=ocaSpecialIcon(cell);
    const tokens=(tokensByCell[cell]||[]).map((p,j)=>{ const [tx,ty]=tokenOffsets[j%tokenOffsets.length]; return `<div class="oca-token color-${p.color}" style="left:${tx}%;top:${ty}%" title="${esc(state.room.players?.[p.id]?.name||'Jugador')}">${(p.index+1)}</div>`; }).join('');
    return `<div class="oca-cell ${type?`special special-${type}`:''}" style="left:${x}%;top:${y}%"><span class="oca-num">${cell}</span>${icon?`<span class="oca-icon">${icon}</span>`:''}<div class="oca-tokens">${tokens}</div></div>`;
  }).join('');
  return `<div class="oca-board">${cells}<div class="oca-center"><span>🪿</span><b>JUEGO<br>DE LA OCA</b><small>Llega exacto a 63</small></div></div>`;
}
function renderOca(stage,gs){
  const me=ocaPlayer(gs,state.myId); const displayRoll=Number(gs.dice||gs.lastRoll?.value||0);
  const rollResults=gs.phase==="rolloff"?Object.entries(gs.startRolls||{}).map(([id,value])=>`<div class="score-item"><span>${esc(state.room.players?.[id]?.name||'Jugador')}</span><b>${diceFace(Number(value))} ${Number(value)}</b></div>`).join(''):'';
  const canStart=gs.phase==="rolloff"&&gs.currentTurn===state.myId;
  stage.innerHTML=`<div class="oca-wrap"><div class="oca-main"><div class="game-info-bar"><div><span class="eyebrow">JUEGO DE LA OCA</span><h2>${gs.phase==='rolloff'?'Sorteo de inicio':gs.winner?`Ganador: ${esc(state.room.players?.[gs.winner]?.name||'Jugador')}`:'Partida en curso'}</h2></div><div class="turn-pill">${gs.phase==='finished'?'Partida terminada':`Turno de <b>${esc(state.room.players?.[gs.currentTurn]?.name||'...')}</b>`}</div></div>${renderOcaBoard(gs)}</div><div class="oca-side"><div class="oca-dice-card"><span>DADO</span><div class="dice big-dice">${displayRoll?diceFace(displayRoll):'—'}</div>${displayRoll?`<small>Última tirada: ${displayRoll}</small>`:''}</div><div class="legend"><div><span>Tu casilla</span><b>${me?.pos||'Espectador'}</b></div><div><span>Estado</span><b>${me?.trapped?'En el pozo':me?.skipTurns?`Pierde ${me.skipTurns} turno(s)`:'Libre'}</b></div><div><span>Premios</span><b>Ganar +25 · Perder +10</b></div></div>${gs.phase==='rolloff'?`<button id="ocaStartRollBtn" class="btn primary full" ${canStart?'':'disabled'}>🎲 ${canStart?'Tirar para decidir quién empieza':'Esperando a '+esc(state.room.players?.[gs.currentTurn]?.name||'otro jugador')}</button><div class="notice">Todos tiran un dado. El número más alto empieza; en caso de empate vuelven a tirar solo los empatados.</div>${rollResults?`<div class="score-list">${rollResults}</div>`:''}`:gs.winner?`<div class="winner-banner">🏁 ${esc(state.room.players?.[gs.winner]?.name||'Jugador')} llegó a la casilla 63.</div>`:`<button id="ocaRollBtn" class="btn primary full" ${gs.currentTurn!==state.myId||gs.dice||me?.trapped?'disabled':''}>🎲 Tirar dado</button><button id="ocaMoveBtn" class="btn ghost full" ${gs.currentTurn!==state.myId||!gs.dice?'disabled':''}>Mover ${gs.dice||''} casillas</button><div class="notice">Oca: salta a la siguiente y repite · Puentes 6↔12 · Posada 19 · Pozo 31 · Laberinto 42→30 · Cárcel 56 · Dados 26↔53 · Muerte 58→1 · Meta exacta 63.</div>`}<div><span class="eyebrow">Jugadores</span><div class="score-list">${(gs.players||[]).map(p=>`<div class="score-item"><span><i class="oca-mini-token color-${p.color}"></i>${esc(state.room.players?.[p.id]?.name||'Jugador')}</span><b>Casilla ${p.pos||1}${p.trapped?' · POZO':''}</b></div>`).join('')}</div></div><div><span class="eyebrow">Eventos</span><div class="race-log">${(gs.log||[]).map(m=>`<div class="race-log-item">${esc(m)}</div>`).join('')}</div></div></div></div>`;
  $("#ocaStartRollBtn")?.addEventListener("click",rollOcaStart);
  $("#ocaRollBtn")?.addEventListener("click",rollOca);
  $("#ocaMoveBtn")?.addEventListener("click",moveOca);
}

function startRacingGame(){
  const ids=getActivePlayerIds(8); if(ids.length<2) return toast("Para la carrera necesitas al menos 2 jugadores");
  const cars=Object.fromEntries(ids.map(id=>[id,{progress:0,fuel:100}]));
  updateRoom({activeGame:"racing",status:"playing",gameState:{type:"racing",playerIds:ids,cars,currentTurn:ids[0],winner:null,rewardsGiven:false,log:["Semáforo verde. ¡Empieza la carrera!"]}});
}
function nextRaceTurn(ids,current){ const idx=ids.indexOf(current); return ids[(idx+1)%ids.length]; }
async function doRaceAction(action){
  const gs=clone(state.room.gameState); if(gs.type!=="racing"||gs.winner) return;
  if(gs.currentTurn!==state.myId) return toast("No es tu turno");
  const car=gs.cars[state.myId]; if(!car) return toast("Eres espectador");
  let gain=0, fuelUse=0, text="";
  if(action==="normal"){ gain=8+Math.floor(Math.random()*7); fuelUse=6; text=`${myPlayerName()} acelera con ritmo estable.`; }
  if(action==="turbo"){ fuelUse=12; if(Math.random()<0.2){ gain=3+Math.floor(Math.random()*3); text=`${myPlayerName()} intenta turbo, pero pierde tracción.`; } else { gain=15+Math.floor(Math.random()*10); text=`${myPlayerName()} activa turbo y vuela por la pista.`; } }
  if(action==="pit"){ gain=2+Math.floor(Math.random()*4); fuelUse=-18; text=`${myPlayerName()} entra a boxes y recupera combustible.`; }
  car.progress=Math.min(100, car.progress+gain); car.fuel=Math.max(0, Math.min(100, car.fuel-fuelUse));
  if(car.fuel===0 && action!=="pit"){ car.progress=Math.max(0, car.progress-4); text += " Se quedó casi sin combustible."; }
  if(car.progress>=100){ gs.winner=state.myId; text=`${myPlayerName()} cruza la meta en primera posición.`; await awardMatchResult(state.myId,gs.playerIds||[]); }
  gs.log=[text, ...(gs.log||[])].slice(0,30);
  gs.currentTurn=gs.winner?state.myId:nextRaceTurn(gs.playerIds,state.myId);
  await updateNested("gameState", gs);
}
function renderRacing(stage,gs){
  stage.innerHTML=`<div class="race-wrap"><div class="race-header"><div><span class="eyebrow">CARRERA DE COCHES</span><h2>${gs.winner?`Ganador: ${esc(state.room.players?.[gs.winner]?.name||'Jugador')}`:'Gran Premio de la sala'}</h2></div><div class="turn-pill">Turno de <b>${esc(state.room.players?.[gs.currentTurn]?.name||'...')}</b></div></div><div class="race-track">${(gs.playerIds||[]).map(pid=>{ const car=gs.cars?.[pid]||{progress:0,fuel:100}; return `<div class="lane"><div class="lane-name"><span class="car-dot">🏎️</span><span>${esc(state.room.players?.[pid]?.name||'Jugador')}</span></div><div class="lane-bar"><div class="lane-fill" style="width:${car.progress}%"></div></div><div class="lane-meta">${Math.round(car.progress)}% · ⛽ ${car.fuel}</div></div>`; }).join('')}</div>${gs.winner?`<div class="winner-banner">🏁 ${esc(state.room.players?.[gs.winner]?.name||'Jugador')} gana la carrera · +25 Coins (perdedores +10)</div>`:`<div class="race-actions"><button class="race-action" data-race="normal">Acelerar</button><button class="race-action primary" data-race="turbo">Turbo</button><button class="race-action" data-race="pit">Boxes</button></div><div class="notice">Modo más realista: cada jugador decide si acelera, usa turbo o entra a boxes para recuperar combustible.</div>`}<div><span class="eyebrow">Radio del equipo</span><div class="race-log">${(gs.log||[]).map(m=>`<div class="race-log-item">${esc(m)}</div>`).join('')}</div></div></div>`;
  $$("[data-race]",stage).forEach(btn=>btn.onclick=()=>doRaceAction(btn.dataset.race));
}

async function awardMatchResult(winnerId, participantIds){
  const ids=[...new Set((participantIds||[]).filter(id=>state.room?.players?.[id]))];
  if(!winnerId||!ids.length)return;
  if(state.backend==="firebase"){
    const {ref,runTransaction}=state.dbApi;
    const flagRef=ref(state.db,`${roomPath(state.roomCode)}/gameState/rewardsGiven`);
    const claim=await runTransaction(flagRef,current=>current?undefined:true);
    if(!claim.committed)return;
    for(const id of ids){
      const amount=id===winnerId?25:10;
      await runTransaction(ref(state.db,`${roomPath(state.roomCode)}/players/${id}/coins`),current=>Number(current||0)+amount);
    }
  }else{
    const room=getDemoRoom(state.roomCode); if(!room||room.gameState?.rewardsGiven)return;
    room.gameState.rewardsGiven=true;
    ids.forEach(id=>{ room.players[id].coins=Number(room.players[id].coins||0)+(id===winnerId?25:10); });
    setDemoRoom(state.roomCode,room);
  }
}

const qRoom=new URLSearchParams(location.search).get("room");
if(qRoom){ showView("sala"); $("#joinCode").value=qRoom.toUpperCase(); }
renderWallet();
