import { useEffect, useRef, type RefObject } from 'react';
import { itemState, STATE_COLORS, type Item, type Server, type SimData } from '../sim/engine';
import { BRAND, STAGE_COLORS, UI } from '../theme';

const VIEW_W = 1200;
const VIEW_H = 400;
const CY = 200;

const BACKLOG_ALERT = 50;
const QUEUE_W = 110;
const QUEUE_COLS = 10;
const QUEUE_MIN_ROWS = 3;
const QUEUE_MAX_ROWS = 20;
const QUEUE_ROW_GAP = 8;
const QUEUE_ALERT = QUEUE_COLS * QUEUE_MIN_ROWS;

const DEV = { x: 395, y: 50, w: 100, h: 300, cx: 445 };
const REVIEW = { x: 680, y: 50, w: 100, h: 300, cx: 730 };
const QA = { x: 950, y: 50, w: 100, h: 300, cx: 1000 };
const DONE = { cx: 1120, cy: CY, r: 38 };

const DEV_COLOR = STAGE_COLORS.dev;
const REVIEW_COLOR = STAGE_COLORS.review;
const QA_COLOR = STAGE_COLORS.qa;
const LABEL_FONT = '600 16px "JetBrains Mono", ui-monospace, monospace';

interface Props {
  dataRef: RefObject<SimData>;
}

function serverYs(count: number): number[] {
  const gap = Math.min(64, 240 / Math.max(1, count));
  return Array.from({ length: count }, (_, i) => CY + (i - (count - 1) / 2) * gap);
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = 'rgba(237, 241, 243, 0.05)';
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
  ctx.strokeStyle = 'rgba(237, 241, 243, 0.35)';
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
  ctx.fillStyle = UI.panelDeep;
  ctx.fill();
  ctx.strokeStyle = BRAND.sapphireBlue;
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
  label(ctx, title, s.x + s.w / 2, s.y + s.h + 22, UI.text);
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
      ctx.shadowColor = blocked ? BRAND.flamingoPink : color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = blocked ? '#6B2533' : color;
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = blocked ? BRAND.flamingoPink : BRAND.talcWhite;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (s.item.whale) label(ctx, 'W', cx + 20, y - 14, BRAND.turmericYellow);
    } else {
      ctx.fillStyle = UI.panelDeep;
      ctx.fill();
      ctx.strokeStyle = `${color}cc`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.font = '600 18px Inter, system-ui, sans-serif';
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

function drawGridQueue(
  ctx: CanvasRenderingContext2D,
  items: Item[],
  x: number,
  title: string,
  alertAt: number,
  now: number,
  k: number,
  fillFromRight: boolean,
) {
  const visible = QUEUE_COLS * QUEUE_MAX_ROWS;
  const rows = Math.min(QUEUE_MAX_ROWS, Math.max(QUEUE_MIN_ROWS, Math.ceil(items.length / QUEUE_COLS)));
  const h = rows * QUEUE_ROW_GAP + 18;
  const top = CY - h / 2;
  const backed = items.length > alertAt;
  box(ctx, x, top, QUEUE_W, h, 'rgba(0, 39, 51, 0.85)', backed ? 'rgba(242, 97, 122, 0.8)' : 'rgba(237, 241, 243, 0.3)');
  label(ctx, title, x + QUEUE_W / 2, top + h + 12, UI.muted);
  label(ctx, `${items.length} waiting`, x + QUEUE_W / 2, top - 12, backed ? BRAND.flamingoPink : UI.muted);
  if (items.length > visible) {
    label(ctx, `+${items.length - visible}`, x + QUEUE_W / 2, top + h + 30, BRAND.flamingoPink);
  }
  items.forEach((item, i) => {
    const slot = Math.min(i, visible - 1);
    const col = slot % QUEUE_COLS;
    const row = Math.floor(slot / QUEUE_COLS);
    const ix = fillFromRight ? x + QUEUE_W - 10 - col * 10 : x + 10 + col * 10;
    moveToward(item, ix, top + 9 + QUEUE_ROW_GAP / 2 + row * QUEUE_ROW_GAP, k);
    if (i < visible) drawItem(ctx, item, now, 3);
  });
}

function fanAround(ctx: CanvasRenderingContext2D, ys: number[], inX: number, cx: number, outX: number) {
  ys.forEach((y) => {
    dashedLine(ctx, inX, CY, cx - 11, y);
    dashedLine(ctx, cx + 11, y, outX, CY);
  });
}

function drawServerItems(ctx: CanvasRenderingContext2D, servers: Server[], ys: number[], cx: number, now: number, k: number) {
  servers.forEach((s, i) => {
    if (!s.item) return;
    moveToward(s.item, cx, ys[i], k);
    drawItem(ctx, s.item, now, 3.5);
  });
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
  const reviewYs = serverYs(data.review.length);
  const qaYs = serverYs(data.qa.length);

  stageColumn(ctx, DEV, DEV_COLOR, 'STAGE 1: CODE DEV');
  stageColumn(ctx, REVIEW, REVIEW_COLOR, 'STAGE 2: CODE REVIEW');
  stageColumn(ctx, QA, QA_COLOR, 'STAGE 3: QA');

  // Backlog -> Code Dev -> Review Queue
  dashedLine(ctx, 326, CY, 370, CY);
  fanAround(ctx, devYs, 370, DEV.cx, 520);
  node(ctx, 370, CY);
  dashedLine(ctx, 520, CY, 540, CY);

  // Review Queue -> Code Review -> QA Queue
  dashedLine(ctx, 650, CY, 672, CY);
  fanAround(ctx, reviewYs, 672, REVIEW.cx, 790);
  node(ctx, 672, CY);
  dashedLine(ctx, 790, CY, 810, CY);
  node(ctx, 790, CY);

  // QA Queue -> QA -> Done
  dashedLine(ctx, 920, CY, 942, CY);
  fanAround(ctx, qaYs, 942, QA.cx, 1060);
  node(ctx, 942, CY);
  dashedLine(ctx, 1060, CY, DONE.cx - DONE.r, CY);
  node(ctx, 1060, CY);

  // Done
  ctx.beginPath();
  ctx.arc(DONE.cx, DONE.cy, DONE.r, 0, Math.PI * 2);
  ctx.save();
  ctx.shadowColor = BRAND.amethystPurple;
  ctx.shadowBlur = 18;
  ctx.fillStyle = 'rgba(99, 79, 125, 0.75)';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = UI.amethystLight;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  label(ctx, 'DONE', DONE.cx, DONE.cy - 12, UI.text);
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.fillStyle = BRAND.talcWhite;
  ctx.textAlign = 'center';
  ctx.fillText(String(data.completed), DONE.cx, DONE.cy + 10);

  drawServers(ctx, data.dev, DEV.cx, DEV_COLOR);
  drawServers(ctx, data.review, REVIEW.cx, REVIEW_COLOR);
  drawServers(ctx, data.qa, QA.cx, QA_COLOR);

  // Queues and items
  drawGridQueue(ctx, data.queue1, 216, 'BACKLOG', BACKLOG_ALERT, now, k, true);
  drawServerItems(ctx, data.dev, devYs, DEV.cx, now, k);
  drawGridQueue(ctx, data.queueReview, 540, 'PRs', QUEUE_ALERT, now, k, false);
  drawServerItems(ctx, data.review, reviewYs, REVIEW.cx, now, k);
  drawGridQueue(ctx, data.queue2, 810, 'Ready for QA', QUEUE_ALERT, now, k, false);
  drawServerItems(ctx, data.qa, qaYs, QA.cx, now, k);
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
