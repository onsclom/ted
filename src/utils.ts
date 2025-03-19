import { state } from "./state";

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

export function animated(
  cur: { x: number; y: number },
  target: { x: number; y: number },
  dt: number,
) {
  const res = { x: cur.x, y: cur.y };
  const animateRatio = 0.2 * (dt / (1000 / 120));
  res.x += (target.x - res.x) * animateRatio;
  res.y += (target.y - res.y) * animateRatio;
  const maxDistance = 30;
  const toMove = { x: target.x - res.x, y: target.y - res.y };
  const dist = Math.hypot(toMove.x, toMove.y);
  if (dist > maxDistance) {
    res.x = target.x - (toMove.x / dist) * maxDistance;
    res.y = target.y - (toMove.y / dist) * maxDistance;
  }
  return res;
}
