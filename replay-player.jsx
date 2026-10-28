import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useRef, useLayoutEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { useCurrentFrame, delayRender, continueRender } from "remotion";
import { createRenderer } from "./renderer.js";
import { replayState } from "./replay-data.js";
function InstantReplay({ data }) {
  const frame = useCurrentFrame(), canvas = useRef(null), renderer = useRef(null), current = useRef(frame);
  current.current = frame;
  const [handle] = useState(() => delayRender("Loading replay materials"));
  useLayoutEffect(() => {
    const r = createRenderer(canvas.current, { manual: true, background: true });
    renderer.current = r;
    r.ready.then(() => {
      if (renderer.current === r) {
        r.renderAt(replayState(data, current.current), current.current / 60);
        continueRender(handle);
      }
    });
    return () => {
      renderer.current = null;
      r.dispose();
      continueRender(handle);
    };
  }, [data, handle]);
  useLayoutEffect(() => {
    const r = renderer.current;
    if (!r) return;
    r.seekEffects(data.events, frame);
    r.renderAt(replayState(data, frame), frame / 60);
  }, [data, frame]);
  return /* @__PURE__ */ jsxDEV("canvas", { ref: canvas, style: { width: "100%", height: "100%", display: "block" } }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 16,
    columnNumber: 9
  }, this);
}
function mountReplay(element, data, onError) {
  const root = createRoot(element);
  root.render(/* @__PURE__ */ jsxDEV(Player, { component: InstantReplay, inputProps: { data }, durationInFrames: data.frames.length, compositionWidth: 1280, compositionHeight: 720, fps: data.fps, autoPlay: true, loop: true, controls: false, clickToPlay: false, doubleClickToFullscreen: false, spaceKeyToPlayOrPause: false, showVolumeControls: false, errorFallback: ({ error }) => {
    queueMicrotask(() => onError?.(error));
    return null;
  }, style: { width: "100%", height: "100%" } }, void 0, false, {
    fileName: "<stdin>",
    lineNumber: 20,
    columnNumber: 14
  }, this));
  return () => root.unmount();
}
export {
  InstantReplay,
  mountReplay
};
