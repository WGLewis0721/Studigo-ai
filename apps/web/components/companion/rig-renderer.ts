import type { Outfit, WindowPose } from "@/lib/companion-logic";
import type { MotionFrame } from "@/lib/companion-motion/director";
import { OUTFIT_TEXTURES } from "@/lib/companion-motion/outfits";
import { RIG, RIG_SIZE, STRETCH, buildRig, poseMesh } from "@/lib/companion-motion/rig";
import { SPRITES, loadSprites, spriteElements, spriteImages, type CompanionRenderer } from "./renderers";

/* The living companion's renderer: the approved front-facing drawing on a
   deforming mesh (lib/companion-motion/rig.ts), drawn with WebGL in one call.

   The mesh moves his head, frills, tail and body. The shader does what has to
   happen inside the drawing itself: the irises slide within the eyes, the lids
   close and smile, the mouth curls and opens, the cheeks warm. Nothing is
   redrawn by hand, so he stays the same dragon in every frame. An outfit is
   another drawing of him in the same framing, so the mesh carries it as well. */

/** The canvas is wider than his body box so a hop, a lean or a frill can leave it. */
const MARGIN = 0.3;
/** A swap between two drawings fades over this long: quick, and never a pop. */
const FADE_MS = 200;

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
varying vec2 vUv; uniform sampler2D uTex; uniform sampler2D uPrev; uniform float uMix;
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
  vec2 w = warp(vUv);
  vec4 col = mix(texture2D(uPrev, w), texture2D(uTex, w), uMix);
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

/* The drawings move with the rig's own whole-body numbers, so a drawing that takes over from the mesh keeps its motion. */
function bodyTransform(f: MotionFrame): string {
  const wide = (1 + f.squash * STRETCH.squashWide) * Math.cos(f.spin);
  const tall = (1 - f.squash) * (1 + f.breath * STRETCH.breathTall);
  return `translate(${((f.dash + f.shiver) * 100).toFixed(2)}%, ${(f.hop * 100).toFixed(2)}%) rotate(${(f.headTilt * 4).toFixed(2)}deg) scale(${wide.toFixed(4)}, ${tall.toFixed(4)})`;
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Studigo's rig shader did not compile: ${gl.getShaderInfoLog(shader)}`);
  return shader;
}

export type RigHooks = {
  /** The context was lost: he goes back to his drawings. */
  onLost(): void;
  /** The context came back and the rig can be drawn again. */
  onRestored(): void;
};

/** The rig, with the two moves the engine needs when a lost context comes back. */
export type RigRenderer = CompanionRenderer & {
  /** Takes the rig out of the page. Its canvas stays alive, so a restored context can still reach it. */
  park(): void;
  /** Puts the rig back into a body, in place of whatever is there. */
  resume(body: HTMLElement): void;
};

/** One drawing of him, undressed or in an outfit. Decoded once; its texture is made on the context that draws it. */
type Skin = { image: HTMLImageElement; decoded: boolean; failed: boolean; texture: WebGLTexture | null };

