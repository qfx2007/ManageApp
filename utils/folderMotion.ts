// 从用户提供的 Folder 原版源码移植：保留 Flap/Spread 几何、矩阵与弹簧数学。
type Matrix = number[]
export type Phase = 'open' | 'receive' | 'peek' | 'rest'
export interface Geometry { book: boolean; scale: number; w: number; h: number; tabH: number; r: number; shoulder: number; corners: number[]; tabW: number; tabX: number; frontTop: number; frontH: number; docW: number; docH: number }
export interface Slot { x: number; y: number; z: number; r: number; ry: number; s: number }
export interface Spring { value: number; velocity: number }
export const MAX_ITEMS = 6
const STEP = 1 / 240
const FLAP_REST = [
  { x: 0.16, rise: 0, r: 3 },
  { x: -0.17, rise: 0.05, r: -3.5 },
  { x: 0, rise: 0.1, r: 0.5 },
  { x: 0.25, rise: 0.08, r: 5 },
  { x: -0.25, rise: 0.09, r: -5.5 },
  { x: 0.08, rise: 0.12, r: 1.5 }
];
const SPREAD_TURN = [4, -5, 3, -6, 5, -3];
const SPREAD_DROP = [0.03, -0.04, 0.05, -0.02, 0.04, -0.05];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const multiply = (a: Matrix, b: Matrix): Matrix => {
  const out: Matrix = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
};

export const chain = (...list: Matrix[]) => list.reduce(multiply);
export const move = (x: number, y: number, z = 0): Matrix => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
export const stretch = (x: number, y: number): Matrix => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

export const turnX = (degrees: number): Matrix => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
};

export const turnY = (degrees: number): Matrix => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
};

export const turnZ = (degrees: number): Matrix => {
  const r = (degrees * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

export const toCss = (m: Matrix) => `matrix3d(${m.map(v => (Math.abs(v) < 1e-7 ? 0 : Number(v.toFixed(6)))).join(', ')})`;

export const measureFolder = (
  book: boolean,
  scale: number,
  labelWidth: number,
  hasLabel: boolean,
  tabPosition: string,
  dimensions?: { width: number; height: number; paperWidth: number; paperHeight: number; tabShoulder?: number }
): Geometry => {
  const w = (dimensions?.width ?? (book ? 180 : 224)) * scale;
  const h = (dimensions?.height ?? (book ? 232 : 176)) * scale;
  const tabH = 20 * scale;
  const r = 12 * scale;
  const shoulder = (dimensions?.tabShoulder ?? 15) * scale;
  const frontTop = book ? tabH : tabH + h * 0.3;
  const corners = book ? [0, r, r, 0] : [r, r, r, r];
  const maxTab = w - corners[0] - corners[1] - shoulder * 2 - 10 * scale;
  // 标签顶缘两端各扣除一个肩部，留出完整的日期宽度及左右留白。
  const desiredTab = hasLabel ? labelWidth + 14 * scale + 2 * shoulder : w * 0.34;
  const tabW = clamp(desiredTab, Math.min(w * 0.3, maxTab), maxTab);
  const tabX =
    tabPosition === 'left'
      ? corners[0] + 5 * scale + shoulder
      : tabPosition === 'center'
        ? (w - tabW) / 2
        : w - corners[1] - 5 * scale - shoulder - tabW;
  const docW = dimensions ? dimensions.paperWidth * scale : book ? w * 0.8 : w * 0.54;
  return {
    book,
    scale,
    w,
    h,
    tabH,
    r,
    shoulder,
    corners,
    tabW,
    tabX,
    frontTop,
    frontH: tabH + h - frontTop,
    docW,
    docH: dimensions ? dimensions.paperHeight * scale : docW * (book ? 1.28 : 1.22)
  };
};

export const backPath = (g: Geometry) => {
  const { w, h, tabX, tabW, tabH, shoulder } = g;
  const [tl, tr, br, bl] = g.corners;
  const top = tabH;
  const bottom = tabH + h;
  return [
    `M 0 ${top + tl}`,
    `Q 0 ${top} ${tl} ${top}`,
    `L ${tabX - shoulder} ${top}`,
    `C ${tabX} ${top} ${tabX} 0 ${tabX + shoulder} 0`,
    `L ${tabX + tabW - shoulder} 0`,
    `C ${tabX + tabW} 0 ${tabX + tabW} ${top} ${tabX + tabW + shoulder} ${top}`,
    `L ${w - tr} ${top}`,
    `Q ${w} ${top} ${w} ${top + tr}`,
    `L ${w} ${bottom - br}`,
    `Q ${w} ${bottom} ${w - br} ${bottom}`,
    `L ${bl} ${bottom}`,
    `Q 0 ${bottom} 0 ${bottom - bl}`,
    'Z'
  ].join(' ');
};

export const placeFlap = (
  rank: number,
  count: number,
  phase: Phase,
  layout: string,
  g: Geometry,
  pointer: number | null
): Slot => {
  const rest = FLAP_REST[rank] ?? FLAP_REST[FLAP_REST.length - 1];
  const floor = g.tabH + g.h - 5 * g.scale - g.docH / 2;
  const mid = (count - 1) / 2;
  if (phase === 'open') {
    const lift = g.tabH - g.h * 0.02;
    if (layout === 'stack') {
      const strip = Math.min(30 * g.scale, (g.h * 0.62) / Math.max(1, count - 1));
      const fit = 1.04 - rank * 0.05;
      return {
        x: g.w / 2,
        y: g.tabH + g.h * 0.1 - rank * strip - (g.docH * (1.04 - fit)) / 2,
        z: -rank * 18 * g.scale,
        r: 0,
        ry: 0,
        s: fit
      };
    }
    const gap = 12 * g.scale;
    const fit = Math.min(0.94, (g.w * 2.3 - gap * (count - 1)) / (count * g.docW));
    const step = g.docW * fit + gap;
    const tidy = layout === 'row';
    return {
      x: g.w / 2 + (rank - mid) * step,
      y: lift + (tidy ? 0 : SPREAD_DROP[rank] * g.h * 0.7),
      z: 0,
      r: tidy ? 0 : SPREAD_TURN[rank] * 0.55,
      ry: 0,
      s: fit
    };
  }
  const part = phase === 'receive' ? 1.7 : phase === 'peek' ? 1.3 : 1;
  const x = g.w / 2 + rest.x * g.w * part;
  if (phase === 'rest') return { x, y: floor - rest.rise * g.h, z: 0, r: rest.r, ry: 0, s: 1 };
  const near = phase === 'peek' && pointer != null ? Math.max(0, 1 - Math.abs(pointer - x) / (g.w * 0.32)) : 0;
  const rise = rest.rise + (phase === 'receive' ? 0.03 : 0.1);
  return { x, y: floor - rise * g.h - near * near * g.h * 0.09, z: 0, r: rest.r * 1.6, ry: 0, s: 1 };
};


// 原版 integrate 的固定子步进，停止收敛后不再发送小程序视图更新。
export function integrate(item: Spring, target: number, omega: number, zeta: number, dt: number) {
    const k = omega * omega
    const d = 2 * zeta * omega
    const steps = Math.max(1, Math.ceil(dt / STEP))
    const step = dt / steps
    for (let i = 0; i < steps; i++) {
        item.velocity += (k * (target - item.value) - d * item.velocity) * step
        item.value += item.velocity * step
    }
    return Math.abs(target - item.value) > 0.01 || Math.abs(item.velocity) > 0.01
}
