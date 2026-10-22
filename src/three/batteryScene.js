/**
 * Bateria 3D da hero — modelo procedural (sem arquivo .glb para baixar).
 *
 * É um modelo CONCEITUAL: não reproduz rótulo, marca ou especificação de
 * nenhum produto real. O rótulo traz apenas "12 V" (tensão nominal comum a
 * baterias automotivas) e a indicação "modelo ilustrativo".
 *
 * Custos controlados: ~40 draw calls, uma luz com sombra, sem pós-processamento,
 * loop pausado fora da tela / aba oculta, DPR limitado e degradação automática
 * se o dispositivo não sustentar a taxa de quadros.
 */
import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RingGeometry,
  Scene,
  ShadowMaterial,
  SpotLight,
  SRGBColorSpace,
  Timer,
  WebGLRenderer,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BRAND_YELLOW = '#FFB900';
const BRAND_NAVY = '#182E89';

// Dimensões em decímetros, proporção de uma bateria automotiva comum (≈ 242 × 175 × 175 mm).
const L = 2.42;
const D = 1.75;
const BASE_H = 0.08;
const BODY_H = 1.46;
const LID_H = 0.2;
const TOP = BASE_H + BODY_H + LID_H; // 1.74
const TERMINAL_X = 0.82;
const TERMINAL_Z = -0.5;

/* ---------- Texturas desenhadas em canvas (sem downloads) ---------- */

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function labelTexture(maxAniso, side = 'front') {
  const W = 1024;
  const H = 560;
  const [c, g] = makeCanvas(W, H);
  const font = (w, px, fam = '"Archivo Variable", Arial, sans-serif') => `${w} ${px}px ${fam}`;
  const mono = (px) => font(500, px, '"JetBrains Mono", Consolas, monospace');
  const stretch = (v) => 'fontStretch' in g && (g.fontStretch = v);

  // Base grafite (acabamento de adesivo premium).
  const base = g.createLinearGradient(0, 0, W, H);
  base.addColorStop(0, '#1b1f29');
  base.addColorStop(1, '#0d0f14');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);

  if (side === 'front') {
    // Painel azul institucional com borda diagonal (eco do raio do logotipo).
    const navy = g.createLinearGradient(0, 0, 0, H);
    navy.addColorStop(0, '#2141b0');
    navy.addColorStop(1, '#122170');
    g.fillStyle = navy;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(W * 0.6, 0);
    g.lineTo(W * 0.52, H);
    g.lineTo(0, H);
    g.closePath();
    g.fill();
    // Hachura fina, só perceptível de perto.
    g.save();
    g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.04)';
    g.lineWidth = 2;
    for (let x = -H; x < W; x += 14) {
      g.beginPath();
      g.moveTo(x, H);
      g.lineTo(x + H, 0);
      g.stroke();
    }
    g.restore();
    // Filete amarelo na diagonal.
    g.fillStyle = BRAND_YELLOW;
    g.beginPath();
    g.moveTo(W * 0.6, 0);
    g.lineTo(W * 0.625, 0);
    g.lineTo(W * 0.545, H);
    g.lineTo(W * 0.52, H);
    g.closePath();
    g.fill();

    g.fillStyle = '#ffffff';
    g.font = font(800, 176);
    stretch('expanded');
    g.fillText('12V', 60, 250);
    stretch('normal');
    g.font = font(650, 28);
    g.globalAlpha = 0.92;
    g.fillText('BATERIA AUTOMOTIVA', 64, 310);
    g.globalAlpha = 1;
    g.fillStyle = BRAND_YELLOW;
    g.fillRect(64, 338, 72, 4);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = mono(20);
    g.fillText('MODELO ILUSTRATIVO', 64, 392);

    // Selo com raio na área grafite.
    const cx = W * 0.8;
    const cy = H * 0.42;
    g.strokeStyle = BRAND_YELLOW;
    g.lineWidth = 5;
    g.beginPath();
    g.arc(cx, cy, 86, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = BRAND_YELLOW;
    g.beginPath();
    g.moveTo(cx + 14, cy - 58);
    g.lineTo(cx - 34, cy + 10);
    g.lineTo(cx - 4, cy + 10);
    g.lineTo(cx - 16, cy + 58);
    g.lineTo(cx + 34, cy - 12);
    g.lineTo(cx + 4, cy - 12);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = mono(18);
    g.textAlign = 'center';
    g.fillText('+ POSITIVO  − NEGATIVO', cx, cy + 140);
    g.textAlign = 'left';
  } else {
    // Verso: faixa azul inferior + conceito da marca.
    g.fillStyle = '#16297f';
    g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle = BRAND_YELLOW;
    g.fillRect(0, H * 0.72, W, 5);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    const motto = 'ENERGIA · PRECISÃO · MOVIMENTO';
    stretch('expanded');
    let size = 64;
    g.font = font(800, size);
    while (g.measureText(motto).width > W - 128 && size > 24) g.font = font(800, (size -= 2));
    g.fillText(motto, 60, 200);
    stretch('normal');
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.font = mono(22);
    g.fillText('MODELO ILUSTRATIVO · 12 V', 64, 262);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.font = mono(20);
    g.fillText('CONFIRA A APLICAÇÃO DO SEU VEÍCULO', 64, H * 0.72 + 92);
  }

  // Régua técnica + contorno de adesivo.
  g.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 40; i++) g.fillRect(64 + i * 10, H - 46, 2, i % 5 === 0 ? 18 : 9);
  g.strokeStyle = 'rgba(255,255,255,0.1)';
  g.lineWidth = 4;
  g.strokeRect(10, 10, W - 20, H - 20);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

