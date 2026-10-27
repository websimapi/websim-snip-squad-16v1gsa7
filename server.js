// server.js - SnipShapes backend.
//  * Puzzle engine + level data: shared with the browser (the client imports
//    these exports from /server.js), so the server can replay a round and
//    verify a win instead of trusting the client.
//  * Realtime room: lobbies, seats (guest sub-accounts), host lock, action
//    relay (lockstep), win verification and progress saving.
//  * /api/progress: the signed-in visitor's saved progress.
// Keep this file self-contained: no imports.

export const schema = `
CREATE TABLE IF NOT EXISTS progress (
  user_id TEXT NOT NULL,
  username TEXT,
  level INTEGER NOT NULL,
  best_moves INTEGER,
  clears INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER,
  PRIMARY KEY (user_id, level)
);
CREATE TABLE IF NOT EXISTS clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT,
  level INTEGER NOT NULL,
  moves INTEGER NOT NULL,
  players INTEGER NOT NULL,
  lobby TEXT,
  created_at INTEGER
);
CREATE INDEX IF NOT EXISTS clears_user ON clears (user_id);
`;

// ---------------------------------------------------------------------------
// Puzzle engine: deterministic, pure. Same level + same action list = same state.
// ---------------------------------------------------------------------------

export const DIRS = [
  [0, -1], // up
  [1, 0], // right
  [0, 1], // down
  [-1, 0], // left
];

// Body shapes live in a square box of SIZE x SIZE cells and rotate in place
// around the box center. Odd SIZE keeps the rotation center on a cell.
export const SIZE = 7;
const CENTER = (SIZE - 1) / 2;

// rows: strings, '#' = filled. Centers the shape in the box. Returns the
// cells inside the box plus the offset that was applied.
export function centeredCells(rows) {
  const pts = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") pts.push([x, y]); }));
  if (!pts.length) return { cells: [], ox: 0, oy: 0 };
  const minX = Math.min(...pts.map((p) => p[0]));
  const maxX = Math.max(...pts.map((p) => p[0]));
  const minY = Math.min(...pts.map((p) => p[1]));
  const maxY = Math.max(...pts.map((p) => p[1]));
  const ox = Math.floor((SIZE - (maxX - minX + 1)) / 2) - minX;
  const oy = Math.floor((SIZE - (maxY - minY + 1)) / 2) - minY;
  return { cells: pts.map(([x, y]) => [x + ox, y + oy]), ox, oy };
}

export function gridFromCells(cells) {
  const g = new Uint8Array(SIZE * SIZE);
  for (const [x, y] of cells) g[y * SIZE + x] = 1;
  return g;
}

// Rotate the box 90 degrees clockwise per step about its center cell.
export function rotateGrid(g, dir) {
  let out = g;
  const steps = ((dir % 4) + 4) % 4;
  for (let s = 0; s < steps; s++) {
    const n = new Uint8Array(SIZE * SIZE);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!out[y * SIZE + x]) continue;
        const dx = x - CENTER, dy = y - CENTER;
        const nx = Math.round(CENTER - dy), ny = Math.round(CENTER + dx);
        n[ny * SIZE + nx] = 1;
      }
    }
    out = n;
  }
  return out;
}

// World cells of a body. body.x/y is the top-left of its SIZE box.
export function worldCells(b) {
  const out = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (b.grid[y * SIZE + x]) out.push([b.x + x, b.y + y]);
    }
  }
  return out;
}

// Level bodies are authored with (x,y) = world position of the shape's
// top-left cell. The engine stores the box origin, so shift by the centering
// offset.
export function createState(level) {
  return {
    w: level.w,
    h: level.h,
    walls: level.walls.map((row) => [...row].map((ch) => ch === "#")),
    bodies: level.bodies.map((b) => {
      const c = centeredCells(b.shape);
      return {
        id: b.id,
        name: b.name,
        color: b.color,
        x: b.x - c.ox,
        y: b.y - c.oy,
        rot: 0,
        grid: gridFromCells(c.cells),
        original: gridFromCells(c.cells),
        alive: true,
      };
    }),
    slots: level.slots.map((s) => ({
      body: s.body,
      cells: cellsAt(s.shape, s.x, s.y),
    })),
    won: false,
    actions: 0,
  };
}

// Target silhouettes sit at exact world coordinates (not centered).
function cellsAt(rows, x0, y0) {
  const out = [];
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") out.push([x0 + x, y0 + y]); }));
  return out;
}

function isSolid(state, x, y) {
  if (x < 0 || y < 0 || x >= state.w || y >= state.h) return true;
  return state.walls[y][x];
}

