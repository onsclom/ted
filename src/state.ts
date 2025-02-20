import { margins } from "./constants";

const initialText = `Hello world
second line
this is a test string`;

export const state = {
  lastClickTime: 0,
  clickCount: 0,
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
  cursorLastChangeTime: 0,
  text: textToTextState(initialText),
  letterGraveyard: [] as {
    char: string;
    // these are animated pos
    x: number;
    y: number;
    // these are text coords
    textPos: {
      x: number;
      y: number;
    };
    timeDead: number;
    animateOut:
      | {
          type: "cursorHide";
          covered: number;
        }
      | {
          type: "fadeOut";
        };
  }[],
  charRect: { width: 0, height: 0 },
  cursorDown: false,
  scrolly: 0,
  scrollx: 0,
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
    textPos: { x: number; y: number };
    animatedPos: { x: number; y: number };
    lifetime: number;
    animatedEntrance:
      | {
          type: "fadeIn";
        }
      | {
          type: "cursorReveal";
          revealed: number;
        };
  }[];
  for (let i = 0; i < chars.length; i++) {
    charState.push({
      char: chars[i],
      textPos: { x: 0, y: 0 }, // TODO: fix
      animatedPos: { x: 0, y: 0 }, // TODO: fix starting pos?
      lifetime: 0,
      animatedEntrance: { type: "fadeIn" },
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