function lidTexture(maxAniso) {
  const W = 1024;
  const H = 740;
  const [c, g] = makeCanvas(W, H);
  g.fillStyle = '#1a1d24';
  g.fillRect(0, 0, W, H);

  // Moldagem: borda e painel central de respiro.
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.lineWidth = 6;
  g.strokeRect(26, 26, W - 52, H - 52);

  g.fillStyle = '#20242d';
  g.fillRect(W * 0.2, H * 0.62, W * 0.6, H * 0.22);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 4;
  g.strokeRect(W * 0.2, H * 0.62, W * 0.6, H * 0.22);
  for (let i = 0; i < 6; i++) {
    const x = W * 0.2 + (W * 0.6 * (i + 0.5)) / 6;
    g.beginPath();
    g.arc(x, H * 0.73, 26, 0, Math.PI * 2);
    g.fillStyle = '#16191f';
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)';
    g.lineWidth = 3;
    g.stroke();
  }

  // Polaridade moldada ao lado dos terminais (+ à direita).
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.font = '800 96px "Archivo Variable", Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('+', W * 0.5 + (TERMINAL_X / L) * W - 140, H * 0.5 + (TERMINAL_Z / D) * H + 34);
  g.fillText('−', W * 0.5 - (TERMINAL_X / L) * W + 140, H * 0.5 + (TERMINAL_Z / D) * H + 34);

  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = maxAniso;
  return t;
}

function radialTexture(inner, outer) {
  const [c, g] = makeCanvas(256, 256);
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner);
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/* ---------- Construção do modelo ---------- */