function gridFits(state, grid, ox, oy) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y * SIZE + x] && isSolid(state, ox + x, oy + y)) return false;
    }
  }
  return true;
}

export function getBody(state, id) {
  return state.bodies.find((b) => b.id === id) || null;
}

// Actions: { type:"move", body, dir:0..3 } | { type:"rotate", body, dir:1|-1 } | { type:"snip", body }
// "snip" cuts the overlap out of every other body the actor touches.
// Returns true when the action changed the state.
export function applyAction(state, action) {
  if (state.won) return false;
  const b = getBody(state, action.body);
  if (!b || (!b.alive && action.type !== "restore")) return false;
  let changed = false;

  if (action.type === "restore") {
    const g = rotateGrid(b.original, b.rot);
    const filled=[];for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++)if(g[y*SIZE+x])filled.push([x,y]);
    const nx=Math.max(1-Math.min(...filled.map(p=>p[0])),Math.min(b.x,state.w-2-Math.max(...filled.map(p=>p[0]))));
    const ny=Math.max(1-Math.min(...filled.map(p=>p[1])),Math.min(b.y,state.h-2-Math.max(...filled.map(p=>p[1]))));
    if (gridFits(state, g, nx, ny)) { b.x=nx;b.y=ny;b.grid = g; b.alive = true; changed = true; }
  } else if (action.type === "move") {
    const [dx, dy] = DIRS[action.dir] || [0, 0];
    if ((dx || dy) && gridFits(state, b.grid, b.x + dx, b.y + dy)) {
      b.x += dx;
      b.y += dy;
      changed = true;
    }
  } else if (action.type === "rotate") {
    const g = rotateGrid(b.grid, action.dir);
    if (gridFits(state, g, b.x, b.y)) {
      b.grid = g;
      b.rot = (b.rot + (action.dir > 0 ? 1 : 3)) % 4;
      changed = true;
    }
  } else if (action.type === "snip") {
    const mine = new Set(worldCells(b).map(([x, y]) => x + "," + y));
    for (const other of state.bodies) {
      if (other === b || !other.alive) continue;
      let cut = false;
      const g = other.grid.slice();
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (!g[y * SIZE + x]) continue;
          if (mine.has(other.x + x + "," + (other.y + y))) {
            g[y * SIZE + x] = 0;
            cut = true;
          }
        }
      }
      if (cut) {
        other.grid = g;
        if (!g.some((v) => v)) other.alive = false;
        changed = true;
      }
    }
  }

  if (changed) state.actions++;
  checkWin(state);
  return changed;
}

// Won when every slot is exactly filled by its body's cells.
export function checkWin(state) {
  if (!state.slots.length) return false;
  const ok = state.slots.every((slot) => {
    const b = getBody(state, slot.body);
    if (!b || !b.alive) return false;
    const cells = worldCells(b);
    if (cells.length !== slot.cells.length) return false;
    const want = new Set(slot.cells.map(([x, y]) => x + "," + y));
    return cells.every(([x, y]) => want.has(x + "," + y));
  });
  state.won = ok;
  return ok;
}

// Plain-data snapshot for rendering. Cells are world coordinates.
export function snapshot(state) {
  return {
    won: state.won,
    actions: state.actions,
    bodies: state.bodies.map((b) => ({
      id: b.id,
      rot: b.rot,
      alive: b.alive,
      cells: worldCells(b),
    })),
  };
}

// Replays an ordered action list from the level start. Used to verify wins.
export function replay(levelId, actions) {
  const st = createState(getLevel(levelId));
  for (const a of actions) applyAction(st, a);
  return st;
}

// ---------------------------------------------------------------------------
// Level data. Shapes are rows of '#'. Bodies start at (x,y); slots are the
// exact silhouette each body must become (same orientation) to win.
// ---------------------------------------------------------------------------

export const LEVELS = [{
  id: 1, name: "A little off the top", hint: "Overlap. Snip. Match all four outlines.",
  w: 22, h: 13,
  walls: Array.from({length:13}, (_,y)=> y===0 || y===12 ? "#".repeat(22) : "#"+".".repeat(20)+"#"),
  bodies: [
    {id:0, name:"Poppy", color:"#f18a80", x:2,y:2,shape:["####","####","####"]},
    {id:1, name:"Blu", color:"#80c4d3", x:8,y:2,shape:["##","##","##"]},
    {id:2, name:"Sunny", color:"#ecc85e", x:2,y:7,shape:["###","###","###"]},
    {id:3, name:"Sprout", color:"#9bb995", x:8,y:8,shape:["##","##"]},
  ],
  slots: [
    {body:0,x:14,y:2,shape:["##","##","##"]},
    {body:1,x:17,y:2,shape:["##","##","##"]},
    {body:2,x:14,y:7,shape:["###","###","###"]},
    {body:3,x:18,y:8,shape:["##","##"]},
  ],
}];

