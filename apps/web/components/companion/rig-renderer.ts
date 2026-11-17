import type { MotionFrame } from "@/lib/companion-motion/director";
import { RIG, RIG_SIZE, buildRig, poseMesh } from "@/lib/companion-motion/rig";
import { SPRITES, type CompanionRenderer } from "./renderers";

/* The living companion's renderer: the approved front-facing drawing on a
   deforming mesh (lib/companion-motion/rig.ts), drawn with WebGL in one call.

   The mesh moves his head, frills, tail and body. The shader does what has to
   happen inside the drawing itself: the irises slide within the eyes, the lids
   close and smile, the mouth curls and opens, the cheeks warm. Nothing is
   redrawn by hand, so he stays the same dragon in every frame. */

/** The canvas is wider than his body box so a hop, a lean or a frill can leave it. */
const MARGIN = 0.3;

const VERTEX = `
attribute vec2 aPos; attribute vec2 aUv; varying vec2 vUv; uniform float uSpan; uniform float uMargin;
void main() {
  vUv = aUv;
  vec2 p = (aPos / ${RIG_SIZE}.0 + uMargin) / uSpan;
  gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
}`;

const px = (v: { x: number; y: number }) => `vec2(${(v.x / RIG_SIZE).toFixed(5)}, ${(v.y / RIG_SIZE).toFixed(5)})`;
const FRAGMENT = `
precision mediump float;
varying vec2 vUv; uniform sampler2D uTex;
uniform vec2 uGaze; uniform vec2 uOpen; uniform float uSmile; uniform float uBrow;
uniform float uMouthCurve; uniform float uMouthOpen; uniform float uCheek;
const vec2 EYE_L = ${px(RIG.eyeL)}; const vec2 EYE_R = ${px(RIG.eyeR)}; const vec2 EYE_SIZE = ${px(RIG.eyeR2)};
const vec2 MOUTH = ${px(RIG.mouth)}; const vec2 MOUTH_SIZE = vec2(${(RIG.mouth.rx / RIG_SIZE).toFixed(5)}, ${(RIG.mouth.ry / RIG_SIZE).toFixed(5)});
const vec2 CHEEK_L = ${px(RIG.cheekL)}; const vec2 CHEEK_R = ${px(RIG.cheekR)};
const vec3 LID_TOP = vec3(0.957, 0.608, 0.341); const vec3 LID_LOW = vec3(0.918, 0.518, 0.263); const vec3 LASH = vec3(0.478, 0.227, 0.086);

// Where to read the drawing for this pixel: irises slide inside the eye, wide eyes swell, mouth corners lift.
vec2 warp(vec2 uv) {
  vec2 s = uv;
  for (int i = 0; i < 2; i++) {
    vec2 c = i == 0 ? EYE_L : EYE_R;
    vec2 q = (uv - c) / EYE_SIZE; float r2 = dot(q, q);
    if (r2 < 1.0) { float hold = (1.0 - r2) * (1.0 - r2); s -= uGaze * vec2(0.021, 0.017) * hold; }
    float wide = max((i == 0 ? uOpen.x : uOpen.y) - 1.0, 0.0);
    s -= (uv - c) * wide * 0.45 * (1.0 - smoothstep(0.8, 1.7, sqrt(r2)));
  }
  vec2 m = (uv - MOUTH) / MOUTH_SIZE; float mr = length(m);
  s.y += uMouthCurve * 0.016 * m.x * m.x * (1.0 - smoothstep(0.7, 1.25, mr));
  return s;
}

// How much of this pixel an eyelid covers, and how close it is to the lid's edge.
vec2 lid(vec2 uv, vec2 c, float open, float side) {
  vec2 q = (uv - c) / EYE_SIZE; float r = length(q);
  float inside = 1.0 - smoothstep(0.96, 1.08, r);
  float shut = 1.0 - clamp(open, 0.0, 1.0);
  // The lower lid rises into an arc when he smiles; the upper lid comes down to meet it.
  float low = 1.05 - uSmile * (0.95 - 0.55 * q.x * q.x);
  float top = mix(-1.1, low, shut) - uBrow * 0.22 * q.x * side - uBrow * 0.06 + 0.12 * q.x * q.x * shut;
  float upper = 1.0 - smoothstep(top - 0.05, top + 0.05, q.y);
  float lower = smoothstep(low - 0.05, low + 0.05, q.y);
  float edge = max(upper * (1.0 - smoothstep(0.0, 0.2, top - q.y)), lower * (1.0 - smoothstep(0.0, 0.2, q.y - low)));
  float lidOn = step(0.02, shut + uSmile + abs(uBrow) * 0.2);
  return vec2(max(upper, lower) * inside * lidOn, edge * inside * lidOn);
}

void main() {
  vec4 col = texture2D(uTex, warp(vUv));
  float a = col.a;
  vec3 rgb = col.rgb;
  vec2 l = lid(vUv, EYE_L, uOpen.x, -1.0); vec2 r = lid(vUv, EYE_R, uOpen.y, 1.0);
  float cover = max(l.x, r.x); float edge = max(l.y, r.y);
  float shade = clamp((vUv.y - EYE_L.y) / EYE_SIZE.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 skin = mix(mix(LID_TOP, LID_LOW, shade), LASH, edge * 0.85);
  rgb = mix(rgb, skin * a, cover);
  // An open mouth: a small dark shape just under the mouth line.
  vec2 m = (vUv - (MOUTH + vec2(0.0, 0.016 * uMouthOpen))) / vec2(MOUTH_SIZE.x * (0.34 + 0.12 * uMouthOpen), 0.004 + 0.028 * uMouthOpen);
  float gape = (1.0 - smoothstep(0.75, 1.0, length(m))) * step(0.04, uMouthOpen);
  vec3 inner = mix(vec3(0.33, 0.09, 0.07), vec3(0.78, 0.30, 0.28), smoothstep(0.1, 0.9, m.y) * 0.8);
  rgb = mix(rgb, inner * a, gape);
  float glow = exp(-dot((vUv - CHEEK_L) / 0.05, (vUv - CHEEK_L) / 0.05)) + exp(-dot((vUv - CHEEK_R) / 0.05, (vUv - CHEEK_R) / 0.05));
  rgb = mix(rgb, vec3(1.0, 0.42, 0.36) * a, clamp(glow * uCheek * 0.42, 0.0, 0.6));
  gl_FragColor = vec4(rgb, a);
}`;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Studigo's rig shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

