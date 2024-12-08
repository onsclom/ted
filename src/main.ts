import { assert } from "./assert";
import { state, textPosToCanvasPos } from "./state";
import { margins, lineSpacing } from "./constants";

export const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
canvas.style.cursor = "text";

// prevent FOUC
document.fonts.load("20px 'IBM Plex Mono'").then(() => raf());
function raf() {
  const lineText = state.text
    .map((char) => char.char)
    .join("")
    .split("\n");
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

    // animate cursor
    const firstTarget = textPosToCanvasPos(cursor.first.text);
    const secondTarget = textPosToCanvasPos(cursor.second.text);
    const animateRatio = 0.2;
    cursor.first.animated.x +=
      (firstTarget.x - cursor.first.animated.x) * animateRatio;
    cursor.first.animated.y +=
      (firstTarget.y - cursor.first.animated.y) * animateRatio;
    cursor.second.animated.x +=
      (secondTarget.x - cursor.second.animated.x) * animateRatio;
    cursor.second.animated.y +=
      (secondTarget.y - cursor.second.animated.y) * animateRatio;
  }

  {
    // animate letters
    let x = 0;
    let y = 0;
    for (const char of state.text) {
      const target = textPosToCanvasPos({ x, y });
      const animateRatio = 0.2;
      char.animated.x += (target.x - char.animated.x) * animateRatio;
      char.animated.y += (target.y - char.animated.y) * animateRatio;
      if (char.char === "\n") {
        x = 0;
        y += 1;
      } else {
        x += 1;
      }
    }
  }

  const bounds = canvas.getBoundingClientRect();
  canvas.width = bounds.width * devicePixelRatio;
  canvas.height = bounds.height * devicePixelRatio;

  const ctx = canvas.getContext("2d");
  assert(ctx);
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const charHeight = 20;
  ctx.font = `${charHeight}px 'IBM Plex Mono'`;
  ctx.textAlign = "start";
  ctx.textBaseline = "top";

  state.charRect.width = ctx.measureText(" ").width;
  state.charRect.height = charHeight * lineSpacing;

  ctx.fillStyle = "#adf";
  ctx.lineWidth = 2;
  // draw cursor
  for (const cursor of state.cursors) {
    const sorted = sortedCursor(cursor);

    ctx.strokeStyle = "#55e";

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
        const verticalPadding = (state.charRect.height - charHeight) / 2;
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

canvas.onpointerdown = (e) => {
  canvas.setPointerCapture(e.pointerId);
  state.cursorDown = true;
  // figure out which char the cursor should be at
  const x = Math.max(
    Math.round((e.clientX - margins.x) / state.charRect.width),
    0,
  );
  const y = Math.max(
    Math.floor((e.clientY - margins.y) / state.charRect.height),
    0,
  );
  if (state.cursors.length > 1) {
    state.cursors = [
      {
        first: { text: { x, y }, animated: textPosToCanvasPos({ x, y }) },
        second: { text: { x, y }, animated: textPosToCanvasPos({ x, y }) },
      },
    ];
  } else {
    state.cursors[0].first.text = { x, y };
    state.cursors[0].second.text = { x, y };
  }
};

canvas.onpointerup = () => {
  state.cursorDown = false;
};

canvas.onpointermove = (e) => {
  if (state.cursors.length === 1 && state.cursorDown) {
    const x = Math.max(
      Math.round((e.clientX - margins.x) / state.charRect.width),
      0,
    );
    const y = Math.max(
      Math.floor((e.clientY - margins.y) / state.charRect.height),
      0,
    );
    state.cursors[0].second.text = { x, y };
  }
};

canvas.onblur = () => {
  state.cursorDown = false;
  state.cursors = [];
};

document.onkeydown = (e) => {
  const chars = state.text.map((char) => char.char);
  const lines = chars.join("").split("\n");

  if (e.key === "Backspace") {
    for (const cursor of state.cursors) {
      const cursorsSame =
        cursor.first.text.x === cursor.second.text.x &&
        cursor.first.text.y === cursor.second.text.y;
      if (cursorsSame) {
        let x = 0;
        let y = 0;
        for (let i = 0; i <= state.text.length; i++) {
          const char = state.text[i].char;
          if (
            (x === cursor.first.text.x - 1 && y === cursor.first.text.y) ||
            (char === "\n" &&
              cursor.first.text.x === 0 &&
              y === cursor.first.text.y - 1)
          ) {
            state.text.splice(i, 1);
            cursor.first.text.x -= 1;
            if (cursor.first.text.x < 0) {
              cursor.first.text.y -= 1;
              cursor.first.text.x = lines[cursor.first.text.y].length;
            }
            cursor.second.text = { ...cursor.first.text };
            break;
          }
          if (char === "\n") {
            x = 0;
            y += 1;
          } else {
            x += 1;
          }
        }
      }
      // else, delete the chars between first and second
      else {
        const sorted = sortedCursor(cursor);
        const start = textIndexFromXY(
          chars,
          sorted.left.text.x,
          sorted.left.text.y,
        );
        const end = textIndexFromXY(
          chars,
          sorted.right.text.x,
          sorted.right.text.y,
        );
        state.text.splice(start, end - start);
        cursor.first.text = { ...sorted.left.text };
        cursor.second.text = { ...sorted.left.text };
      }
    }
  } else if (e.key === "Enter") {
    // add "\n" at cursor position
    for (const cursor of state.cursors) {
      const sorted = sortedCursor(cursor);
      // delete the chars between first and second
      const start = textIndexFromXY(
        chars,
        sorted.left.text.x,
        sorted.left.text.y,
      );
      const end = textIndexFromXY(
        chars,
        sorted.right.text.x,
        sorted.right.text.y,
      );
      state.text.splice(start, end - start, {
        char: "\n",
        animated: textPosToCanvasPos(sorted.left.text),
      });
      cursor.first.text = { ...sorted.left.text };
      cursor.first.text.x = 0;
      cursor.first.text.y += 1;
      cursor.second.text = { ...cursor.first.text };
    }
  } else if (
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)
  ) {
    const dirs = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };

    for (const cursor of state.cursors) {
      if (e.shiftKey) {
        console.log("moving with shift");
        // @ts-expect-error too lazy to solve this rn
        cursor.second.text.x += dirs[e.key].x;
        // @ts-expect-error too lazy to solve this rn
        cursor.second.text.y += dirs[e.key].y;

        if (cursor.second.text.y < 0) {
          cursor.second.text.y = 0;
          cursor.second.text.x = 0;
        } else if (cursor.second.text.y >= lines.length) {
          cursor.second.text.y = lines.length - 1;
          cursor.second.text.x = lines[lines.length - 1].length;
        }

        if (cursor.second.text.x === -1 && cursor.second.text.y > 0) {
          // go to line above
          cursor.second.text.y -= 1;
          cursor.second.text.x = lines[cursor.second.text.y].length;
        }
        if (cursor.second.text.x === lines[cursor.second.text.y].length + 1) {
          // go to line below
          cursor.second.text.y += 1;
          cursor.second.text.x = 0;
        }
      } else {
        // @ts-expect-error too lazy to solve this rn
        cursor.first.text.x += dirs[e.key].x;
        // @ts-expect-error too lazy to solve this rn
        cursor.first.text.y += dirs[e.key].y;

        if (cursor.first.text.y < 0) {
          cursor.first.text.y = 0;
          cursor.first.text.x = 0;
        } else if (cursor.first.text.y >= lines.length) {
          cursor.first.text.y = lines.length - 1;
          cursor.first.text.x = lines[lines.length - 1].length;
        }

        if (cursor.first.text.x === -1 && cursor.first.text.y > 0) {
          // go to line above
          cursor.first.text.y -= 1;
          cursor.first.text.x = lines[cursor.first.text.y].length;
        }
        if (cursor.first.text.x === lines[cursor.first.text.y].length + 1) {
          // go to line below
          cursor.first.text.y += 1;
          cursor.first.text.x = 0;
        }
        cursor.second.text = { ...cursor.first.text };
      }
    }
  } else {
    if (e.key.length === 1) {
      for (const cursor of state.cursors) {
        // delete the chars between first and second
        const sorted = sortedCursor(cursor);
        const start = textIndexFromXY(
          chars,
          sorted.left.text.x,
          sorted.left.text.y,
        );
        const end = textIndexFromXY(
          chars,
          sorted.right.text.x,
          sorted.right.text.y,
        );
        state.text.splice(start, end - start, {
          char: e.key,
          animated: textPosToCanvasPos(sorted.left.text),
        });
        cursor.first.text = { ...sorted.left.text };
        cursor.first.text.x += 1;
        cursor.second.text = { ...cursor.first.text };
      }
    }
  }
};

function textIndexFromXY(text: string[], x: number, y: number): number {
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

function sortedCursor(cursor: (typeof state.cursors)[0]) {
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
