import { state, textPosToCanvasPos } from "./state";
import { margins } from "./constants";
import { sortedCursor, textIndexFromXY } from "./utils";
import { canvas } from "./canvas";

const DOUBLE_CLICK_TIME = 500;

// Helper functions
const getTextCoords = (clientX: number, clientY: number) => ({
  x: Math.max(
    Math.round((clientX - margins.x + state.scrollx) / state.charRect.width),
    0,
  ),
  y: Math.max(
    Math.floor((clientY - margins.y + state.scrolly) / state.charRect.height),
    0,
  ),
});

const handleClipboardOp = async (type: "copy" | "cut", cursor: any) => {
  const sorted = sortedCursor(cursor);
  const chars = state.text.map((char) => char.char);
  const start = textIndexFromXY(chars, sorted.left.text.x, sorted.left.text.y);
  const end = textIndexFromXY(chars, sorted.right.text.x, sorted.right.text.y);

  const text =
    type === "cut"
      ? state.text.splice(start, end - start)
      : state.text.slice(start, end);

  if (type === "cut") {
    text.forEach((char) => {
      state.letterGraveyard.push({
        char: char.char,
        textPos: { x: char.textPos.x, y: char.textPos.y },
        x: char.animatedPos.x,
        y: char.animatedPos.y,
        timeDead: 0,
        animateOut: { type: "fadeOut" },
      });
    });
    cursor.first.text = { ...sorted.left.text };
    cursor.second.text = { ...sorted.left.text };
  }

  await navigator.clipboard.writeText(text.map((char) => char.char).join(""));
};

canvas.onpointerdown = (e) => {
  canvas.setPointerCapture(e.pointerId);
  state.cursorDown = true;
  state.cursorLastChangeTime = 0;

  const now = performance.now();
  state.clickCount =
    now - state.lastClickTime < DOUBLE_CLICK_TIME ? state.clickCount + 1 : 1;
  state.lastClickTime = now;

  const coords = getTextCoords(e.clientX, e.clientY);

  if (state.cursors.length > 1) {
    state.cursors = [
      {
        first: { text: coords, animated: textPosToCanvasPos(coords) },
        second: { text: coords, animated: textPosToCanvasPos(coords) },
      },
    ];
  } else {
    state.cursors[0].first.text = coords;
    state.cursors[0].second.text = coords;
  }

  if (state.clickCount === 2) {
    selectWord(coords.x, coords.y);
  } else if (state.clickCount === 3) {
    selectLine(coords.y);
    state.clickCount = 0;
  }
};

function selectWord(x: number, y: number) {
  const chars = state.text.map((char) => char.char);
  const lines = chars.join("").split("\n");
  const line = lines[y];

  if (!line) return;

  let startX = x;
  let endX = x;

  while (startX > 0 && /\w/.test(line[startX - 1])) startX--;
  while (endX < line.length && /\w/.test(line[endX])) endX++;

  state.cursors[0].first.text = { x: startX, y };
  state.cursors[0].second.text = { x: endX, y };
}

function selectLine(y: number) {
  const chars = state.text.map((char) => char.char);
  const lines = chars.join("").split("\n");

  if (y >= 0 && y < lines.length) {
    state.cursors[0].first.text = { x: 0, y };
    state.cursors[0].second.text = { x: lines[y].length, y };
  }
}

canvas.onpointerup = () => {
  state.cursorDown = false;
};

canvas.onpointermove = (e) => {
  if (state.cursors.length === 1 && state.cursorDown) {
    state.cursorLastChangeTime = 0;
    state.cursors[0].second.text = getTextCoords(e.clientX, e.clientY);
  }
};

canvas.onblur = () => {
  state.cursorDown = false;
  state.cursors = [];
};

document.body.style.overscrollBehaviorX = "none";
document.documentElement.style.overscrollBehaviorX = "none";
document.onwheel = (e) => {
  e.preventDefault();
  state.scrolly += e.deltaY;
  state.scrollx += e.deltaX;
};

