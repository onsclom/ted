import { assert } from "./assert";
import { state, textPosToCanvasPos } from "./state";
import { animated, sortedCursor } from "./utils";
import { canvas } from "./canvas";
import { lineSpacing } from "./constants";

// prevent FOUC
document.fonts.load("20px 'IBM Plex Mono'").then(() => raf());
const blue = "#55e";

let lastTime = performance.now();
function raf() {
  const now = performance.now();
  const dt = now - lastTime;
  lastTime = now;

  for (let i = state.letterGraveyard.length - 1; i >= 0; i--) {
    state.letterGraveyard[i].timeDead += dt;
    if (state.letterGraveyard[i].timeDead > 100) {
      state.letterGraveyard.splice(i, 1);
    }
  }

  const lineText = state.text
    .map((char) => char.char)
    .join("")
    .split("\n");
  state.cursorLastChangeTime += dt;
  for (const cursor of state.cursors) {
    // correct y
    const lines = lineText.length;
    if (cursor.first.text.y >= lines) {
      cursor.first.text.y = lines - 1;
      cursor.first.text.x = lineText[cursor.first.text.y].length;
    }
    if (cursor.second.text.y >= lines) {
      cursor.second.text.y = lines - 1;
      cursor.second.text.x = lineText[cursor.second.text.y].length;
    }

    if (cursor.first.text.y < 0) {
      cursor.first.text.y = 0;
      cursor.first.text.x = 0;
    }
    if (cursor.second.text.y < 0) {
      cursor.second.text.y = 0;
      cursor.second;
    }

    // correct x
    if (cursor.first.text.x > lineText[cursor.first.text.y].length) {
      cursor.first.text.x = lineText[cursor.first.text.y].length;
    }
    if (cursor.second.text.x > lineText[cursor.second.text.y].length) {
      cursor.second.text.x = lineText[cursor.second.text.y].length;
    }

    if (cursor.first.text.x < 0) {
      cursor.first.text.x = 0;
    }
    if (cursor.second.text.x < 0) {
      cursor.second.text.x = 0;
    }

    const firstTarget = textPosToCanvasPos(cursor.first.text);
    cursor.first.animated = animated(cursor.first.animated, firstTarget);
    const secondTarget = textPosToCanvasPos(cursor.second.text);
    cursor.second.animated = animated(cursor.second.animated, secondTarget);
  }

  {
    // animate letters
    let x = 0;
    let y = 0;
    for (const char of state.text) {
      const target = textPosToCanvasPos({ x, y });
      char.animated = animated(char.animated, target);
      if (char.char === "\n") {
        x = 0;
        y += 1;
      } else {
        x += 1;
      }
    }
  }

  if (state.scrollx < 0) {
    state.scrollx = 0;
  }
  if (state.scrolly < 0) {
    state.scrolly = 0;
  }

  const bounds = canvas.getBoundingClientRect();
  canvas.width = bounds.width * devicePixelRatio;
  canvas.height = bounds.height * devicePixelRatio;

  const ctx = canvas.getContext("2d");
  assert(ctx);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(-state.scrollx, -state.scrolly);

  ctx.strokeStyle = blue;
  // draw line at top of document
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(state.scrollx, 0);
  ctx.lineTo(state.scrollx + bounds.width, 0);
  ctx.stroke();
  // draw line left of document
  ctx.beginPath();
  ctx.moveTo(0, state.scrolly);
  ctx.lineTo(0, state.scrolly + bounds.height);
  ctx.stroke();

  const charHeight = 20;
  ctx.font = `${charHeight}px 'IBM Plex Mono'`;
  ctx.textAlign = "start";
  ctx.textBaseline = "top";

  state.charRect.width = ctx.measureText(" ").width;
  state.charRect.height = charHeight * lineSpacing;

  ctx.fillStyle = "#adf";
  ctx.lineWidth = 2;
  // draw cursors
  {
    ctx.save();
    const cursorStartsBlinking = 1000;
    const blinkRate = 200;
    if (state.cursorLastChangeTime > cursorStartsBlinking) {
      const time = state.cursorLastChangeTime - cursorStartsBlinking;
      ctx.globalAlpha = Math.cos(time / blinkRate) * 0.5 + 0.5;
    }
    for (const cursor of state.cursors) {
      const sorted = sortedCursor(cursor);

      ctx.strokeStyle = blue;

      const dirSize =
        sorted.left.text.x === sorted.right.text.x &&
        sorted.left.text.y === sorted.right.text.y
          ? 0
          : 0.5;
      // draw cursor line
      ctx.beginPath();
      ctx.moveTo(
        sorted.left.animated.x + state.charRect.width * dirSize,
        sorted.left.animated.y,
      );
      ctx.lineTo(sorted.left.animated.x, sorted.left.animated.y);
      ctx.lineTo(
        sorted.left.animated.x,
        sorted.left.animated.y + state.charRect.height,
      );
      ctx.lineTo(
        sorted.left.animated.x + state.charRect.width * dirSize,
        sorted.left.animated.y + state.charRect.height,
      );
      ctx.stroke();

      // draw second
      ctx.beginPath();
      // draw using animated pos
      ctx.moveTo(
        sorted.right.animated.x + state.charRect.width * -dirSize,
        sorted.right.animated.y,
      );
      ctx.lineTo(sorted.right.animated.x, sorted.right.animated.y);
      ctx.lineTo(
        sorted.right.animated.x,
        sorted.right.animated.y + state.charRect.height,
      );
      ctx.lineTo(
        sorted.right.animated.x + state.charRect.width * -dirSize,
        sorted.right.animated.y + state.charRect.height,
      );
      ctx.stroke();
    }
    ctx.restore();
  }

  const verticalPadding = (state.charRect.height - charHeight) / 2;
  // draw letter graveyard
  state.letterGraveyard.forEach((char) => {
    ctx.fillStyle = "black";
    const deadTime = 100;
    ctx.globalAlpha = Math.max(0, 1 - char.timeDead / deadTime);
    ctx.fillText(char.char, char.x, char.y + verticalPadding);
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = "black";
  // print all chars
  {
    let x = 0;
    let y = 0;
    for (const char of state.text) {
      if (char.char === "\n") {
        x = 0;
        y += 1;
      } else {
        ctx.fillText(
          char.char,
          char.animated.x,
          char.animated.y + verticalPadding,
        );
        x += 1;
      }
    }
  }
  requestAnimationFrame(raf);
}
