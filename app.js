
const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];
const FIREBASE_CONFIG = window.STREAMER_ARENA_FIREBASE_CONFIG || null;
const FIREBASE_VERSION = "12.18.0";
const ui = { chessSelected: null };

const games = [
  {id:"guess", name:"Adivina el juego", icon:"🧩", category:"preguntas", desc:"El host revela pistas y el chat intenta descubrir el videojuego.", tags:["2–100 jugadores","Chat"]},
  {id:"forty", name:"Las 40", icon:"🃏", category:"cartas", desc:"Mesa de cartas por turnos. Cada jugador tira su carta y la baza queda visible.", tags:["2–4 jugadores","Cartas"]},
  {id:"chess", name:"Ajedrez", icon:"♟️", category:"estrategia", desc:"Tablero sincronizado para 2 jugadores con movimientos reales de piezas.", tags:["2 jugadores","Estrategia"]},
  {id:"parchis", name:"Parchís", icon:"🎲", category:"estrategia", desc:"Parchís clásico con 4 fichas, seguros, barreras, capturas, pasillo de meta y reglas del 5 y del 6.", tags:["2–4 jugadores","Reglas clásicas"]},
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
  const valid = ["guess","forty","chess","parchis","racing","trivia"];
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
  const suits=[["oros","🟡"],["copas","🏆"],["espadas","⚔️"],["bastos","🪵"]];
  const ranks=[1,2,3,4,5,6,7,10,11,12];
  return suits.flatMap(([suit,icon])=>ranks.map(rank=>({rank,suit,icon})));
}
function shuffle(a){ a=[...a]; for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function suitShort(s){ return ({oros:"Oros",copas:"Copas",espadas:"Espadas",bastos:"Bastos"})[s]||s; }
function cardHtml(card){ return `<div class="card-face ${card.suit==="oros"||card.suit==="copas"?"red":""}"><span>${card.rank}</span><small>${card.icon}</small><em>${suitShort(card.suit)}</em></div>`; }
function getActivePlayerIds(limit){ return getSortedPlayers(limit).map(([id])=>id); }
function spanishTrickValue(rank){ return ({1:11,3:10,12:4,11:3,10:2,7:0.7,6:0.6,5:0.5,4:0.4,2:0.2})[rank] ?? 0; }
function fortyPower(card, lead, trump){ return (card.suit===trump?200:card.suit===lead?100:0) + spanishTrickValue(card.rank); }
function startFortyGame(){
  const ids=getActivePlayerIds(4);
  if(ids.length<2) return toast("Para Las 40 necesitas al menos 2 jugadores");
  const deck=shuffle(spanishDeck());
  const hands={}; ids.forEach(id=>hands[id]=deck.splice(0,5));
  const trump=randomItem(["oros","copas","espadas","bastos"]);
  updateRoom({activeGame:"forty", status:"playing", gameState:{type:"forty",playerIds:ids,hands,trump,trick:{},leadSuit:null,currentTurn:ids[0],tricksWon:Object.fromEntries(ids.map(id=>[id,0])),lastWinner:null,phase:"play",trickNumber:1,winner:null,rewardsGiven:false}});
}
function nextTurnInOrder(order,current,trick){
  let idx=order.indexOf(current);
  for(let step=1; step<=order.length; step++){
    const candidate=order[(idx+step)%order.length];
    if(!trick[candidate]) return candidate;
  }
  return null;
}
function canPlayFortyCard(gs, playerId, index){
  if(gs.phase!=="play" || gs.currentTurn!==playerId) return false;
  const hand=gs.hands[playerId]||[]; const card=hand[index]; if(!card) return false;
  if(!gs.leadSuit) return true;
  const hasLead=hand.some(c=>c.suit===gs.leadSuit);
  return !hasLead || card.suit===gs.leadSuit;
}
async function playFortyCard(index){
  const gs=clone(state.room.gameState); const id=state.myId; if(!canPlayFortyCard(gs,id,index)) return;
  const card=gs.hands[id].splice(index,1)[0]; gs.trick[id]=card; if(!gs.leadSuit) gs.leadSuit=card.suit;
  if(Object.keys(gs.trick).length < gs.playerIds.length){ gs.currentTurn=nextTurnInOrder(gs.playerIds,id,gs.trick); }
  else{
    const lead=gs.leadSuit, trump=gs.trump;
    const winner=Object.entries(gs.trick).sort((a,b)=>fortyPower(b[1],lead,trump)-fortyPower(a[1],lead,trump))[0][0];
    gs.lastWinner=winner; gs.tricksWon[winner]=(gs.tricksWon[winner]||0)+1; gs.currentTurn=null; gs.phase="collect";
    if(gs.playerIds.every(pid=>(gs.hands[pid]||[]).length===0)){
      gs.winner=Object.entries(gs.tricksWon).sort((a,b)=>b[1]-a[1])[0][0];
      gs.phase="finished";
    }
  }
  await updateNested("gameState", gs);
  if(gs.phase==="finished" && gs.winner) await awardMatchResult(gs.winner,gs.playerIds||[]);
}
async function collectFortyTrick(){
  const gs=clone(state.room.gameState); if(gs.phase!=="collect" && gs.phase!=="finished") return;
  if(gs.phase==="finished"){
    if(gs.winner) await awardMatchResult(gs.winner, gs.playerIds||[]);
    toast("Partida terminada · ganador +25 Coins, perdedores +10"); return;
  }
  gs.trick={}; gs.leadSuit=null; gs.currentTurn=gs.lastWinner; gs.phase="play"; gs.trickNumber=(gs.trickNumber||1)+1;
  await updateNested("gameState", gs);
}
function renderForty(stage,gs){
  const ids=gs.playerIds||[];
  const meAllowed=gs.currentTurn===state.myId && gs.phase==="play";
  stage.innerHTML=`<div class="table-layout">
    <div class="table-surface">
      <div class="trick-header"><div><span class="eyebrow">LAS 40 · MESA DE CARTAS</span><h2>Baza ${gs.trickNumber||1}</h2></div><div class="turn-pill">Triunfo: <b>${suitShort(gs.trump)}</b></div><div class="turn-pill">${gs.currentTurn?`Turno de ${esc(state.room.players?.[gs.currentTurn]?.name||"...")}`:(gs.phase==="finished"?"Ronda finalizada":"Baza completada")}</div></div>
      <div class="table-grid">${ids.map(pid=>{ const p=state.room.players?.[pid]; const card=gs.trick?.[pid]; const isCurrent=gs.currentTurn===pid; return `<div class="seat ${isCurrent?"current":""}"><b>${esc(p?.name||"Jugador")}</b><small>${pid===state.myId?"Tú":pid===gs.lastWinner?"Último ganador":"En mesa"}</small>${card?cardHtml(card):'<div class="card-back">🂠</div>'}</div>`; }).join("")}</div>
      ${gs.phase==="collect"||gs.phase==="finished"?`<div class="winner-banner" style="margin-top:16px">🏆 ${esc(state.room.players?.[gs.lastWinner]?.name||"Jugador")} ganó la baza${gs.phase==="finished"?` · ganador final: ${esc(state.room.players?.[gs.winner]?.name||"Jugador")}`:""}</div>`:""}
    </div>
    <div class="forty-side">
      <div class="game-info-bar"><div><span class="eyebrow">TU MANO</span><h3>${ids.includes(state.myId)?"Juega tu carta":"Espectador"}</h3></div>${meAllowed?'<span class="notice">Es tu turno</span>':''}</div>
      <div class="hand">${(gs.hands?.[state.myId]||[]).map((card,i)=>`<button class="card-btn ${canPlayFortyCard(gs,state.myId,i)?'allowed':'blocked'}" data-card="${i}">${cardHtml(card)}</button>`).join("") || '<div class="notice">No estás sentado en esta ronda o ya no te quedan cartas.</div>'}</div>
      ${state.isHost && (gs.phase==="collect"||gs.phase==="finished")?`<button id="collectTrickBtn" class="btn primary" style="margin-top:16px">${gs.phase==="finished"?'Entregar premio final':'Recoger baza y seguir'}</button>`:''}
      <div class="score-list">${ids.map(pid=>`<div class="score-item"><span>${esc(state.room.players?.[pid]?.name||"Jugador")}</span><b>${gs.tricksWon?.[pid]||0} bazas</b></div>`).join("")}</div>
      <div class="notice" style="margin-top:12px">Se ve cómo cada jugador tira su carta y la baza permanece en mesa hasta que el host la recoge.</div>
    </div>
  </div>`;
  $$(".card-btn.allowed",stage).forEach(btn=>btn.onclick=()=>playFortyCard(+btn.dataset.card));
  $("#collectTrickBtn")?.addEventListener("click", collectFortyTrick);
}

const pieceIcons = { wr:"♖",wn:"♘",wb:"♗",wq:"♕",wk:"♔",wp:"♙", br:"♜",bn:"♞",bb:"♝",bq:"♛",bk:"♚",bp:"♟" };
function startChessGame(){
  const ids=getActivePlayerIds(2); if(ids.length<2) return toast("Para ajedrez hacen falta 2 jugadores");
  ui.chessSelected=null;
  const board=["br","bn","bb","bq","bk","bb","bn","br","bp","bp","bp","bp","bp","bp","bp","bp",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"wp","wp","wp","wp","wp","wp","wp","wp","wr","wn","wb","wq","wk","wb","wn","wr"];
  updateRoom({activeGame:"chess",status:"playing",gameState:{type:"chess",white:ids[0],black:ids[1],board,turn:"white",history:[],winner:null,rewardsGiven:false}});
}
function pieceColor(piece){ return piece ? piece[0]==='w'?'white':'black' : null; }
function idxToRC(i){ return [Math.floor(i/8), i%8]; }
function rcToIdx(r,c){ return r*8+c; }
function inside(r,c){ return r>=0&&r<8&&c>=0&&c<8; }
function legalMoves(board,from){
  const piece=board[from]; if(!piece) return [];
  const color=pieceColor(piece), enemy=color==='white'?'black':'white';
  const [r,c]=idxToRC(from), type=piece[1]; const moves=[];
  const push=(rr,cc)=>{ if(!inside(rr,cc)) return; const target=board[rcToIdx(rr,cc)]; if(!target||pieceColor(target)!==color) moves.push(rcToIdx(rr,cc)); };
  if(type==='p'){
    const dir=color==='white'?-1:1; const start=color==='white'?6:1;
    const one=r+dir; if(inside(one,c)&&!board[rcToIdx(one,c)]) moves.push(rcToIdx(one,c));
    const two=r+dir*2; if(r===start && !board[rcToIdx(one,c)] && inside(two,c) && !board[rcToIdx(two,c)]) moves.push(rcToIdx(two,c));
    [[one,c-1],[one,c+1]].forEach(([rr,cc])=>{ if(inside(rr,cc)){ const t=board[rcToIdx(rr,cc)]; if(t&&pieceColor(t)===enemy) moves.push(rcToIdx(rr,cc)); } });
  }
  if(type==='n'){ [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]].forEach(([dr,dc])=>push(r+dr,c+dc)); }
  if(type==='k'){ [-1,0,1].forEach(dr=>[-1,0,1].forEach(dc=>{ if(dr||dc) push(r+dr,c+dc); })); }
  const slide=(dirs)=>{ dirs.forEach(([dr,dc])=>{ let rr=r+dr, cc=c+dc; while(inside(rr,cc)){ const idx=rcToIdx(rr,cc), t=board[idx]; if(!t){ moves.push(idx); } else { if(pieceColor(t)!==color) moves.push(idx); break; } rr+=dr; cc+=dc; } }); };
  if(type==='b'||type==='q') slide([[-1,-1],[-1,1],[1,-1],[1,1]]);
  if(type==='r'||type==='q') slide([[-1,0],[1,0],[0,-1],[0,1]]);
  return moves;
}
function myChessColor(gs){ return state.myId===gs.white?"white":state.myId===gs.black?"black":null; }
async function clickChessSquare(index){
  const gs=state.room.gameState; if(!gs||gs.type!=="chess"||gs.winner) return;
  const myColor=myChessColor(gs); if(!myColor){ toast("Ahora mismo eres espectador"); return; }
  if(gs.turn!==myColor){ toast("Es el turno del rival"); return; }
  const board=gs.board, selected=ui.chessSelected, piece=board[index];
  if(selected===null){ if(piece && pieceColor(piece)===myColor){ ui.chessSelected=index; renderStage(state.room); } return; }
  if(selected===index){ ui.chessSelected=null; renderStage(state.room); return; }
  const selectedPiece=board[selected];
  if(piece && pieceColor(piece)===myColor){ ui.chessSelected=index; renderStage(state.room); return; }
  const moves=legalMoves(board,selected);
  if(!moves.includes(index)){ toast("Movimiento no válido"); return; }
  const newBoard=[...board]; const moving=selectedPiece; const captured=newBoard[index]; newBoard[index]=moving; newBoard[selected]=null;
  const [row]=idxToRC(index); if(moving==='wp' && row===0) newBoard[index]='wq'; if(moving==='bp' && row===7) newBoard[index]='bq';
  const hist=[...(gs.history||[])]; hist.unshift(`${myColor==='white'?'Blancas':'Negras'}: ${selected} → ${index}${captured?' x':''}`);
  const next= myColor==='white' ? 'black':'white';
  const winner = captured && (captured==='wk' || captured==='bk') ? myColor : null;
  ui.chessSelected=null;
  await updateNested("gameState", {...gs, board:newBoard, turn: winner?gs.turn:next, history:hist.slice(0,40), winner});
  if(winner){ await awardMatchResult(state.myId,[gs.white,gs.black]); toast("Victoria: +25 Coins · rival +10"); }
}
function renderChess(stage,gs){
  const selected=ui.chessSelected, valid=selected!==null?legalMoves(gs.board,selected):[]; const myColor=myChessColor(gs);
  stage.innerHTML=`<div class="chess-wrap"><div><div class="game-info-bar"><div><span class="eyebrow">AJEDREZ ONLINE</span><h2>${gs.winner?`Ganador: ${esc(state.room.players?.[(gs.winner==='white'?gs.white:gs.black)]?.name||gs.winner)}`:'Partida en curso'}</h2></div><div class="turn-pill">Turno: <b>${gs.turn==='white'?'Blancas':'Negras'}</b></div></div><div class="chess-board">${gs.board.map((piece,i)=>{ const [r,c]=idxToRC(i); const cellClass=(r+c)%2===0?'light':'dark'; const extra = [selected===i?'selected':'', valid.includes(i)?'legal':''].join(' '); const icon=piece?pieceIcons[piece]:''; const pclass=piece?`piece-${piece[0]==='w'?'white':'black'}`:''; return `<button class="chess-cell ${cellClass} ${extra}" data-cell="${i}"><span class="${pclass}">${icon}</span></button>`; }).join('')}</div></div><div class="chess-side"><div class="legend"><div><span>Blancas</span><b>${esc(state.room.players?.[gs.white]?.name||'Jugador 1')}</b></div><div><span>Negras</span><b>${esc(state.room.players?.[gs.black]?.name||'Jugador 2')}</b></div><div><span>Tu color</span><b>${myColor? (myColor==='white'?'Blancas':'Negras') : 'Espectador'}</b></div><div><span>Reglas</span><b>Movimientos reales · sin enroque</b></div></div>${gs.winner?`<div class="winner-banner">🏆 ${gs.winner==='white'?'Blancas':'Negras'} ganan la partida</div>`:`<div class="notice">Haz clic en una pieza y luego en la casilla destino. Las jugadas legales se resaltan en azul.</div>`}<div><span class="eyebrow">Historial</span><div class="history-list">${(gs.history||[]).map(m=>`<div class="history-item">${esc(m)}</div>`).join('')||'<div class="history-item">Aún no hay movimientos.</div>'}</div></div></div></div>`;
  $$(".chess-cell",stage).forEach(btn=>btn.onclick=()=>clickChessSquare(+btn.dataset.cell));
}

