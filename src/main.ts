import { assert } from "./assert";

const canvas = document.createElement("canvas");
document.body.appendChild(canvas);
canvas.style.cursor = "text";
const initialText = `Hello world
second line
this is a test string`;

const state = {
  cursors: [] as {
    first: { x: number; y: number };
    second: { x: number; y: number };
  }[],
  text: initialText.split(""),
  charRect: { width: 0, height: 0 },
  cursorDown: false,
};

const margins = { x: 10, y: 10 };

const lineSpacing = 1.815;

function textAsLines(text: string[]) {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const char of text) {
    if (char === "\n") {
      lines.push(line);
      line = [];
    } else {
      line.push(char);
    }
  }
  lines.push(line);
  return lines;
}

function raf() {
  // TODO: move this to only happen on click?
  // correct cursors
  const lineText = textAsLines(state.text);
  for (const cursor of state.cursors) {
    // correct y
    const lines = lineText.length;
    if (cursor.first.y >= lines) {
      cursor.first.y = lines - 1;
      cursor.first.x = lineText[cursor.first.y].length;
    }
    if (cursor.second.y >= lines) {
      cursor.second.y = lines - 1;
      cursor.second.x = lineText[cursor.second.y].length;
    }

    // correct x
    if (cursor.first.x > lineText[cursor.first.y].length) {
      cursor.first.x = lineText[cursor.first.y].length;
    }
    if (cursor.second.x > lineText[cursor.second.y].length) {
      cursor.second.x = lineText[cursor.second.y].length;
    }

    if (cursor.first.x < 0) {
      cursor.first.x = 0;
    }
    if (cursor.second.x < 0) {
      cursor.second.x = 0;
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
      sorted.left.x === sorted.right.x && sorted.left.y === sorted.right.y
        ? 0
        : 0.5;
    // draw cursor line
    ctx.beginPath();
    ctx.moveTo(
      margins.x +
        sorted.left.x * state.charRect.width +
        state.charRect.width * dirSize,
      margins.y + sorted.left.y * state.charRect.height,
    );
    ctx.lineTo(
      margins.x + sorted.left.x * state.charRect.width,
      margins.y + sorted.left.y * state.charRect.height,
    );
    ctx.lineTo(
      margins.x + sorted.left.x * state.charRect.width,
      margins.y +
        sorted.left.y * state.charRect.height +
        +state.charRect.height,
    );
    ctx.lineTo(
      margins.x +
        sorted.left.x * state.charRect.width +
        state.charRect.width * dirSize,
      margins.y +
        sorted.left.y * state.charRect.height +
        +state.charRect.height,
    );
    ctx.stroke();

    // draw second
    ctx.beginPath();
    ctx.moveTo(
      margins.x +
        sorted.right.x * state.charRect.width +
        state.charRect.width * -dirSize,
      margins.y + sorted.right.y * state.charRect.height,
    );
    ctx.lineTo(
      margins.x + sorted.right.x * state.charRect.width,
      margins.y + sorted.right.y * state.charRect.height,
    );
    ctx.lineTo(
      margins.x + sorted.right.x * state.charRect.width,
      margins.y +
        sorted.right.y * state.charRect.height +
        +state.charRect.height,
    );
    ctx.lineTo(
      margins.x +
        sorted.right.x * state.charRect.width +
        state.charRect.width * -dirSize,
      margins.y +
        sorted.right.y * state.charRect.height +
        +state.charRect.height,
    );
    ctx.stroke();
  }

  ctx.fillStyle = "black";
  // print all chars
  {
    let x = 0;
    let y = 0;
    for (const char of state.text) {
      if (char === "\n") {
        x = 0;
        y += 1;
      } else {
        const verticalPadding = (state.charRect.height - charHeight) / 2;
        ctx.fillText(
          char,
          margins.x + x * state.charRect.width,
          margins.y + y * state.charRect.height + verticalPadding,
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
  state.cursors = [{ first: { x, y }, second: { x, y } }];
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
    state.cursors[0].second = { x, y };
  }
};

document.onblur = () => {
  state.cursorDown = false;
  state.cursors = [];
};

// okay.. to support key press interactions
// i want the text to be a 1d array of chars
document.onkeydown = (e) => {
  const lines = textAsLines(state.text);
  const cursorInfo = textToCursorInfo(state.text);

  if (e.key === "Backspace") {
    for (const cursor of state.cursors) {
      // if first === start, delete the char before start

      const cursorsSame =
        cursor.first.x === cursor.second.x &&
        cursor.first.y === cursor.second.y;
      if (cursorsSame) {
        // delete the char before start
        let x = 0;
        let y = 0;
        for (let i = 0; i <= state.text.length; i++) {
          const char = state.text[i];
          if (
            (x === cursor.first.x - 1 && y === cursor.first.y) ||
            (char === "\n" && cursor.first.x === 0 && y === cursor.first.y - 1)
          ) {
            state.text.splice(i, 1);
            cursor.first.x -= 1;
            if (cursor.first.x < 0) {
              cursor.first.y -= 1;
              cursor.first.x = lines[cursor.first.y].length;
            }
            cursor.second = { ...cursor.first };
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
      }
    }
  } else if (e.key === "Enter") {
    // add "\n" at cursor position
    for (const cursor of state.cursors) {
      const startEqualsEnd =
        cursor.first.x === cursor.second.x &&
        cursor.first.y === cursor.second.y;
      if (startEqualsEnd) {
        state.text.splice(
          textIndexFromXY(state.text, cursor.first.x, cursor.first.y),
          0,
          "\n",
        );
        cursor.first.x += 1;
        cursor.second = { ...cursor.first };
      }
      // update cursor pos
      cursor.first.x = 0;
      cursor.first.y += 1;
      cursor.second = { ...cursor.first };
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
      // @ts-expect-error too lazy to solve this rn
      cursor.first.x += dirs[e.key].x;
      // @ts-expect-error too lazy to solve this rn
      cursor.first.y += dirs[e.key].y;

      cursor.first.y = Math.min(Math.max(0, cursor.first.y), lines.length - 1);

      if (cursor.first.x === -1 && cursor.first.y > 0) {
        // go to line above
        cursor.first.y -= 1;
        cursor.first.x = lines[cursor.first.y].length;
      }
      if (cursor.first.x === lines[cursor.first.y].length + 1) {
        // go to line below
        cursor.first.y += 1;
        cursor.first.x = 0;
      }
      cursor.second = { ...cursor.first };
    }
  } else {
    if (e.key.length === 1) {
      for (const cursor of state.cursors) {
        state.text.splice(
          textIndexFromXY(state.text, cursor.first.x, cursor.first.y),
          0,
          e.key,
        );
        cursor.first.x += 1;
        cursor.second = { ...cursor.first };
      }
    }
  }
};

canvas.onkeydown = (e) => {};

document.fonts.load("20px 'IBM Plex Mono'").then(() => raf());

// takes text as an array of chars and returns the cursor positions after each char
function textToCursorInfo(text: string[]): {
  x: number;
  y: number;
}[] {
  let x = 0;
  let y = 0;
  return text.map((char) => {
    if (char === "\n") {
      x = 0;
      y += 1;
    } else {
      x += 1;
    }
    return { x, y };
  });
}

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

function sortedCursor(cursor: {
  first: { x: number; y: number };
  second: { x: number; y: number };
}) {
  if (cursor.first.y < cursor.second.y) {
    return {
      left: cursor.first,
      right: cursor.second,
    };
  }
  if (cursor.first.y > cursor.second.y) {
    return {
      left: cursor.second,
      right: cursor.first,
    };
  }
  if (cursor.first.x < cursor.second.x) {
    return {
      left: cursor.first,
      right: cursor.second,
    };
  }
  return { left: cursor.second, right: cursor.first };
}
