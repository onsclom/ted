import { state, textPosToCanvasPos } from "./state";
import { margins } from "./constants";
import { sortedCursor, textIndexFromXY } from "./utils";
import { canvas } from "./canvas";

document.body.onload = () => {
  canvas.onpointerdown = (e) => {
    canvas.setPointerCapture(e.pointerId);
    state.cursorDown = true;
    state.cursorLastChangeTime = 0;
    // figure out which char the cursor should be at
    const x = Math.max(
      Math.round(
        (e.clientX - margins.x + state.scrollx) / state.charRect.width,
      ),
      0,
    );
    const y = Math.max(
      Math.floor(
        (e.clientY - margins.y + state.scrolly) / state.charRect.height,
      ),
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
    state.cursorLastChangeTime = 0;
    if (state.cursors.length === 1 && state.cursorDown) {
      const x = Math.max(
        Math.round(
          (e.clientX - margins.x + state.scrollx) / state.charRect.width,
        ),
        0,
      );
      const y = Math.max(
        Math.floor(
          (e.clientY - margins.y + state.scrolly) / state.charRect.height,
        ),
        0,
      );
      state.cursors[0].second.text = { x, y };
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
    const dy = e.deltaY;
    const dx = e.deltaX;
    // if (Math.abs(dy) > Math.abs(dx)) {
    state.scrolly += dy;
    // } else {
    state.scrollx += dx;
    // }
    // state.targetScrollY = Math.max(state.targetScrollY, 0);
    // state.targetScrollX = Math.max(state.targetScrollX, 0);
  };

  document.onkeydown = (e) => {
    const hotkey = e.metaKey || e.ctrlKey;

    if (hotkey && e.key === "a") {
      // select all
      while (state.cursors.length > 1) {
        state.cursors.pop();
      }
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
    }

    if (hotkey) {
      return;
    }

    state.cursorLastChangeTime = 0;
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
                x: removed[0].animated.x,
                y: removed[0].animated.y,
                timeDead: 0,
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
          const removed = state.text.splice(start, end - start);
          for (const char of removed) {
            state.letterGraveyard.push({
              char: char.char,
              x: char.animated.x,
              y: char.animated.y,
              timeDead: 0,
            });
          }
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
        const removed = state.text.splice(start, end - start, {
          char: "\n",
          animated: textPosToCanvasPos(sorted.left.text),
          lifetime: 0,
        });
        for (const char of removed) {
          state.letterGraveyard.push({
            char: char.char,
            x: char.animated.x,
            y: char.animated.y,
            timeDead: 0,
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
        if (e.shiftKey) {
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
          const removed = state.text.splice(start, end - start, {
            char: e.key,
            animated: textPosToCanvasPos(sorted.left.text),
            lifetime: 0,
          });
          for (const char of removed) {
            state.letterGraveyard.push({
              char: char.char,
              x: char.animated.x,
              y: char.animated.y,
              timeDead: 0,
            });
          }
          cursor.first.text = { ...sorted.left.text };
          cursor.first.text.x += 1;
          cursor.second.text = { ...cursor.first.text };
        }
      }
    }
  };
};
