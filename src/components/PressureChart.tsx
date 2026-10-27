import { useEffect, useRef } from 'react';
import { DAYS_PER_SPRINT, HISTORY_LENGTH, HISTORY_SAMPLE_DAYS, type PressureSample } from '../sim/engine';
import { BRAND, STAGE_COLORS, UI } from '../theme';

const MAX_PCT = 200;
const OPTIMAL_PCT = 80;
const PAD = { left: 40, right: 48, top: 10, bottom: 34 };
const MIN_TICK_PX = 26;
const TICK_STEPS = [2, 5, 10, 20, 30];

interface Props {
  history: PressureSample[];
}

function drawChart(canvas: HTMLCanvasElement | null, w: number, h: number, data: PressureSample[]) {
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);

  const plotW = w - PAD.left - PAD.right;
  const plotH = h - PAD.top - PAD.bottom;
  const yOf = (pct: number) => PAD.top + plotH * (1 - Math.min(pct, MAX_PCT) / MAX_PCT);
  const xOf = (i: number) => PAD.left + (plotW * i) / (HISTORY_LENGTH - 1);

  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  for (let pct = 0; pct <= MAX_PCT; pct += 50) {
    const y = Math.round(yOf(pct)) + 0.5;
    ctx.strokeStyle = 'rgba(237,241,243,0.1)';
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.fillStyle = UI.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, PAD.left - 6, y);
  }

  const refLine = (pct: number, color: string, text: string) => {
    const y = yOf(pct);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(PAD.left, y);
    ctx.lineTo(PAD.left + plotW, y);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.font = '600 9px Inter, system-ui, sans-serif';
    ctx.fillText(text, PAD.left + plotW + 4, y);
  };
  refLine(100, BRAND.flamingoPink, 'Limit');
  refLine(OPTIMAL_PCT, BRAND.mistGrey, 'Target');

  // Newest sample is pinned to the right edge.
  const offset = HISTORY_LENGTH - data.length;
  const series = (key: keyof PressureSample, color: string) => {
    if (data.length < 2) return;
    ctx.beginPath();
    data.forEach((s, i) => {
      const x = xOf(offset + i);
      const y = yOf(s[key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(xOf(offset + data.length - 1), yOf(0));
    ctx.lineTo(xOf(offset), yOf(0));
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, PAD.top, 0, PAD.top + plotH);
    grad.addColorStop(0, `${color}55`);
    grad.addColorStop(1, `${color}05`);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1;
  };
  series('s3', STAGE_COLORS.qa);
  series('s2', STAGE_COLORS.review);
  series('s1', STAGE_COLORS.dev);

  ctx.fillStyle = UI.muted;
  ctx.font = '9px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  const samplePx = plotW / (HISTORY_LENGTH - 1);
  const tickStep = TICK_STEPS.find((s) => s * samplePx >= MIN_TICK_PX) ?? TICK_STEPS[TICK_STEPS.length - 1];
  for (let i = HISTORY_LENGTH - 1; i >= 0; i -= tickStep) {
    const ago = ((HISTORY_LENGTH - 1 - i) * HISTORY_SAMPLE_DAYS) / DAYS_PER_SPRINT;
    ctx.fillText(ago.toFixed(1), xOf(i), PAD.top + plotH + 10);
  }
  ctx.font = '10px Inter, system-ui, sans-serif';
  ctx.fillText('Sprints ago', PAD.left + plotW / 2, h - 8);
}

export function PressureChart({ history }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const historyRef = useRef(history);

  useEffect(() => {
    historyRef.current = history;
    drawChart(canvasRef.current, sizeRef.current.w, sizeRef.current.h, history);
  }, [history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.getContext('2d')?.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawChart(canvas, rect.width, rect.height, historyRef.current);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={canvasRef} className="pressure-canvas" />;
}
