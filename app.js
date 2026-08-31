const $ = (q, root=document) => root.querySelector(q);
const $$ = (q, root=document) => [...root.querySelectorAll(q)];

const FIREBASE_CONFIG = window.STREAMER_ARENA_FIREBASE_CONFIG || null;
const FIREBASE_VERSION = "12.18.0";

const games = [
  {id:"guess", name:"Adivina el juego", icon:"🧩", category:"preguntas", desc:"El host revela pistas y el chat intenta descubrir el videojuego.", tags:["2–100 jugadores","Chat"]},
  {id:"forty", name:"Las 40", icon:"🃏", category:"cartas", desc:"Mesa con baraja española de 40 cartas. Base preparada para reglas completas.", tags:["2–4 jugadores","Cartas"]},
  {id:"trivia", name:"Trivia relámpago", icon:"⚡", category:"preguntas", desc:"Preguntas rápidas. Gana Coins quien responda correctamente antes.", tags:["2–100 jugadores","Rápido"]},
  {id:"number", name:"Batalla de números", icon:"🔢", category:"rapido", desc:"Todos eligen un número. El más cercano al objetivo gana la ronda.", tags:["2–100 jugadores","Rápido"]},
  {id:"emoji", name:"Adivina por emojis", icon:"😎", category:"preguntas", desc:"Películas, juegos y personajes representados solo con emojis.", tags:["2–100 jugadores","Chat"]},
  {id:"wheel", name:"Ruleta del streamer", icon:"🎯", category:"rapido", desc:"Retos, premios, castigos divertidos y recompensas configurables.", tags:["1–100 jugadores","Evento"]}
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
  profile: JSON.parse(localStorage.getItem("sa_profile") || '{"name":"","coins":250,"gems":0}'),
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

function saveProfile(){
  localStorage.setItem("sa_profile", JSON.stringify(state.profile));
  renderWallet();
}
function renderWallet(){
  $("#coins").textContent = state.profile.coins;
  $("#gems").textContent = state.profile.gems;
  $("#modalCoins").textContent = state.profile.coins;
  $("#modalGems").textContent = state.profile.gems;
}
function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2400);
}
function esc(s=""){return s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}

function gameCard(g){
  return `<article class="panel game-card" data-game="${g.id}" data-category="${g.category}">
    <div class="game-icon">${g.icon}</div>
    <h3>${g.name}</h3><p>${g.desc}</p>
    <div class="game-meta">${g.tags.map(t=>`<span class="tag">${t}</span>`).join("")}</div>
    <span class="play-arrow">→</span>
  </article>`;
}
$("#featuredGames").innerHTML = games.slice(0,3).map(gameCard).join("");
$("#allGames").innerHTML = games.map(gameCard).join("");

