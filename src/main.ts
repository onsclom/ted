import { state } from "./state";
import "./raf";
import "./events";

export const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
canvas.style.cursor = "text";

export function textIndexFromXY(text: string[], x: number, y: number): number {
  let x2 = 0;
  let y2 = 0;
  for (let i = 0; i < text.length; i++) {
    if (x2 === x && y2 === y) {
      return i;
    }
    if (text[i] === "\n") {
      x2 = 0;
      y2 += 1;
    } else {
      x2 += 1;
    }
  }
  return text.length;
}

export function sortedCursor(cursor: (typeof state.cursors)[0]) {
  if (cursor.first.text.y < cursor.second.text.y) {
    return { left: cursor.first, right: cursor.second };
  }
  if (cursor.first.text.y > cursor.second.text.y) {
    return { left: cursor.second, right: cursor.first };
  }
  if (cursor.first.text.x < cursor.second.text.x) {
    return { left: cursor.first, right: cursor.second };
  }
  return { left: cursor.second, right: cursor.first };
}
