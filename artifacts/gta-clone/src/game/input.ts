// Input system - keyboard + mouse
import type { GameState } from "./types";
import { audioEngine } from "./audio";

export function setupInput(state: GameState, canvas: HTMLCanvasElement) {
  const inp = state.input;
  const onKeyDown = (e: KeyboardEvent) => {
    audioEngine.start();
    audioEngine.resume();
    if (e.repeat) return;
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        inp.up = true;
        break;
      case "ArrowDown":
      case "KeyS":
        inp.down = true;
        break;
      case "ArrowLeft":
      case "KeyA":
        inp.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        inp.right = true;
        break;
      case "KeyE":
      case "KeyF":
        inp.enter = true;
        break;
      case "Space":
        inp.fire = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        inp.handbrake = true;
        break;
      case "KeyP":
      case "Escape":
        state.paused = !state.paused;
        break;
    }
  };
  const onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case "ArrowUp":
      case "KeyW":
        inp.up = false;
        break;
      case "ArrowDown":
      case "KeyS":
        inp.down = false;
        break;
      case "ArrowLeft":
      case "KeyA":
        inp.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        inp.right = false;
        break;
      case "Space":
        inp.fire = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
        inp.handbrake = false;
        break;
    }
  };
  const onMouseMove = (e: MouseEvent) => {
    inp.mouseX = e.clientX;
    inp.mouseY = e.clientY;
  };
  const onMouseDown = (e: MouseEvent) => {
    audioEngine.start();
    audioEngine.resume();
    if (e.button === 0) inp.mouseDown = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) inp.mouseDown = false;
  };
  const onContextMenu = (e: MouseEvent) => e.preventDefault();

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  canvas.addEventListener("contextmenu", onContextMenu);

  return () => {
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
  };
}