export function getLevel(id) {
  return LEVELS.find((l) => l.id === id) || LEVELS[0];
}

// ---------------------------------------------------------------------------
// Lobbies (in memory; the room restarts clear them, clients rejoin on reconnect)
// ---------------------------------------------------------------------------

const lobbies = new Map();
const conns = new Map();
const where = new Map();
let listDirty = false;
const send = (id,msg) => { try { conns.get(id)?.send(msg); } catch {} };
const nameOf = c => c.identity === "user" ? c.username : "Visitor " + c.id.slice(-3).toUpperCase();
const avatar = u => u ? "https://images.websim.com/avatar/" + encodeURIComponent(u) : null;
function code() {
  let c; do {c=Array.from({length:4},()=>"ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random()*"ABCDEFGHJKMNPQRSTUVWXYZ23456789".length)]).join("");} while(lobbies.has(c)); return c;
}
function assignments(l) {
  const active=l.seats.filter(Boolean);
  return Array.from({length:4},(_,i)=>active.length ? active[i%active.length].id : null);
}
function seatView(s,l,id) {
  return s && {...s, mine:s.owner===id, avatar:avatar(s.username), bodies:assignments(l).flatMap((v,i)=>v===s.id?[i]:[])};
}
function view(l,id) {
  const host=l.members.get(l.host);
  return {code:l.code,locked:l.locked,status:l.status,round:l.round,level:1,moves:l.state.actions,
    hostId:l.host,hostName:host?.name,hostAvatar:avatar(host?.username),
    seats:l.seats.map(s=>seatView(s,l,id)), assignments:assignments(l),
    players:l.seats.filter(Boolean).length, spectators:[...l.members.keys()].filter(k=>!l.seats.some(s=>s?.owner===k)).length,
    you:{id,host:id===l.host,seats:l.seats.filter(s=>s?.owner===id).map(s=>s.id)},saved:l.saved||null};
}
function list() {return [...lobbies.values()].sort((a,b)=>b.created-a.created).slice(0,8).map(l=>{
  const host=l.members.get(l.host),n=l.seats.filter(Boolean).length;
  return {code:l.code,hostName:host?.name,hostAvatar:avatar(host?.username),players:n,full:n===4,locked:l.locked,status:l.status};
});}
function notify(l) { for(const id of l.members.keys()) send(id,{t:"lobby",lobby:view(l,id)}); listDirty=true; }
function sync(l,id) { send(id,{t:"sync",round:l.round,status:l.status,seq:l.seq,state:{won:l.state.won,actions:l.state.actions,bodies:l.state.bodies.map(b=>({id:b.id,x:b.x,y:b.y,rot:b.rot,alive:b.alive,grid:Array.from(b.grid)}))}}); }
function leave(id) {
  const l=lobbies.get(where.get(id)); where.delete(id); if(!l)return;
  l.members.delete(id);l.seats=l.seats.map(s=>s?.owner===id?null:s);
  if(!l.members.size) lobbies.delete(l.code);
  else {if(l.host===id)l.host=l.members.keys().next().value;notify(l);}
  listDirty=true;
}
function claim(l,c,guest=false) {
  const idx=l.seats.indexOf(null);if(idx<0)return null;
  const n=guest?++l.guestSerial:0;
  const s={id:c.id+":"+n,owner:c.id,username:c.identity==="user"?c.username:null,
    label:nameOf(c)+(guest?" (GUEST "+n+")":""),guest};
  l.seats[idx]=s;return s;
}
async function saveClear(l,env) {
  const stmts=[],now=Date.now();
  for(const id of new Set(l.seats.filter(Boolean).map(s=>s.owner))) {
    const m=l.members.get(id);if(m?.identity!=="user"||!m.userId)continue;
    stmts.push(env.DB.prepare("INSERT INTO progress (user_id,username,level,best_moves,clears,updated_at) VALUES (?,?,1,?,1,?) ON CONFLICT(user_id,level) DO UPDATE SET best_moves=MIN(progress.best_moves,excluded.best_moves), clears=progress.clears+1,updated_at=excluded.updated_at").bind(m.userId,m.username,l.state.actions,now));
    stmts.push(env.DB.prepare("INSERT INTO clears (user_id,username,level,moves,players,lobby,created_at) VALUES (?,?,1,?,?,?,?)").bind(m.userId,m.username,l.state.actions,l.seats.filter(Boolean).length,l.code,now));
  }
  if(stmts.length) {await env.DB.batch(stmts);l.saved="saved";} else l.saved="guest";
}
export default {async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/api/progress" && request.method==="GET") {
    const id=request.headers.get("x-websim-user-id");
    if(!id)return Response.json({signedIn:false,rows:[]});
    const {results}=await env.DB.prepare("SELECT level,best_moves,clears FROM progress WHERE user_id=? ORDER BY level").bind(id).all();
    return Response.json({signedIn:true,rows:results});
  }
  return new Response("Not found",{status:404});
}};
export const room={
  tickMs:150,
  async onConnect(c,r){conns.set(c.id,c);send(c.id,{t:"welcome",you:{id:c.id,name:nameOf(c),signedIn:c.identity==="user"}});send(c.id,{t:"lobbies",list:list()});},
  async onMessage(c,raw,r,env){
    let m;try{m=JSON.parse(raw);}catch{return;}if(!m||typeof m!=="object")return;
    const err=msg=>send(c.id,{t:"error",msg});
    if(m.t==="create") {
      leave(c.id);const l={code:code(),host:c.id,locked:false,status:"lobby",round:0,created:Date.now(),seats:[null,null,null,null],members:new Map(),guestSerial:0,seq:0,state:createState(getLevel(1))};
      lobbies.set(l.code,l);l.members.set(c.id,{name:nameOf(c),username:c.identity==="user"?c.username:null,identity:c.identity,userId:c.userId});where.set(c.id,l.code);claim(l,c);notify(l);sync(l,c.id);return;
    }
    if(m.t==="join") {
      const l=lobbies.get(String(m.code||"").toUpperCase());if(!l)return err("That lobby has closed. Create a new one or try another code.");
      if(where.get(c.id)===l.code){notify(l);sync(l,c.id);return;}
      leave(c.id);l.members.set(c.id,{name:nameOf(c),username:c.identity==="user"?c.username:null,identity:c.identity,userId:c.userId});where.set(c.id,l.code);
      if(!l.locked&&!m.spectate)claim(l,c);notify(l);sync(l,c.id);return;
    }
    if(m.t==="leave"){leave(c.id);send(c.id,{t:"left"});return;}
    const l=lobbies.get(where.get(c.id));if(!l)return err("Join a lobby first.");
    const host=l.host===c.id;
    if(m.t==="guest") {
      if(l.locked)return err("Unlock the lobby before adding players.");
      const s=claim(l,c,l.seats.some(s=>s?.owner===c.id));if(!s)return err("All four player slots are taken.");
      send(c.id,{t:"seated",seat:s.id,device:String(m.device||"").slice(0,20)});notify(l);return;
    }
    if(m.t==="unseat") {const i=l.seats.findIndex(s=>s?.id===m.seat);if(i>=0&&(host||l.seats[i].owner===c.id)){l.seats[i]=null;notify(l);}return;}
    if(m.t==="lock"){if(host){l.locked=!!m.locked;notify(l);}return;}
    if(m.t==="start") {
      if(!host)return err("Only the host can restart the puzzle.");
      l.round++;l.seq=0;l.state=createState(getLevel(1));l.status="playing";l.saved=null;notify(l);for(const id of l.members.keys())sync(l,id);return;
    }
    if(m.t==="sync"){sync(l,c.id);return;}
    if(m.t==="act") {
      if(l.status!=="playing"||m.round!==l.round)return;
      const a=m.action,body=a?.body;
      if(!Number.isInteger(body)||body<0||body>3)return;
      const seat=l.seats.find(s=>s?.id===assignments(l)[body]);if(!seat||seat.owner!==c.id)return;
      if(!["move","rotate","snip","restore"].includes(a.type))return;
      if(a.type==="move"&&(!Number.isInteger(a.dir)||a.dir<0||a.dir>3))return;
      if(a.type==="rotate"&&a.dir!==1&&a.dir!==-1)return;
      const now=Date.now();l.lastInput ||= new Map();const key=c.id+":"+body;
      if(now-(l.lastInput.get(key)||0)<55){send(c.id,{t:"ack",token:m.token});return;}l.lastInput.set(key,now);
      const action={type:a.type,body,dir:a.dir};if(!applyAction(l.state,action)) {send(c.id,{t:"ack",token:m.token,action:null});return;}
      l.seq++;
      for(const id of l.members.keys())send(id,{t:"act",action,seq:l.seq-1,round:l.round,from:c.id,token:m.token});
      if(l.state.won){l.status="won";notify(l);try{await saveClear(l,env);}catch(e){l.saved="error";console.error("Progress save failed",e);}notify(l);}
    }
  },
  async onClose(c){leave(c.id);conns.delete(c.id);},
  async onTick(r){if(listDirty){listDirty=false;r.broadcast({t:"lobbies",list:list()});}},
};
