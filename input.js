// input.js - normalizes keyboard, touch and gamepad input into game events.
// Every event carries a `device` id: "kb", "touch", or "pad:<gamepad index>".
// The lobby decides which seat/guest a device controls; this file does not.
//
// Event types:
//   { type: "dir", device, dir: 0..3 }      discrete step (repeats while held)
//   { type: "snip", device }
//   { type: "rotate", device, dir: 1|-1 }
//   { type: "cycle", device, step: 1|-1 }   switch the active character
//   { type: "start", device }               confirm / ready / pause
//   { type: "back", device }
//   { type: "pads", pads: [...] }           gamepad connect/disconnect

const KEY_DIR = {
  ArrowUp: 0, KeyW: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowDown: 2, KeyS: 2,
  ArrowLeft: 3, KeyA: 3,
};

const REPEAT_FIRST = 260; // ms before a held direction repeats
const REPEAT_EVERY = 120; // ms between repeats

export function createInput(emit) {
  const held = new Map(); // device+dir -> { t, next }
  const padPrev = new Map(); // pad index -> { buttons: bool[], dirs: int }
  let rafId = 0;
  let calibration = null;
  let custom = {};
  try { custom = JSON.parse(localStorage.getItem('snipsquad-pads') || '{}'); } catch {}
  const calibrationSteps = ['snip','rotCw','rotCcw','cycleNext','restore','start'];
  const stepNames = ['SNIP','ROTATE RIGHT','ROTATE LEFT','SWITCH CHARACTER','REFORM','START / JOIN'];
  function calibrationPrompt() {
    calibration.callback('Press the button for '+stepNames[calibration.step]+'.');
  }

  function fire(e) { emit(e); }

  function pressDir(device, dir) {
    const key = device + ":" + dir;
    const now = performance.now();
    if (!held.has(key)) {
      held.set(key, { next: now + REPEAT_FIRST });
      fire({ type: "dir", device, dir });
    }
  }
  function releaseDir(device, dir) { held.delete(device + ":" + dir); }

  // Keyboard -------------------------------------------------------------
  function onKeyDown(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.repeat && KEY_DIR[e.code] === undefined) return;
    const d = KEY_DIR[e.code];
    if (d !== undefined) { e.preventDefault(); pressDir("kb", d); return; }
    if (e.code === "KeyZ" || e.code === "Space") { e.preventDefault(); if (!e.repeat) fire({ type: "snip", device: "kb" }); }
    else if (e.code === "KeyX" || e.code === "KeyE") { if (!e.repeat) fire({ type: "rotate", device: "kb", dir: 1 }); }
    else if (e.code === "KeyR") { if (!e.repeat) fire({ type: "restore", device: "kb" }); }
    else if (/^Digit[1-4]$/.test(e.code)) { if (!e.repeat) fire({ type: "select", device: "kb", body: Number(e.code.slice(-1))-1 }); }
    else if (e.code === "KeyQ") { if (!e.repeat) fire({ type: "rotate", device: "kb", dir: -1 }); }
    else if (e.code === "Tab" || e.code === "KeyC") { e.preventDefault(); if (!e.repeat) fire({ type: "cycle", device: "kb", step: e.shiftKey ? -1 : 1 }); }
    else if (e.code === "Enter") { if (!e.repeat) fire({ type: "start", device: "kb" }); }
    else if (e.code === "Escape" || e.code === "Backspace") { if (!e.repeat) fire({ type: "back", device: "kb" }); }
  }
  function onKeyUp(e) {
    const d = KEY_DIR[e.code];
    if (d !== undefined) releaseDir("kb", d);
  }

  // Touch controls: call touchDir/touchButton from the on-screen pad ------
  const touch = {
    dir: (dir, down) => (down ? pressDir("touch", dir) : releaseDir("touch", dir)),
    snip: () => fire({ type: "snip", device: "touch" }),
    rotate: (dir) => fire({ type: "rotate", device: "touch", dir }),
    cycle: (step) => fire({ type: "cycle", device: "touch", step }),
    restore: () => fire({ type: "restore", device: "touch" }),
    start: () => fire({ type: "start", device: "touch" }),
  };

  // Gamepads -------------------------------------------------------------
  // Standard mapping (Xbox, PlayStation, Nintendo Pro, 8BitDo, most Joy-Con
  // pairs exposed as standard gamepads). Face buttons use POSITION, so the
  // bottom button is always "snip" whatever the label says.
  const PAD = {
    snip: 0, // bottom face button: A / Cross / B
    rotCw: 1, // right face button: B / Circle / A
    rotCcw: 2, // left face button: X / Square / Y
    cycleBack: 4, cycleNext: 5, // shoulder buttons
    start: 9, back: 8, restore: 3,
    up: 12, down: 13, left: 14, right: 15,
  };
  const STICK_DEAD = 0.5;

  function pollPads() {
    const pads = navigator.getGamepads ? [...navigator.getGamepads()].filter(Boolean).slice(0,4) : [];
    const list = pads.map((p) => ({ index: p.index, id: p.id, device: "pad:" + p.index, mapping: p.mapping }));
    const sig = list.map((p) => p.index + p.id).join("|");
    if (sig !== (pollPads.sig || "")) {
      pollPads.sig = sig;
      for (const k of [...padPrev.keys()]) if (!pads.some((p) => p.index === k)) padPrev.delete(k);
      fire({ type: "pads", pads: list });
    }
    for (const p of pads) {
      const device = "pad:" + p.index;
      const prev = padPrev.get(p.index) || { buttons: [], dir: -1 };
      const now = performance.now();
      const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
      const edge = (i) => Number.isInteger(i) && b(i) && !prev.buttons[i];
      if (calibration && calibration.index === p.index) {
        const pressed = p.buttons.findIndex((_,i) => edge(i));
        if (pressed >= 0) {
          if (Object.values(calibration.map).includes(pressed)) calibration.callback('That button is already assigned. Choose a different button for '+stepNames[calibration.step]+'.');
          else {
            calibration.map[calibrationSteps[calibration.step++]] = pressed;
            if (calibration.step === calibrationSteps.length) {
              custom[p.id] = calibration.map;
              try { localStorage.setItem('snipsquad-pads',JSON.stringify(custom)); } catch {}
              calibration.callback('Controller ready. Button assignments saved on this device.');
              calibration = null;
            } else calibrationPrompt();
          }
        }
        prev.buttons = p.buttons.map(x=>!!x.pressed);padPrev.set(p.index,prev);continue;
      }
      const map = {...PAD,...custom[p.id]};
      // Some non-standard Joy-Cons expose their only stick as axes 2/3.
      const axisOffset = !p.mapping && /Joy-Con/i.test(p.id) && p.axes.length >= 4 && !p.axes[0] && !p.axes[1] ? 2 : 0;

      // Directions: d-pad or left stick. One discrete step per press + repeats.
      const ax = p.axes[axisOffset] || 0, ay = p.axes[axisOffset+1] || 0;
      let dir = -1;
      if (b(map.up)) dir = 0;
      else if (b(map.right)) dir = 1;
      else if (b(map.down)) dir = 2;
      else if (b(map.left)) dir = 3;
      else if (Math.abs(ay) > STICK_DEAD && Math.abs(ay) >= Math.abs(ax)) dir = ay < 0 ? 0 : 2;
      else if (Math.abs(ax) > STICK_DEAD) dir = ax > 0 ? 1 : 3;

      if (dir !== prev.dir) {
        prev.dir = dir;
        prev.next = now + REPEAT_FIRST;
        if (dir >= 0) fire({ type: "dir", device, dir });
      } else if (dir >= 0 && now >= prev.next) {
        prev.next = now + REPEAT_EVERY;
        fire({ type: "dir", device, dir });
      }

      if (edge(map.snip)) fire({ type: "snip", device });
      if (edge(map.rotCw)) fire({ type: "rotate", device, dir: 1 });
      if (edge(map.rotCcw)) fire({ type: "rotate", device, dir: -1 });
      if (edge(map.cycleNext)) fire({ type: "cycle", device, step: 1 });
      if (edge(map.cycleBack)) fire({ type: "cycle", device, step: -1 });
      if (edge(map.restore)) fire({ type: "restore", device });
      if (edge(map.start)) fire({ type: "start", device });
      if (edge(map.back)) fire({ type: "back", device });

      prev.buttons = p.buttons.map((x) => !!x.pressed);
      padPrev.set(p.index, prev);
    }
  }

  function loop() {
    pollPads();
    rafId = requestAnimationFrame(loop);
  }

  // Held-direction repeat for keyboard/touch
  const repeatTimer = setInterval(() => {
    const now = performance.now();
    for (const [key, v] of held) {
      if (now >= v.next) {
        v.next = now + REPEAT_EVERY;
        const [device, dir] = key.split(":");
        fire({ type: "dir", device, dir: Number(dir) });
      }
    }
  }, 40);

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => held.clear());
  window.addEventListener("gamepadconnected", () => {});
  rafId = requestAnimationFrame(loop);

  return {
    touch,
    cancelCalibration() { calibration = null; },
    calibrate(index, callback) {
      held.clear(); calibration = {index,callback,step:0,map:{}};calibrationPrompt();
    },
    destroy() {
      cancelAnimationFrame(rafId);
      clearInterval(repeatTimer);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    },
  };
}
