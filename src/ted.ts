const state = {
  cursors: [] as {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }[],
  charRect: { width: 0, height: 0 },
};

const margins = { x: 10, y: 10 };

const lineSpacing = 1.815;
