import { assert } from "./assert";
import { state, textPosToCanvasPos } from "./state";
import { animated, sortedCursor } from "./utils";
import { canvas } from "./canvas";
import { lineSpacing } from "./constants";

import fragmentSource from "./fragment.glsl?raw";
import vertexSource from "./vertex.glsl?raw";

// prevent FOUC
document.fonts.load("20px 'IBM Plex Mono'").then(() => raf());
const blue = "#55e";

const glCanvas = document.createElement("canvas");
const glRect = canvas.getBoundingClientRect();
glCanvas.width = glRect.width * devicePixelRatio;
glCanvas.height = glRect.height * devicePixelRatio;
document.body.appendChild(glCanvas);
// ignore pointer
glCanvas.style.pointerEvents = "none";

const ctx = canvas.getContext("2d");
const gl = glCanvas.getContext("webgl");
assert(gl);

function createShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Failed to compile shader: ${info}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program");
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Failed to link program: ${info}`);
  }
  return program;
}

// Create shaders and program
const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
const program = createProgram(gl, vertexShader, fragmentShader);
const texture = gl.createTexture();
const positionLocation = gl.getAttribLocation(program, "a_position");
const textureLocation = gl.getUniformLocation(program, "u_texture");
const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
const timeLocation = gl.getUniformLocation(program, "u_time");
{
  // Look up attribute and uniform locations

  // Set up rectangle geometry
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1,
      -1, // Bottom-left
      1,
      -1, // Bottom-right
      -1,
      1, // Top-left
      -1,
      1, // Top-left
      1,
      -1, // Bottom-right
      1,
      1, // Top-right
    ]),
    gl.STATIC_DRAW,
  );

  // Create a texture and set up parameters
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  // Enable the attribute
  gl.enableVertexAttribArray(positionLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
}
assert(gl);

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
  state.text.forEach((char) => {
    char.lifetime += dt;
  });

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
    cursor.first.animated = animated(cursor.first.animated, firstTarget, dt);
    const secondTarget = textPosToCanvasPos(cursor.second.text);
    cursor.second.animated = animated(cursor.second.animated, secondTarget, dt);
  }

  {
    // animate letters
    let x = 0;
    let y = 0;
    for (const char of state.text) {
      const target = textPosToCanvasPos({ x, y });
      char.animated = animated(char.animated, target, dt);
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

  assert(ctx);
  ctx.scale(devicePixelRatio, devicePixelRatio);
  ctx.translate(-state.scrollx, -state.scrolly);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, bounds.width, bounds.height);

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
      const animateInTime = 100;
      ctx.globalAlpha = Math.min(1, char.lifetime / animateInTime);
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
    ctx.globalAlpha = 1;
  }

  const postprocess = false;
  if (postprocess) {
    // Upload 2D canvas content to WebGL texture
    assert(gl);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      ctx.canvas,
    );

    // Use the program and set the uniform
    // gl.useProgram(program);
    gl.uniform1i(textureLocation, 0);
    gl.uniform2f(resolutionLocation, gl.canvas.width, gl.canvas.height);
    gl.uniform1f(timeLocation, now / 1000);

    // Draw the rectangle
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  requestAnimationFrame(raf);
}
