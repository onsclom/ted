import { margins } from "./constants";

const initialText = `Hello world
second line
this is a test string`;

export const state = {
  cursors: [] as {
    first: {
      // in text coords
      text: { x: number; y: number };
      // in canvas coords
      animated: { x: number; y: number };
    };
    second: {
      // in text coords
      text: { x: number; y: number };
      // in canvas coords
      animated: { x: number; y: number };
    };
  }[],
  text: textToTextState(initialText),
  charRect: { width: 0, height: 0 },
  cursorDown: false,
};

state.cursors = [
  {
    first: {
      text: { x: 0, y: 0 },
      animated: textPosToCanvasPos({ x: 0, y: 0 }),
    },
    second: {
      text: { x: 0, y: 0 },
      animated: textPosToCanvasPos({ x: 0, y: 0 }),
    },
  },
];

function textToTextState(text: string) {
  const chars = text.split("");
  const charState = [] as {
    char: string;
    animated: { x: number; y: number };
  }[];
  let x = 0;
  let y = 0;
  for (let i = 0; i < chars.length; i++) {
    if (chars[i] === "\n") {
      x = 0;
      y++;
    }
    charState.push({
      char: chars[i],
      // animated: textPosToCanvasPos({ x: x++, y }),
      animated: { x: 0, y: 0 }, // TODO: fix later
    });
  }
  return charState;
}

export function textPosToCanvasPos(textPos: { x: number; y: number }) {
  return {
    x: textPos.x * state.charRect.width + margins.x,
    y: textPos.y * state.charRect.height + margins.y,
  };
}