document.onkeydown = (e) => {
  state.cursorLastChangeTime = 0;

  const hotkey = e.metaKey || e.ctrlKey;
  if (hotkey) {
    switch (e.key) {
      case "a": {
        while (state.cursors.length > 1) state.cursors.pop();

        if (state.cursors.length === 0) {
          state.cursors.push({
            first: {
              text: { x: 0, y: 0 },
              animated: textPosToCanvasPos({ x: 0, y: 0 }),
            },
            second: {
              text: { x: 0, y: 0 },
              animated: textPosToCanvasPos({ x: 0, y: 0 }),
            },
          });
        }

        state.cursors[0].first.text = { x: 0, y: 0 };
        state.cursors[0].second.text = {
          x: state.text.length,
          y: state.text.length - 1,
        };
        break;
      }
      case "c":
        handleClipboardOp("copy", state.cursors[0]);
        break;
      case "x":
        handleClipboardOp("cut", state.cursors[0]);
        break;
      case "v": {
        navigator.clipboard.readText().then((text) => {
          const chars = text.split("");
          for (const cursor of state.cursors) {
            const sorted = sortedCursor(cursor);
            const start = textIndexFromXY(
              state.text.map((char) => char.char),
              sorted.left.text.x,
              sorted.left.text.y,
            );
            const end = textIndexFromXY(
              state.text.map((char) => char.char),
              sorted.right.text.x,
              sorted.right.text.y,
            );
            const removed = state.text.splice(start, end - start);
            for (const char of removed) {
              state.letterGraveyard.push({
                char: char.char,
                x: char.animatedPos.x,
                y: char.animatedPos.y,
                textPos: { x: char.textPos.x, y: char.textPos.y },
                timeDead: 0,
                animateOut: { type: "fadeOut" },
              });
            }

            let i = start;
            let yOff = 0;
            for (const char of chars) {
              state.text.splice(i, 0, {
                char,
                textPos: {
                  x: sorted.left.text.x + i - start,
                  y: sorted.left.text.y + yOff,
                },
                animatedPos: textPosToCanvasPos(sorted.left.text),
                animatedEntrance: { type: "fadeIn" },
                lifetime: 0,
              });
              i += 1;
              sorted.left.text.x += 1;
              if (char === "\n") {
                sorted.left.text.x = 0;
                sorted.left.text.y += 1;
                yOff += 1;
              }
            }

            cursor.first.text = { ...sorted.left.text };
            cursor.first.text.x += chars.length;
            cursor.second.text = { ...cursor.first.text };
          }
        });
        break;
      }
    }
  }
  if (hotkey) return;

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
            const removed = state.text.splice(i, 1);
            state.letterGraveyard.push({
              char: removed[0].char,
              textPos: { x: removed[0].textPos.x, y: removed[0].textPos.y },
              x: removed[0].animatedPos.x,
              y: removed[0].animatedPos.y,
              timeDead: 0,
              animateOut: { type: "cursorHide", covered: 0 },
            });
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
      } else {
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
        const removed = state.text.splice(start, end - start);
        for (const char of removed) {
          state.letterGraveyard.push({
            char: char.char,
            textPos: { x: char.textPos.x, y: char.textPos.y },
            x: char.animatedPos.x,
            y: char.animatedPos.y,
            timeDead: 0,
            animateOut: { type: "fadeOut" },
          });
        }
        cursor.first.text = { ...sorted.left.text };
        cursor.second.text = { ...sorted.left.text };
      }
    }
  } else if (e.key === "Enter") {
    for (const cursor of state.cursors) {
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
      const removed = state.text.splice(start, end - start, {
        char: "\n",
        textPos: {
          x: sorted.left.text.x,
          y: sorted.left.text.y + 1,
        },
        animatedPos: textPosToCanvasPos(sorted.left.text),
        lifetime: 0,
        animatedEntrance: { type: "fadeIn" },
      });
      for (const char of removed) {
        state.letterGraveyard.push({
          char: char.char,
          textPos: { x: char.textPos.x, y: char.textPos.y },
          x: char.animatedPos.x,
          y: char.animatedPos.y,
          timeDead: 0,
          animateOut: { type: "fadeOut" },
        });
      }
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
      const target = e.shiftKey ? cursor.second : cursor.first;

      // @ts-expect-error
      target.text.x += dirs[e.key].x;
      // @ts-expect-error
      target.text.y += dirs[e.key].y;

      if (target.text.y < 0) {
        target.text.y = 0;
        target.text.x = 0;
      } else if (target.text.y >= lines.length) {
        target.text.y = lines.length - 1;
        target.text.x = lines[lines.length - 1].length;
      }

      if (target.text.x === -1 && target.text.y > 0) {
        target.text.y -= 1;
        target.text.x = lines[target.text.y].length;
      }

      if (
        target.text.x === lines[target.text.y].length + 1 &&
        e.key === "ArrowRight"
      ) {
        target.text.y += 1;
        target.text.x = 0;
      }

      if (!e.shiftKey) {
        cursor.second.text = { ...cursor.first.text };
      }
    }
  } else {
    if (e.key.length === 1) {
      for (const cursor of state.cursors) {
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
        const removed = state.text.splice(start, end - start, {
          char: e.key,
          textPos: {
            x: sorted.left.text.x,
            y: sorted.left.text.y,
          },
          animatedPos: textPosToCanvasPos(sorted.left.text),
          lifetime: 0,
          animatedEntrance: {
            type: "cursorReveal",
            revealed: 0,
          },
        });
        for (const char of removed) {
          state.letterGraveyard.push({
            char: char.char,
            textPos: { x: char.textPos.x, y: char.textPos.y },
            x: char.animatedPos.x,
            y: char.animatedPos.y,
            timeDead: 0,
            animateOut: { type: "fadeOut" },
          });
        }
        cursor.first.text = { ...sorted.left.text };
        cursor.first.text.x += 1;
        cursor.second.text = { ...cursor.first.text };
      }
    }
  }
};