export function createRigRenderer({ onLost, onRestored }: RigHooks): RigRenderer {
  const mesh = buildRig();
  const positions = new Float32Array(mesh.count * 2);
  let wrap: HTMLElement | null = null, canvas: HTMLCanvasElement | null = null, gl: WebGLRenderingContext | null = null;
  let size = 0;
  let buffer: WebGLBuffer | null = null, ready = false, dead = false, lost = false, lastFrame: MotionFrame | null = null;
  /* His drawings by outfit (null is undressed). `current` is on screen; `previous` is the one a swap fades out of. */
  const skins = new Map<Outfit | null, Skin>();
  let wanted: Outfit | null = null, current: Skin | null = null, previous: Skin | null = null, fadeAt = 0;
  /* Set when the context is lost, and cleared once onRestored has been called for it. */
  let owedRestore = false;
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const span = 1 + MARGIN * 2;

  /* The original drawings that stand in for the mesh while the director names one, and the one showing now. */
  let drawings = new Map<string, HTMLImageElement>(), shown: WindowPose | null = null;

  /* Starts decoding one drawing. Nothing changes on screen until it is ready. */
  function prepare(outfit: Outfit | null) {
    const image = new Image();
    image.decoding = "async";
    const skin: Skin = { image, decoded: false, failed: false, texture: null };
    skins.set(outfit, skin);
    image.onload = () => { skin.decoded = true; if (!dead) settle(); };
    image.onerror = () => {
      skin.failed = true;
      if (dead) return;
      settle();
      // Without his undressed drawing and nothing on screen, there is nothing to draw him with.
      if (outfit === null && !current) onLost();
    };
    image.src = outfit === null ? `${SPRITES}/center.webp` : OUTFIT_TEXTURES[outfit];
  }

  /* Puts the drawing he should wear on screen once it is ready. Until then, and if it fails, what is on screen stays. */
  function settle() {
    if (!gl || lost || dead) return;
    const target = skins.get(wanted);
    if (target?.decoded) { show(target); return; }
    if (target && !target.failed) return;
    // The outfit failed with nothing on screen yet, so the undressed drawing stands in for it.
    if (current) return;
    const base = skins.get(null);
    if (!base) prepare(null);
    else if (base.decoded) show(base);
  }

  function ensure(skin: Skin): boolean {
    if (skin.texture) return true;
    if (!gl || lost || !skin.decoded) return false;
    skin.texture = upload(gl, skin.image);
    return skin.texture !== null;
  }

  function show(skin: Skin) {
    if (skin === current || !ensure(skin)) return;
    if (current) { previous = current; fadeAt = performance.now(); }
    current = skin;
    markReady();
    if (lastFrame) draw(lastFrame);
  }

  function markReady() {
    if (ready) return;
    ready = true;
    canvas?.setAttribute("data-ready", "");
    if (owedRestore) { owedRestore = false; onRestored(); }
  }

  /* 0 while the drawing before still shows, 1 once the one now does. */
  function blend(): number {
    if (!previous) return 1;
    const t = (performance.now() - fadeAt) / FADE_MS;
    if (t >= 1) { previous = null; return 1; }
    return Math.max(0, t);
  }

  function draw(frame: MotionFrame) {
    const top = current;
    if (!gl || !canvas || !ready || !top?.texture) return;
    poseMesh(mesh, frame, positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    const mix = blend();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, previous?.texture ?? top.texture);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, top.texture);
    gl.uniform1f(uniforms.uMix, mix);
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

  /* A drawing takes over with the canvas's own crossfade. Classes change only when the pose does; while a drawing shows, the body carries the motion the mesh would. */
  function showPose(frame: MotionFrame) {
    if (frame.pose !== shown) {
      if (shown !== null) drawings.get(shown)?.classList.remove("on");
      if (frame.pose !== null) drawings.get(frame.pose)?.classList.add("on");
      shown = frame.pose;
      canvas?.classList.toggle("off", shown !== null);
      if (shown === null && wrap) wrap.style.transform = "";
    }
    if (shown !== null && wrap) wrap.style.transform = bodyTransform(frame);
  }

  /* Builds the program, the buffers and the state on this context. It runs again after a restore, because the old objects died with the context. */
  function setUp(context: WebGLRenderingContext) {
    const program = context.createProgram()!;
    context.attachShader(program, compile(context, context.VERTEX_SHADER, VERTEX));
    context.attachShader(program, compile(context, context.FRAGMENT_SHADER, FRAGMENT));
    context.linkProgram(program);
    if (!context.getProgramParameter(program, context.LINK_STATUS)) throw new Error("Studigo's rig program did not link.");
    context.useProgram(program);
    for (const name of ["uTex", "uPrev", "uMix", "uSpan", "uMargin", "uGaze", "uOpen", "uSmile", "uBrow", "uMouthCurve", "uMouthOpen", "uCheek"]) uniforms[name] = context.getUniformLocation(program, name);
    context.uniform1f(uniforms.uSpan, span); context.uniform1f(uniforms.uMargin, MARGIN);
    context.uniform1i(uniforms.uTex, 0); context.uniform1i(uniforms.uPrev, 1);
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
  }

  /* A drawing as the texture the mesh samples. */
  function upload(context: WebGLRenderingContext, image: HTMLImageElement): WebGLTexture | null {
    const texture = context.createTexture();
    if (!texture) return null;
    context.activeTexture(context.TEXTURE0);
    context.bindTexture(context.TEXTURE_2D, texture);
    context.pixelStorei(context.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, image);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
    return texture;
  }

  /* The context came back: rebuild on the same canvas, make again the texture he is wearing, and hand the rig back. If that fails he stays on his drawings, and the next restore tries again. */
  function restore() {
    lost = false;
    if (dead || !gl) return;
    try {
      setUp(gl);
    } catch (error) {
      ready = false;
      console.warn("Studigo's rig could not come back; he stays on his drawings.", error);
      return;
    }
    for (const skin of skins.values()) skin.texture = null;
    previous = null;
    if (current && ensure(current)) markReady();
    settle();
  }

  return {
    kind: "rig",
    markup: () => `<div class="cmpRigBody"><canvas class="cmpRig" aria-hidden="true"></canvas>${spriteImages(null)}</div>`,
    mount(body) {
      canvas = body.querySelector<HTMLCanvasElement>(".cmpRig");
      wrap = body.querySelector<HTMLElement>(".cmpRigBody");
      if (!canvas || !wrap) throw new Error("Studigo's rig has no canvas.");
      drawings = spriteElements(body);
      // His window is at most 2x; 640 backing pixels keep him sharp there without a large buffer on phones.
      size = Math.round(Math.min(640, 150 * span * Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 1))));
      canvas.width = size; canvas.height = size;
      canvas.style.setProperty("--rig-margin", `${-MARGIN * 100}%`);
      gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: true, powerPreference: "low-power" });
      if (!gl) throw new Error("WebGL is not available for Studigo's rig.");
      const context = gl;
      canvas.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        ready = false; lost = true; owedRestore = true; previous = null;
        for (const skin of skins.values()) skin.texture = null;
        if (!dead) onLost();
      });
      canvas.addEventListener("webglcontextrestored", restore);
      setUp(context);
    },
    load() { loadSprites(drawings); },
    setPose() {},
    apply(frame) { lastFrame = frame; draw(frame); showPose(frame); },
    setOutfit(next) {
      if (dead) return;
      wanted = next;
      const known = skins.get(next);
      if (!known || known.failed) prepare(next);
      settle();
    },
    park() {
      ready = false;
      wrap?.remove();
    },
    resume(body) {
      if (wrap) body.replaceChildren(wrap);
    },
    destroy() {
      ready = false; dead = true;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      gl = null; canvas = null; wrap?.remove(); wrap = null; shown = null; drawings.clear();
      skins.clear(); current = null; previous = null;
    }
  };
}