const PARCHIS_COLORS=["red","blue","yellow","green"];
const PARCHIS_START_CELL={red:39,blue:22,yellow:5,green:56};
const PARCHIS_SAFE_CELLS=new Set([5,12,17,22,29,34,39,46,51,56,63,68]);
const PARCHIS_TRACK=68;
const PARCHIS_GOAL=75;

function buildParchisTrackCoords(){
  const c={};
  // Bottom sector: 60..68 on the left side, 1..8 on the right side.
  for(let n=60;n<=68;n++) c[n]=[9+(n-60),8];
  for(let n=1;n<=8;n++) c[n]=[18-n,10];
  // Right sector: 9..17 bottom lane, 18..25 top lane.
  for(let n=9;n<=17;n++) c[n]=[10,9+(n-9)];
  for(let n=18;n<=25;n++) c[n]=[8,17-(n-18)];
  // Top sector: 26..34 right lane, 35..42 left lane.
  for(let n=26;n<=34;n++) c[n]=[9-(n-26),10];
  for(let n=35;n<=42;n++) c[n]=[1+(n-35),8];
  // Left sector: 43..51 top lane, 52..59 bottom lane.
  for(let n=43;n<=51;n++) c[n]=[8,9-(n-43)];
  for(let n=52;n<=59;n++) c[n]=[10,1+(n-52)];
  return c;
}
const PARCHIS_TRACK_COORDS=buildParchisTrackCoords();
const PARCHIS_LANE_COORDS={
  red:Array.from({length:7},(_,i)=>[2+i,9]),
  blue:Array.from({length:7},(_,i)=>[9,16-i]),
  green:Array.from({length:7},(_,i)=>[9,2+i]),
  yellow:Array.from({length:7},(_,i)=>[16-i,9])
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
  const value=Math.floor(Math.random()*6)+1; gs.startRolls[state.myId]=value;
  gs.log=[`${myPlayerName()} saca ${value} para decidir el inicio.`,...(gs.log||[])].slice(0,30);
  const queue=gs.rollQueue||[]; const nextIndex=(gs.rollIndex||0)+1;
  if(nextIndex<queue.length){ gs.rollIndex=nextIndex; gs.currentTurn=queue[nextIndex]; }
  else{
    const max=Math.max(...queue.map(id=>Number(gs.startRolls[id]||0))); const tied=queue.filter(id=>Number(gs.startRolls[id]||0)===max);
    if(tied.length>1){ gs.rollQueue=tied; gs.rollIndex=0; gs.startRolls={}; gs.currentTurn=tied[0]; gs.log=[`Empate con ${max}. Los empatados vuelven a tirar.`,...(gs.log||[])].slice(0,30); }
    else{ gs.phase="play"; gs.currentTurn=tied[0]; gs.rollQueue=[]; gs.rollIndex=0; gs.startRolls={}; gs.log=[`${state.room.players?.[tied[0]]?.name||"Jugador"} empieza la partida.`,...(gs.log||[])].slice(0,30); }
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
function parchisTokensAtTrack(gs,cell){
  const out=[]; (gs.players||[]).forEach(p=>p.pieces.forEach((progress,i)=>{ if(globalParchisCell(p,progress)===cell) out.push({p,i}); })); return out;
}
function parchisTokensAtLane(gs,color,laneIndex){
  const out=[]; const progress=68+laneIndex; (gs.players||[]).filter(p=>p.color===color).forEach(p=>p.pieces.forEach((x,i)=>{ if(x===progress)out.push({p,i}); })); return out;
}
function parchisTokenHtml(gs,player,pieceIndex,extra=""){
  const mine=player.id===state.myId; const legal=mine&&legalParchisPieces(gs,state.myId).includes(pieceIndex); const tag=mine?'button':'span';
  return `<${tag} class="parchis-token ${player.color} ${legal?'movable':''} ${extra}" ${mine?`data-parchis-piece="${pieceIndex}" ${legal?'':'disabled'}`:''} title="${esc(state.room.players?.[player.id]?.name||'Jugador')} · ficha ${pieceIndex+1}">${pieceIndex+1}</${tag}>`;
}
function renderParchisHome(gs,player,color){
  const homePieces=player?player.pieces.map((p,i)=>p===-1?i:null).filter(i=>i!==null):[];
  const name=player?(state.room.players?.[player.id]?.name||"Jugador"):"Libre";
  return `<div class="parchis-home home-${color}"><div class="home-circle"><b>${esc(name)}</b><small>${player?`${homePieces.length} en casa`:"Sin jugador"}</small><div class="home-token-grid">${player?homePieces.map(i=>parchisTokenHtml(gs,player,i)).join(''):''}</div></div></div>`;
}
function renderParchisBoard(gs){
  const cells=Array.from({length:68},(_,i)=>i+1).map(cell=>{
    const [r,c]=PARCHIS_TRACK_COORDS[cell]; const tokens=parchisTokensAtTrack(gs,cell); const startColor=Object.entries(PARCHIS_START_CELL).find(([,n])=>n===cell)?.[0];
    return `<div class="parchis-cell ${PARCHIS_SAFE_CELLS.has(cell)?'safe':''} ${startColor?`start-${startColor}`:''}" style="grid-row:${r};grid-column:${c}"><span class="cell-number">${cell}</span><div class="cell-tokens">${tokens.map(x=>parchisTokenHtml(gs,x.p,x.i)).join('')}</div></div>`;
  }).join('');
  const lanes=PARCHIS_COLORS.flatMap(color=>PARCHIS_LANE_COORDS[color].map(([r,c],i)=>{ const toks=parchisTokensAtLane(gs,color,i); return `<div class="parchis-lane-cell lane-${color}" style="grid-row:${r};grid-column:${c}"><span>${i+1}</span><div class="cell-tokens">${toks.map(x=>parchisTokenHtml(gs,x.p,x.i)).join('')}</div></div>`; })).join('');
  const homes=PARCHIS_COLORS.map(color=>renderParchisHome(gs,(gs.players||[]).find(p=>p.color===color),color)).join('');
  const goalTokens=(gs.players||[]).flatMap(p=>p.pieces.map((x,i)=>x===PARCHIS_GOAL?parchisTokenHtml(gs,p,i,'goal-token'):null).filter(Boolean)).join('');
  return `<div class="parchis-classic-board">${homes}${cells}${lanes}<div class="parchis-goal"><div class="goal-tri red"></div><div class="goal-tri blue"></div><div class="goal-tri yellow"></div><div class="goal-tri green"></div><div class="goal-tokens">${goalTokens}</div></div></div>`;
}
function renderParchis(stage,gs){
  const me=parchisPlayer(gs,state.myId); const legal=legalParchisPieces(gs,state.myId); const phaseText=gs.phase==="rolloff"?'Sorteo de inicio':gs.phase==="finished"?'Partida terminada':'Partida en curso';
  stage.innerHTML=`<div class="parchis-real-wrap"><div class="parchis-main"><div class="game-info-bar"><div><span class="eyebrow">PARCHÍS CLÁSICO</span><h2>${gs.winner?`Ganador: ${esc(state.room.players?.[gs.winner]?.name||'Jugador')}`:phaseText}</h2></div><div class="turn-pill">Turno de <b>${esc(state.room.players?.[gs.currentTurn]?.name||'...')}</b></div></div>${renderParchisBoard(gs)}</div><div class="parchis-control-panel"><div class="parchis-dice-box"><span>DADO</span><div class="dice big-dice">${gs.dice?diceFace(gs.dice):'—'}</div>${gs.effectiveRoll&&gs.effectiveRoll!==gs.dice?`<small>El 6 vale ${gs.effectiveRoll}</small>`:''}</div><div class="legend"><div><span>Tu color</span><b>${me?me.color:'Espectador'}</b></div><div><span>Fichas en meta</span><b>${me?me.pieces.filter(p=>p===PARCHIS_GOAL).length:0}/4</b></div><div><span>Premios</span><b>Ganar +25 · Perder +10</b></div></div>${gs.phase==="rolloff"?`<button id="parchisStartRollBtn" class="btn primary full">🎲 Tirar para decidir quién empieza</button><div class="notice">Todos tiran. El número más alto empieza; si hay empate, los empatados vuelven a tirar.</div>`:gs.winner?`<div class="winner-banner">🏆 ${esc(state.room.players?.[gs.winner]?.name||'Jugador')} ha metido sus 4 fichas en la meta.</div>`:`<button id="parchisRollBtn" class="btn primary full" ${gs.currentTurn!==state.myId||gs.dice||gs.pendingBonus?'disabled':''}>🎲 Tirar dado</button>${gs.pendingBonus?`<div class="winner-banner">Bonus de ${gs.pendingBonus.steps} casillas: elige otra ficha.</div>`:gs.dice?`<div class="notice">Elige una de tus fichas resaltadas (${legal.length} movimiento${legal.length===1?'':'s'} posible${legal.length===1?'':'s'}).</div>`:`<div class="notice">Salida con 5 · 6 repite · tres 6 penalizan · seguros · barreras · bonus de 20 al comer y 10 al llegar a meta.</div>`}`}<div><span class="eyebrow">Eventos</span><div class="race-log">${(gs.log||[]).map(m=>`<div class="race-log-item">${esc(m)}</div>`).join('')}</div></div></div></div>`;
  $("#parchisStartRollBtn")?.addEventListener("click",rollParchisStart); $("#parchisRollBtn")?.addEventListener("click",rollParchis);
  $$('[data-parchis-piece]',stage).forEach(btn=>btn.onclick=()=>moveParchisPiece(+btn.dataset.parchisPiece));
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