function buildBattery({ maxAniso, quality }) {
  const seg = quality === 'high' ? 5 : 3;
  const group = new Group();

  const plastic = new MeshPhysicalMaterial({
    color: '#15171d',
    roughness: 0.46,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
  });
  const lidMat = new MeshPhysicalMaterial({
    map: lidTexture(maxAniso),
    roughness: 0.55,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
  });
  const lidSide = new MeshPhysicalMaterial({ color: '#1b1e26', roughness: 0.55, clearcoat: 0.2 });
  const lead = new MeshStandardMaterial({ color: '#b9bec6', metalness: 1, roughness: 0.32 });
  const collarPos = new MeshStandardMaterial({ color: '#b3261e', roughness: 0.5 });
  const collarNeg = new MeshStandardMaterial({ color: '#202329', roughness: 0.5 });

  const shadowy = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };

  // Base com aba de fixação.
  const base = shadowy(new Mesh(new RoundedBoxGeometry(L + 0.08, BASE_H, D + 0.06, 2, 0.03), plastic));
  base.position.y = BASE_H / 2;
  group.add(base);

  // Corpo.
  const body = shadowy(new Mesh(new RoundedBoxGeometry(L, BODY_H + 0.04, D, seg, 0.07), plastic));
  body.position.y = BASE_H + BODY_H / 2;
  group.add(body);

  // Nervuras laterais moldadas.
  const ribGeo = new BoxGeometry(0.03, BODY_H * 0.78, 0.07);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const rib = shadowy(new Mesh(ribGeo, plastic));
      rib.position.set(side * (L / 2 + 0.012), BASE_H + BODY_H * 0.5, -0.45 + i * 0.45);
      group.add(rib);
    }

  // Tampa: laterais lisas + face superior texturizada.
  const lid = shadowy(new Mesh(new RoundedBoxGeometry(L + 0.02, LID_H, D + 0.02, seg, 0.05), lidSide));
  lid.position.y = BASE_H + BODY_H + LID_H / 2;
  group.add(lid);
  const lidTop = new Mesh(new PlaneGeometry(L - 0.06, D - 0.06), lidMat);
  lidTop.rotation.x = -Math.PI / 2;
  lidTop.position.y = TOP + 0.001;
  lidTop.receiveShadow = true;
  group.add(lidTop);

  // Encaixes rebaixados dos terminais (pads mais escuros).
  const padMat = new MeshStandardMaterial({ color: '#0e1014', roughness: 0.7 });
  const padGeo = new RoundedBoxGeometry(0.5, 0.012, 0.5, 2, 0.04);
  for (const x of [TERMINAL_X, -TERMINAL_X]) {
    const pad = new Mesh(padGeo, padMat);
    pad.position.set(x, TOP + 0.004, TERMINAL_Z);
    pad.receiveShadow = true;
    group.add(pad);
  }

  // Alça rebatível deitada sobre a tampa, com articulações nas pontas.
  const handleMat = new MeshPhysicalMaterial({ color: '#101217', roughness: 0.42, clearcoat: 0.4, clearcoatRoughness: 0.35 });
  const grip = shadowy(new Mesh(new CapsuleGeometry(0.038, 1.12, 6, 16), handleMat));
  grip.rotation.z = Math.PI / 2;
  grip.position.set(0, TOP + 0.045, 0.16);
  group.add(grip);
  const hingeGeo = new RoundedBoxGeometry(0.12, 0.08, 0.16, 2, 0.025);
  for (const x of [-0.66, 0.66]) {
    const hinge = shadowy(new Mesh(hingeGeo, handleMat));
    hinge.position.set(x, TOP + 0.04, 0.16);
    group.add(hinge);
  }

  // Indicador de carga ("olho mágico").
  const eyeRing = new Mesh(new CylinderGeometry(0.085, 0.09, 0.03, 40), new MeshStandardMaterial({ color: '#08090c', roughness: 0.4 }));
  eyeRing.position.set(0.42, TOP + 0.015, 0.52);
  const eye = new Mesh(
    new CylinderGeometry(0.055, 0.055, 0.036, 40),
    new MeshPhysicalMaterial({ color: '#1fd067', emissive: '#16b856', emissiveIntensity: 0.6, roughness: 0.12, clearcoat: 1 }),
  );
  eye.position.set(0.42, TOP + 0.02, 0.52);
  group.add(eyeRing, eye);

  // Terminais: colarinho colorido + poste de chumbo cônico.
  const collarGeo = new CylinderGeometry(0.19, 0.2, 0.06, 40);
  const postGeo = new CylinderGeometry(0.088, 0.102, 0.2, 40);
  const capGeo = new CylinderGeometry(0.075, 0.088, 0.02, 40);
  for (const [x, collarMat] of [
    [TERMINAL_X, collarPos],
    [-TERMINAL_X, collarNeg],
  ]) {
    const collar = shadowy(new Mesh(collarGeo, collarMat));
    collar.position.set(x, TOP + 0.03, TERMINAL_Z);
    const post = shadowy(new Mesh(postGeo, lead));
    post.position.set(x, TOP + 0.16, TERMINAL_Z);
    const cap = shadowy(new Mesh(capGeo, lead));
    cap.position.set(x, TOP + 0.27, TERMINAL_Z);
    group.add(collar, post, cap);
  }

  // Rótulo frontal (adesivo com leve brilho).
  const label = new Mesh(
    new PlaneGeometry(L * 0.86, BODY_H * 0.7),
    new MeshPhysicalMaterial({
      map: labelTexture(maxAniso),
      roughness: 0.38,
      clearcoat: 0.6,
      clearcoatRoughness: 0.25,
    }),
  );
  label.position.set(0, BASE_H + BODY_H * 0.5, D / 2 + 0.002);
  label.receiveShadow = true;
  group.add(label);

  // Rótulo traseiro: a rotação nunca mostra uma face "vazia".
  const back = new Mesh(
    new PlaneGeometry(L * 0.86, BODY_H * 0.7),
    new MeshPhysicalMaterial({ map: labelTexture(maxAniso, 'back'), roughness: 0.38, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
  back.position.set(0, BASE_H + BODY_H * 0.5, -D / 2 - 0.002);
  back.rotation.y = Math.PI;
  back.receiveShadow = true;
  group.add(back);

  return { group, eye };
}

function buildStage(quality) {
  const stage = new Group();

  // Sombra projetada.
  const catcher = new Mesh(new PlaneGeometry(12, 12), new ShadowMaterial({ opacity: 0.55 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.receiveShadow = true;
  stage.add(catcher);

  // Plataforma escura que se dissolve no fundo.
  const disc = new Mesh(
    new CircleGeometry(3.2, 96),
    new MeshBasicMaterial({
      map: radialTexture('rgba(30,36,52,0.85)', 'rgba(10,12,18,0)'),
      transparent: true,
      depthWrite: false,
    }),
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = -0.002;
  disc.renderOrder = -1;
  stage.add(disc);

  // Brilho de energia sob a bateria.
  const glow = new Mesh(
    new PlaneGeometry(5.2, 5.2),
    new MeshBasicMaterial({
      map: radialTexture('rgba(255,185,0,0.32)', 'rgba(255,185,0,0)'),
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.003;
  stage.add(glow);

  // Halo e escala de instrumento (precisão).
  const halo = new Mesh(
    new RingGeometry(2.02, 2.04, 160),
    new MeshBasicMaterial({ color: BRAND_YELLOW, transparent: true, opacity: 0.5, depthWrite: false }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.006;
  stage.add(halo);

  const ticks = [];
  const n = quality === 'high' ? 120 : 72;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r0 = 2.12;
    const r1 = i % 10 === 0 ? 2.32 : 2.2;
    ticks.push(Math.cos(a) * r0, 0, Math.sin(a) * r0, Math.cos(a) * r1, 0, Math.sin(a) * r1);
  }
  const tickGeo = new BufferGeometry();
  tickGeo.setAttribute('position', new Float32BufferAttribute(ticks, 3));
  const dial = new LineSegments(
    tickGeo,
    new LineBasicMaterial({ color: '#9aa3b8', transparent: true, opacity: 0.22, depthWrite: false }),
  );
  dial.position.y = 0.006;
  stage.add(dial);

  // Energia em movimento: um traço luminoso percorre o anel…
  const spark = new Mesh(
    new RingGeometry(2.0, 2.06, 48, 1, 0, 0.55),
    new MeshBasicMaterial({ color: '#ffd25c', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }),
  );
  spark.rotation.x = -Math.PI / 2;
  spark.position.y = 0.008;
  stage.add(spark);

  // …e, de tempos em tempos, uma onda discreta se expande a partir dele.
  const wave = new Mesh(
    new RingGeometry(2.0, 2.025, 160),
    new MeshBasicMaterial({ color: BRAND_YELLOW, transparent: true, opacity: 0, depthWrite: false }),
  );
  wave.rotation.x = -Math.PI / 2;
  wave.position.y = 0.007;
  stage.add(wave);

  return { stage, halo, glow, dial, spark, wave };
}

/* ---------- Montagem ---------- */

/** Cede a thread principal entre etapas pesadas (evita uma tarefa longa única). */
const yieldToMain = () =>
  'scheduler' in window && 'yield' in window.scheduler
    ? window.scheduler.yield()
    : new Promise((r) => setTimeout(r, 0));

/**
 * @param {HTMLElement} container
 * @param {{ reducedMotion: boolean, quality: 'high'|'low', interactive: boolean }} opts
 * @returns {Promise<{ dispose: () => void }>} resolve após o primeiro quadro renderizado
 */
export async function mountBatteryScene(container, opts) {
  const { reducedMotion, quality, interactive, initialYaw = 0 } = opts;

  // Garante as fontes do rótulo antes de desenhar o canvas.
  try {
    await Promise.all([
      document.fonts.load('800 200px "Archivo Variable"'),
      document.fonts.load('500 22px "JetBrains Mono"'),
    ]);
  } catch {
    /* segue com a fonte de fallback */
  }

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  let dprCap = quality === 'high' ? 1.75 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'hero-canvas';

  const scene = new Scene();
  await yieldToMain();
  // Reflexos de estúdio: mapa de ambiente pequeno basta para plástico e chumbo.
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04, 0.1, 100, { size: quality === 'high' ? 128 : 64 }).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.32;
  pmrem.dispose();

  const camera = new PerspectiveCamera(26, 1, 0.1, 60);
  const lookY = 0.92;

  await yieldToMain();
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const { group: battery, eye } = buildBattery({ maxAniso, quality });
  const pivot = new Group(); // rotação contínua
  const tilt = new Group(); // inclinação pelo cursor
  pivot.add(battery);
  tilt.add(pivot);
  scene.add(tilt);

  await yieldToMain();
  const { stage, halo, glow, dial, spark, wave } = buildStage(quality);
  scene.add(stage);

  // Iluminação de estúdio.
  scene.add(new HemisphereLight('#c9d3ff', '#0a0b10', 0.35));

  const key = new SpotLight('#fff4e2', 0, 0, MathUtils.degToRad(32), 0.6, 1.4);
  key.castShadow = true;
  const sm = quality === 'high' ? 1024 : 512;
  key.shadow.mapSize.set(sm, sm);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 20;
  key.target.position.set(0, 0.6, 0);
  scene.add(key, key.target);

  const rim = new DirectionalLight(BRAND_YELLOW, 0);
  rim.position.set(4.5, 3.2, -4.5);
  scene.add(rim);

  const fill = new DirectionalLight(new Color(BRAND_NAVY).lerp(new Color('#ffffff'), 0.45), 0);
  fill.position.set(-5, 1.4, 2.5);
  scene.add(fill);

  const KEY_I = 95;
  const RIM_I = 2.4;
  const FILL_I = 0.9;

  // Ângulo de apresentação (3/4, rótulo + terminais visíveis).
  const BASE_YAW = -0.55;

  function placeKey(t) {
    const a = 0.75 + Math.sin(t * 0.22) * 0.45; // varredura lenta da luz principal
    key.position.set(Math.cos(a) * 5.5 * -1, 7.2, Math.sin(a) * 5.5 + 1.5);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Enquadra a esfera envolvente da bateria + plataforma em qualquer proporção.
    // Quadros largos são limitados pela altura: dá para aproximar sem cortar a bateria.
    const radius = camera.aspect > 1.3 ? 1.6 : 2.15;
    const vfov = MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 0.98;
    const elev = MathUtils.degToRad(17);
    camera.position.set(0, lookY + Math.sin(elev) * dist, Math.cos(elev) * dist);
    camera.lookAt(0, lookY, 0);
    camera.updateProjectionMatrix();
  }

  container.appendChild(renderer.domElement);
  resize();

  /* ---------- Animação ---------- */
  const timer = new Timer();
  let elapsed = 0;
  let yaw = initialYaw;
  let running = false;
  let raf = 0;
  let visible = true;
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const ENTRANCE = reducedMotion ? 0 : 1.9;

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function frame(dt) {
    elapsed += dt;
    const e = ENTRANCE ? easeOut(Math.min(1, elapsed / ENTRANCE)) : 1;

    // Giro contínuo e lento, que desacelera quando um rótulo está de frente
    // (0,08 rad/s) e passa mais rápido pelas laterais (0,22 rad/s).
    if (!reducedMotion) {
      const facing = Math.abs(Math.cos(BASE_YAW + yaw));
      yaw += dt * (0.22 - 0.14 * facing);
    }
    pivot.rotation.y = BASE_YAW + yaw + (1 - e) * -0.9;
    battery.position.y = (reducedMotion ? 0 : Math.sin(elapsed * 0.9) * 0.035) + (1 - e) * -0.35;
    const s = 0.94 + 0.06 * e;
    battery.scale.setScalar(s);

    pointer.x += (pointer.tx - pointer.x) * 0.045;
    pointer.y += (pointer.ty - pointer.y) * 0.045;
    tilt.rotation.y = pointer.x * 0.22;
    tilt.rotation.x = pointer.y * 0.06;

    placeKey(reducedMotion ? 0 : elapsed);
    key.intensity = KEY_I * e;
    rim.intensity = RIM_I * e;
    fill.intensity = FILL_I * e;

    const breath = reducedMotion ? 0.5 : 0.42 + Math.sin(elapsed * 1.4) * 0.1;
    halo.material.opacity = breath * e;
    halo.scale.setScalar(0.7 + 0.3 * e);
    glow.material.opacity = 0.75 + (breath - 0.42) * 1.2;
    if (!reducedMotion) dial.rotation.y -= dt * 0.02;
    dial.material.opacity = 0.22 * e;

    // Energia: faísca no anel, onda a cada 6 s e o indicador de carga "respirando".
    if (!reducedMotion) {
      spark.rotation.z = elapsed * 0.6;
      spark.material.opacity = 0.75 * e;
      const w = (elapsed % 6) / 1.6;
      if (w < 1) {
        wave.scale.setScalar(1 + 0.32 * easeOut(w));
        wave.material.opacity = 0.5 * (1 - w) * e;
      } else wave.material.opacity = 0;
      eye.material.emissiveIntensity = 0.45 + Math.sin(elapsed * 2.2) * 0.25;
    }

    renderer.render(scene, camera);
  }

  // Monitor de desempenho: reduz a resolução e, se preciso, congela a animação.
  let perfFrames = 0;
  let perfTime = 0;
  let degradeStep = 0;
  function watchPerf(dt) {
    if (degradeStep >= 2) return;
    perfFrames++;
    perfTime += dt;
    if (perfFrames < 90) return;
    const avg = perfTime / perfFrames;
    perfFrames = 0;
    perfTime = 0;
    if (avg > (quality === 'low' ? 1 / 20 : 1 / 30)) {
      degradeStep++;
      if (degradeStep === 1) {
        dprCap = 1;
        renderer.setPixelRatio(1);
        renderer.shadowMap.enabled = false;
        resize();
      } else {
        stop();
        // Congela na pose final de apresentação (nunca no meio da entrada).
        elapsed = Math.max(elapsed, ENTRANCE);
        frame(0);
        container.classList.add('is-static');
      }
    }
  }

  // No modo mobile a rotação lenta não precisa de 60 fps: 30 fps poupa bateria e GPU.
  const minFrameTime = quality === 'low' ? 1 / 30 - 0.002 : 0;
  let acc = 0;
  function loop(now) {
    timer.update(now);
    acc += timer.getDelta();
    raf = requestAnimationFrame(loop);
    if (acc < minFrameTime) return;
    const dt = Math.min(acc, 0.05);
    acc = 0;
    frame(dt);
    watchPerf(dt);
  }
  function start() {
    if (running || reducedMotion || degradeStep >= 2) return;
    running = true;
    timer.reset?.();
    timer.update(performance.now());
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Compila os shaders sem travar a página (KHR_parallel_shader_compile quando disponível).
  if (renderer.extensions.has('KHR_parallel_shader_compile')) {
    try {
      await renderer.compileAsync(scene, camera);
    } catch {
      /* sem compilação assíncrona: os shaders compilam no primeiro quadro */
    }
  }
  await yieldToMain();

  // Primeiro quadro (no reduced motion é o único, além dos redimensionamentos).
  frame(0);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible && !document.hidden ? start() : stop();
  });
  io.observe(container);
  const onVisibility = () => (document.hidden || !visible ? stop() : start());
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => {
    resize();
    if (!running) frame(0);
  });
  ro.observe(container);

  const onPointer = (ev) => {
    const r = container.getBoundingClientRect();
    pointer.tx = MathUtils.clamp(((ev.clientX - r.left) / r.width) * 2 - 1, -1.2, 1.2);
    pointer.ty = MathUtils.clamp(((ev.clientY - r.top) / r.height) * 2 - 1, -1.2, 1.2);
  };
  const onLeave = () => {
    pointer.tx = 0;
    pointer.ty = 0;
  };
  if (interactive && !reducedMotion) {
    window.addEventListener('pointermove', onPointer, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
  }

  const onLost = (ev) => {
    ev.preventDefault();
    stop();
    container.classList.add('is-webgl-lost');
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);

  start();

  return {
    dispose() {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pointermove', onPointer);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      scene.traverse((o) => {
        o.geometry?.dispose?.();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        mats.forEach((m) => {
          m.map?.dispose?.();
          m.dispose();
        });
      });
      envTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