export function createRigRenderer(onLost: () => void): CompanionRenderer {
  const mesh = buildRig();
  const positions = new Float32Array(mesh.count * 2);
  let canvas: HTMLCanvasElement | null = null, gl: WebGLRenderingContext | null = null;
  let buffer: WebGLBuffer | null = null, ready = false, dead = false, lastFrame: MotionFrame | null = null;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const span = 1 + MARGIN * 2;

  function draw(frame: MotionFrame) {
    if (!gl || !canvas || !ready) return;
    poseMesh(mesh, frame, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    gl.uniform2f(uniforms.uGaze, Math.max(-1, Math.min(1, frame.gazeX)), Math.max(-1, Math.min(1, frame.gazeY)));
    gl.uniform2f(uniforms.uOpen, frame.eyeOpenL, frame.eyeOpenR);
    gl.uniform1f(uniforms.uSmile, frame.eyeSmile);
    gl.uniform1f(uniforms.uBrow, frame.brow);
    gl.uniform1f(uniforms.uMouthCurve, frame.mouthCurve);
    gl.uniform1f(uniforms.uMouthOpen, frame.mouthOpen);
    gl.uniform1f(uniforms.uCheek, frame.cheek);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawElements(gl.TRIANGLES, mesh.indices.length, gl.UNSIGNED_SHORT, 0);
  }

  return {
    kind: "rig",
    markup: () => `<canvas class="cmpRig" aria-hidden="true"></canvas>`,
    mount(body) {
      canvas = body.querySelector<HTMLCanvasElement>(".cmpRig");
      if (!canvas) throw new Error("Studigo's rig has no canvas.");
      // His window is at most 2x; 640 backing pixels keep him sharp there without a large buffer on phones.
      const size = Math.round(Math.min(640, 150 * span * Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1))));
      canvas.width = size; canvas.height = size;
      canvas.style.setProperty("--rig-margin", `${-MARGIN * 100}%`);
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: "low-power" });
      if (!gl) throw new Error("WebGL is not available for Studigo's rig.");
      const context = gl;
      canvas.addEventListener("webglcontextlost", (event) => { event.preventDefault(); ready = false; if (!dead) onLost(); });
      const program = context.createProgram()!;
      context.attachShader(program, compile(context, context.VERTEX_SHADER, VERTEX));
      context.attachShader(program, compile(context, context.FRAGMENT_SHADER, FRAGMENT));
      context.linkProgram(program);
      if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error("Studigo's rig program did not link.");
      context.useProgram(program);
      for (const name of ["uTex", "uSpan", "uMargin", "uGaze", "uOpen", "uSmile", "uBrow", "uMouthCurve", "uMouthOpen", "uCheek"]) uniforms[name] = context.getUniformLocation(program, name);
      context.uniform1f(uniforms.uSpan, span); context.uniform1f(uniforms.uMargin, MARGIN);
      const attribute = (name: string, data: Float32Array, usage: number) => {
        const made = context.createBuffer();
        context.bindBuffer(context.ARRAY_BUFFER, made);
        context.bufferData(context.ARRAY_BUFFER, data, usage);
        const at = context.getAttribLocation(program, name);
        context.enableVertexAttribArray(at);
        context.vertexAttribPointer(at, 2, context.FLOAT, false, 0, 0);
        return made;
      };
      attribute("aUv", mesh.uv, context.STATIC_DRAW);
      buffer = attribute("aPos", mesh.rest, context.DYNAMIC_DRAW);
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, context.createBuffer());
      context.bufferData(context.ELEMENT_ARRAY_BUFFER, mesh.indices, context.STATIC_DRAW);
      context.viewport(0, 0, size, size);
      context.clearColor(0, 0, 0, 0);
      context.enable(context.BLEND);
      context.blendFunc(context.ONE, context.ONE_MINUS_SRC_ALPHA);

      const art = new Image();
      art.decoding = "async";
      art.onload = () => {
        if (!gl) return;
        const texture = context.createTexture();
        context.bindTexture(context.TEXTURE_2D, texture);
        context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
        context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, art);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
        context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
        ready = true;
        canvas?.setAttribute("data-ready", "");
        if (lastFrame) draw(lastFrame);
      };
      art.onerror = () => { if (!dead) onLost(); };
      art.src = `${SPRITES}/center.webp`;
    },
    load() {},
    setPose() {},
    apply(frame) { lastFrame = frame; draw(frame); },
    destroy() {
      ready = false; dead = true;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      gl = null; canvas = null;
    }
  };
}
