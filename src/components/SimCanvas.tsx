import { useEffect, useRef, type RefObject } from 'react';
import { itemState, STATE_COLORS, type Item, type Server, type SimData } from '../sim/engine';

const VIEW_W = 1000;
const VIEW_H = 400;
const CY = 200;

const QUEUE1_VISIBLE = 8;
const QUEUE2_COLS = 10;
const QUEUE2_MIN_ROWS = 3;
const QUEUE2_MAX_ROWS = 20;
const QUEUE2_ROW_GAP = 8;

const DEV = { x: 400, y: 50, w: 90, h: 300, cx: 445 };
const QA = { x: 690, y: 50, w: 80, h: 300, cx: 730 };
const DONE = { cx: 840, cy: CY, r: 26 };

const DEV_COLOR = '#0ea5e9';
const QA_COLOR = '#10b981';
const LABEL_FONT = '600 8px "JetBrains Mono", ui-monospace, monospace';

interface Props {
  dataRef: RefObject<SimData>;
}

function serverYs(count: number): number[] {
  const gap = Math.min(64, 240 / Math.max(1, count));
  return Array.from({ length: count }, (_, i) => CY + (i - (count - 1) / 2) * gap);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.06)';
  ctx.lineWidth = 1;
  const step = 32;
  ctx.beginPath();
  for (let x = 0; x <= w; x += step) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = 0; y <= h; y += step) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = LABEL_FONT;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, stroke: string, radius = 4) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function dashedLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.save();
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function node(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#1e293b';
  ctx.fill();
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function stageColumn(ctx: CanvasRenderingContext2D, s: typeof DEV, color: string, title: string) {
  const grad = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  grad.addColorStop(0, `${color}38`);
  grad.addColorStop(1, `${color}14`);
  ctx.beginPath();
  ctx.roundRect(s.x, s.y, s.w, s.h, 6);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = `${color}99`;
  ctx.lineWidth = 1;
  ctx.stroke();
  label(ctx, title, s.x + s.w / 2, s.y + 12, '#e2e8f0');
}

function drawServers(ctx: CanvasRenderingContext2D, servers: Server[], cx: number, color: string) {
  const ys = serverYs(servers.length);
  servers.forEach((s, i) => {
    const y = ys[i];
    ctx.beginPath();
    ctx.arc(cx, y, 11, 0, Math.PI * 2);
    if (s.item) {
      const blocked = s.item.blocked;
      ctx.save();
      ctx.shadowColor = blocked ? '#ef4444' : color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = blocked ? '#7f1d1d' : color;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = blocked ? '#ef4444' : '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (s.item.whale) label(ctx, 'W', cx + 16, y - 10, '#fbbf24');
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.strokeStyle = `${color}cc`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.font = '600 9px Inter, system-ui, sans-serif';
      ctx.fillStyle = `${color}cc`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', cx, y + 0.5);
    }
  });
}

function drawItem(ctx: CanvasRenderingContext2D, item: Item, now: number, r = 4) {
  const radius = item.whale ? r * 1.6 : r;
  ctx.beginPath();
  ctx.arc(item.x, item.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = STATE_COLORS[itemState(item, now)];
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function moveToward(item: Item, tx: number, ty: number, k: number) {
  item.x += (tx - item.x) * k;
  item.y += (ty - item.y) * k;
}

function render(ctx: CanvasRenderingContext2D, w: number, h: number, data: SimData, dtReal: number) {
  ctx.clearRect(0, 0, w, h);
  drawGrid(ctx, w, h);

  const scale = Math.min(w / VIEW_W, h / VIEW_H);
  ctx.save();
  ctx.translate((w - VIEW_W * scale) / 2, (h - VIEW_H * scale) / 2);
  ctx.scale(scale, scale);

  const now = data.time;
  const k = 1 - Math.exp(-dtReal * 10);
  const devYs = serverYs(data.dev.length);
  const qaYs = serverYs(data.qa.length);

  stageColumn(ctx, DEV, DEV_COLOR, 'STAGE 1: DEV');
  stageColumn(ctx, QA, QA_COLOR, 'STAGE 2: QA');

  // Backlog + Queue 1
  box(ctx, 150, 180, 36, 40, '#0f172a', 'rgba(148,163,184,0.35)');
  ctx.font = '700 13px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(Math.max(0, data.queue1.length - QUEUE1_VISIBLE)), 168, 196);
  label(ctx, 'BACKLOG', 168, 213, '#94a3b8');

  box(ctx, 196, 180, 130, 40, 'rgba(15,23,42,0.85)', 'rgba(148,163,184,0.35)');
  label(ctx, 'QUEUE 1 / PIPELINE', 202, 213, '#94a3b8', 'left');
  dashedLine(ctx, 200, 197, 322, 197);

  // Fan-in / fan-out lines around Dev
  dashedLine(ctx, 326, CY, 370, CY);
  devYs.forEach((y) => {
    dashedLine(ctx, 370, CY, DEV.cx - 11, y);
    dashedLine(ctx, DEV.cx + 11, y, 520, CY);
  });
  node(ctx, 370, CY);
  dashedLine(ctx, 520, CY, 540, CY);

  // Queue 2
  const q2Visible = QUEUE2_COLS * QUEUE2_MAX_ROWS;
  const q2Rows = Math.min(QUEUE2_MAX_ROWS, Math.max(QUEUE2_MIN_ROWS, Math.ceil(data.queue2.length / QUEUE2_COLS)));
  const q2H = q2Rows * QUEUE2_ROW_GAP + 18;
  const q2Top = CY - q2H / 2;
  const q2Backed = data.queue2.length > QUEUE2_COLS * QUEUE2_MIN_ROWS;
  box(ctx, 540, q2Top, 110, q2H, 'rgba(15,23,42,0.85)', q2Backed ? 'rgba(248,113,113,0.7)' : 'rgba(148,163,184,0.35)');
  label(ctx, 'QUEUE 2', 545, q2Top + q2H + 8, '#94a3b8', 'left');
  label(ctx, `${data.queue2.length} waiting`, 645, q2Top - 8, q2Backed ? '#f87171' : '#94a3b8', 'right');
  if (data.queue2.length > q2Visible) {
    label(ctx, `+${data.queue2.length - q2Visible}`, 645, q2Top + q2H + 8, '#f87171', 'right');
  }

  dashedLine(ctx, 650, CY, 690, CY);
  node(ctx, 672, CY);
  qaYs.forEach((y) => {
    dashedLine(ctx, 690, CY, QA.cx - 11, y);
    dashedLine(ctx, QA.cx + 11, y, 790, CY);
  });
  dashedLine(ctx, 770, CY, DONE.cx - DONE.r, CY);
  node(ctx, 790, CY);

  // Done
  ctx.beginPath();
  ctx.arc(DONE.cx, DONE.cy, DONE.r, 0, Math.PI * 2);
  ctx.save();
  ctx.shadowColor = '#8b5cf6';
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(76, 29, 149, 0.55)';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, 'DONE', DONE.cx, DONE.cy - 10, '#ddd6fe');
  ctx.font = '700 11px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#f5f3ff';
  ctx.textAlign = 'center';
  ctx.fillText(String(data.completed), DONE.cx, DONE.cy + 6);

  drawServers(ctx, data.dev, DEV.cx, DEV_COLOR);
  drawServers(ctx, data.qa, QA.cx, QA_COLOR);

  // Items
  data.queue1.forEach((item, i) => {
    const slot = Math.min(i, QUEUE1_VISIBLE - 1);
    moveToward(item, 316 - slot * 15, 197, k);
    if (i < QUEUE1_VISIBLE) drawItem(ctx, item, now);
  });
  data.dev.forEach((s, i) => {
    if (!s.item) return;
    moveToward(s.item, DEV.cx, devYs[i], k);
    drawItem(ctx, s.item, now, 3.5);
  });
  data.queue2.forEach((item, i) => {
    const slot = Math.min(i, q2Visible - 1);
    const col = slot % QUEUE2_COLS;
    const row = Math.floor(slot / QUEUE2_COLS);
    moveToward(item, 550 + col * 10, q2Top + 9 + QUEUE2_ROW_GAP / 2 + row * QUEUE2_ROW_GAP, k);
    if (i < q2Visible) drawItem(ctx, item, now, 3);
  });
  data.qa.forEach((s, i) => {
    if (!s.item) return;
    moveToward(s.item, QA.cx, qaYs[i], k);
    drawItem(ctx, s.item, now, 3.5);
  });
  data.doneAnim = data.doneAnim.filter((item) => {
    moveToward(item, DONE.cx, DONE.cy, k);
    if (Math.hypot(item.x - DONE.cx, item.y - DONE.cy) < DONE.r - 6) return false;
    drawItem(ctx, item, now, 3.5);
    return true;
  });

  ctx.restore();
}

export function SimCanvas({ dataRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.1);
      last = t;
      render(ctx, w, h, dataRef.current, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [dataRef]);

  return <canvas ref={canvasRef} className="sim-canvas" />;
}