function showView(name){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));
  $$(".nav-btn").forEach(v=>v.classList.toggle("active",v.dataset.view===name));
  scrollTo({top:0,behavior:"smooth"});
}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
$$("[data-view-target]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.viewTarget)));
$("#heroCreate").onclick=$("#gamesCreate").onclick=()=>{showView("sala"); setTimeout(()=>$("#hostName").focus(),150)};
$$(".game-card").forEach(c=>c.addEventListener("click",()=>{
  showView("sala");
  $("#gameSelector").value = ["guess","forty","trivia"].includes(c.dataset.game) ? c.dataset.game : "guess";
}));

$$(".chip").forEach(ch=>ch.onclick=()=>{
  $$(".chip").forEach(c=>c.classList.remove("active")); ch.classList.add("active");
  const filter=ch.dataset.filter;
  $$("#allGames .game-card").forEach(c=>c.style.display=(filter==="all"||c.dataset.category===filter)?"":"none");
});

$("#profileBtn").onclick=()=>{
  $("#profileName").value=state.profile.name || state.myName;
  renderWallet(); $("#profileDialog").showModal();
};
$("#saveProfileBtn").onclick=()=>{
  state.profile.name=$("#profileName").value.trim();
  saveProfile(); toast("Perfil guardado");
};

async function initBackend(){
  if(!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey.includes("PEGA_")){
    state.backend="demo"; return;
  }
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

function roomPath(code){ return `rooms/${code}`; }
function randomCode(){ return Math.random().toString(36).slice(2,8).toUpperCase(); }
function now(){ return Date.now(); }
function demoKey(code){ return `sa_room_${code}`; }

function getDemoRoom(code){ return JSON.parse(localStorage.getItem(demoKey(code)) || "null"); }
function setDemoRoom(code, room){
  localStorage.setItem(demoKey(code),JSON.stringify(room));
  if(state.channel) state.channel.postMessage({type:"room",code});
  renderRoom(room);
}

async function createRoom(){
  const name=($("#hostName").value||state.profile.name||"Streamer").trim().slice(0,18);
  state.myName=name; state.profile.name=name; saveProfile();
  const code=randomCode();
  const room={
    code, createdAt:now(), hostId:state.myId, status:"lobby", activeGame:"guess",
    players:{[state.myId]:{name,coins:0,joinedAt:now(),host:true}},
    chat:{}, gameState:null
  };
  if(state.backend==="firebase"){
    const {ref,set}=state.dbApi; await set(ref(state.db,roomPath(code)),room);
  }else{
    setupDemoChannel(code); setDemoRoom(code,room);
  }
  enterRoom(code,true);
}
async function joinRoom(){
  const name=($("#joinName").value||state.profile.name||"Jugador").trim().slice(0,18);
  const code=$("#joinCode").value.trim().toUpperCase();
  if(code.length<4) return toast("Escribe un código de sala");
  state.myName=name; state.profile.name=name; saveProfile();
  if(state.backend==="firebase"){
    const {ref,get,child,update}=state.dbApi;
    const snap=await get(ref(state.db,roomPath(code)));
    if(!snap.exists()) return toast("Esa sala no existe");
    await update(ref(state.db,`${roomPath(code)}/players/${state.myId}`),{name,coins:0,joinedAt:now(),host:false});
  }else{
    const room=getDemoRoom(code); if(!room) return toast("Sala demo no encontrada en este navegador");
    room.players[state.myId]={name,coins:0,joinedAt:now(),host:false};
    setupDemoChannel(code); setDemoRoom(code,room);
  }
  enterRoom(code,false);
}
$("#createRoomBtn").onclick=createRoom;
$("#joinRoomBtn").onclick=joinRoom;
$("#joinCode").oninput=e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"");

function setupDemoChannel(code){
  if(state.channel) state.channel.close();
  state.channel=new BroadcastChannel(`sa_${code}`);
  state.channel.onmessage=()=>{const r=getDemoRoom(code);if(r)renderRoom(r)};
  window.addEventListener("storage",e=>{if(e.key===demoKey(code)){const r=getDemoRoom(code);if(r)renderRoom(r)}});
}
function enterRoom(code,isHost){
  state.roomCode=code; state.isHost=isHost;
  $("#roomGate").classList.add("hidden"); $("#roomLive").classList.remove("hidden");
  $("#roomCode").textContent=code; $("#heroRoomCode").textContent=code;
  $("#roomTitle").textContent=`Sala ${code}`;
  if(state.backend==="firebase"){
    const {ref,onValue}=state.dbApi;
    if(state.unsubscribe) state.unsubscribe();
    state.unsubscribe=onValue(ref(state.db,roomPath(code)),snap=>{if(snap.exists())renderRoom(snap.val())});
  } else {
    setupDemoChannel(code); renderRoom(getDemoRoom(code));
  }
}
function renderRoom(room){
  if(!room)return; state.room=room;
  state.isHost=room.hostId===state.myId;
  $("#hostControls").classList.toggle("hidden",!state.isHost);
  $("#gameSelector").value=room.activeGame||"guess";
  const players=room.players||{};
  $("#playerCount").textContent=Object.keys(players).length;
  $("#playersList").innerHTML=Object.entries(players).map(([id,p])=>`<div class="player">
      <div class="player-left"><div class="player-avatar">${p.host?"🎙️":"🎮"}</div><div><b>${esc(p.name)}</b><small>${p.host?"Host":"Jugador"}</small></div></div>
      <span>${p.coins||0} 🪙</span>
    </div>`).join("") || `<div class="empty">Sin jugadores</div>`;
  renderChat(room.chat||{});
  renderStage(room);
}
function renderChat(chat){
  const el=$("#chatMessages");
  const items=Object.values(chat).sort((a,b)=>a.at-b.at).slice(-50);
  el.innerHTML=items.map(m=>`<div class="chat-msg"><b>${esc(m.name)}</b> ${esc(m.text)}<small>${new Date(m.at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</small></div>`).join("");
  el.scrollTop=el.scrollHeight;
}
async function updateRoom(patch){
  if(!state.roomCode)return;
  if(state.backend==="firebase"){
    const {ref,update}=state.dbApi; await update(ref(state.db,roomPath(state.roomCode)),patch);
  } else {
    const room=getDemoRoom(state.roomCode); Object.assign(room,patch); setDemoRoom(state.roomCode,room);
  }
}
async function updateNested(path,value){
  if(state.backend==="firebase"){
    const {ref,set}=state.dbApi; await set(ref(state.db,`${roomPath(state.roomCode)}/${path}`),value);
  } else {
    const room=getDemoRoom(state.roomCode);
    const bits=path.split("/"); let cur=room;
    bits.slice(0,-1).forEach(b=>cur=cur[b]??=( {} ));
    cur[bits.at(-1)]=value; setDemoRoom(state.roomCode,room);
  }
}
$("#copyRoomBtn").onclick=async()=>{
  const url=`${location.origin}${location.pathname}?room=${state.roomCode}`;
  try{await navigator.clipboard.writeText(url);toast("Enlace copiado")}catch{toast(`Código: ${state.roomCode}`)}
};

$("#chatForm").onsubmit=async e=>{
  e.preventDefault(); const text=$("#chatInput").value.trim(); if(!text||!state.roomCode)return;
  const id=`m_${now()}_${Math.random().toString(36).slice(2,6)}`;
  await updateNested(`chat/${id}`,{name:state.myName||state.profile.name||"Jugador",text,at:now()});
  $("#chatInput").value="";
};

$("#gameSelector").onchange=e=>state.isHost&&updateRoom({activeGame:e.target.value,gameState:null,status:"lobby"});
$("#startGameBtn").onclick=async()=>{
  if(!state.isHost)return;
  const game=$("#gameSelector").value;
  if(game==="guess"){
    const q=guessBank[Math.floor(Math.random()*guessBank.length)];
    await updateRoom({activeGame:"guess",status:"playing",gameState:{type:"guess",answer:q.answer,clues:q.clues,revealed:1,winner:null,startedAt:now()}});
  }else if(game==="forty"){
    await updateRoom({activeGame:"forty",status:"playing",gameState:{type:"forty",deck:shuffle(spanishDeck()),startedAt:now()}});
  }else{
    const q=triviaBank[Math.floor(Math.random()*triviaBank.length)];
    await updateRoom({activeGame:"trivia",status:"playing",gameState:{type:"trivia",q:q.q,a:q.a,ok:q.ok,winner:null,startedAt:now()}});
  }
};

function renderStage(room){
  const stage=$("#gameStage"), gs=room.gameState;
  if(!gs){stage.innerHTML=`<div class="stage-empty"><div class="big">🎲</div><h3>Esperando partida</h3><p>${state.isHost?"Elige un juego y pulsa “Iniciar partida”.":"El host está preparando el siguiente juego."}</p></div>`;return}
  if(gs.type==="guess") renderGuess(stage,gs);
  if(gs.type==="forty") renderForty(stage,gs);
  if(gs.type==="trivia") renderTrivia(stage,gs);
}
function renderGuess(stage,gs){
  stage.innerHTML=`<div class="guess-wrap">
    <span class="eyebrow">ADIVINA EL JUEGO</span><h3>¿Qué videojuego es?</h3>
    <div class="clues-list">${gs.clues.map((c,i)=>`<div class="clue-item ${i>=gs.revealed?"locked":""}"><b>Pista ${i+1}</b> · ${esc(c)}</div>`).join("")}</div>
    ${state.isHost&&gs.revealed<gs.clues.length&&!gs.winner?`<button id="revealClue" class="btn ghost">Revelar otra pista</button>`:""}
    ${!gs.winner?`<form id="guessForm" class="guess-form"><input id="guessInput" placeholder="Escribe tu respuesta..." autocomplete="off"><button class="btn primary">Responder</button></form>`:`<div class="answer-reveal">🏆 ${esc(gs.winner)} acertó: ${esc(gs.answer)}</div>`}
  </div>`;
  $("#revealClue")?.addEventListener("click",()=>updateNested("gameState/revealed",Math.min(gs.revealed+1,gs.clues.length)));
  $("#guessForm")?.addEventListener("submit",async e=>{
    e.preventDefault(); const answer=$("#guessInput").value.trim().toLowerCase();
    if(answer===gs.answer.toLowerCase()){
      const winner=state.myName||state.profile.name||"Jugador";
      await updateNested("gameState/winner",winner); rewardCoins(50);
      toast("+50 Coins · ¡Correcto!");
    }else{toast("No es correcto. Sigue intentando.");}
  });
}
function spanishDeck(){
  const suits=[["oros","🟡"],["copas","🏆"],["espadas","⚔️"],["bastos","🪵"]];
  const ranks=[1,2,3,4,5,6,7,10,11,12];
  return suits.flatMap(([suit,icon])=>ranks.map(rank=>({rank,suit,icon})));
}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function renderForty(stage,gs){
  const deck=gs.deck||spanishDeck(); const myIndex=Object.keys(state.room.players||{}).indexOf(state.myId);
  const start=Math.max(0,myIndex)*5; const hand=deck.slice(start,start+5);
  stage.innerHTML=`<div class="deck-wrap"><span class="eyebrow">LAS 40 · BARAJA ESPAÑOLA</span><h2>Tu mano</h2>
    <p style="color:#94a0ba">Versión base de mesa. El motor de reglas completas se añade en la siguiente fase.</p>
    <div class="hand">${hand.map(c=>`<div class="playing-card ${c.suit==="oros"||c.suit==="copas"?"red":""}"><span>${c.rank}</span><small>${c.icon}</small><em>${c.suit}</em></div>`).join("")}</div>
    ${state.isHost?`<button id="redeal" class="btn ghost" style="margin-top:25px">Volver a repartir</button>`:""}
  </div>`;
  $("#redeal")?.addEventListener("click",()=>updateNested("gameState/deck",shuffle(spanishDeck())));
}
function renderTrivia(stage,gs){
  stage.innerHTML=`<div class="guess-wrap"><span class="eyebrow">TRIVIA RELÁMPAGO</span><h3>${esc(gs.q)}</h3>
    <div class="clues-list">${gs.a.map((a,i)=>`<button class="clue-item trivia-answer" data-i="${i}" style="color:#fff;text-align:left;cursor:pointer">${String.fromCharCode(65+i)} · ${esc(a)}</button>`).join("")}</div>
    ${gs.winner?`<div class="answer-reveal">🏆 ${esc(gs.winner)} respondió primero.</div>`:""}
  </div>`;
  $$(".trivia-answer",stage).forEach(b=>b.onclick=async()=>{
    if(gs.winner)return;
    if(+b.dataset.i===gs.ok){await updateNested("gameState/winner",state.myName||state.profile.name||"Jugador");rewardCoins(25);toast("+25 Coins · ¡Correcto!")}
    else toast("Respuesta incorrecta");
  });
}
async function rewardCoins(amount){
  state.profile.coins+=amount; saveProfile();
  if(state.roomCode && state.room?.players?.[state.myId]){
    await updateNested(`players/${state.myId}/coins`,(state.room.players[state.myId].coins||0)+amount);
  }
}

$$(".buy-btn").forEach(btn=>btn.onclick=()=>{
  const pack=btn.dataset.pack;
  toast(`Pack de ${pack} Gems: conecta Stripe para cobrar de verdad`);
});

const qRoom=new URLSearchParams(location.search).get("room");
if(qRoom){showView("sala");$("#joinCode").value=qRoom.toUpperCase();}
renderWallet();
