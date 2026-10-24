import { useCallback, useEffect, useRef, useState } from 'react';
import { computeMetrics, createSim, step, type Metrics, type Params, type SimData } from './engine';

const UI_UPDATE_MS = 100;

export function useSimulation(params: Params) {
  const paramsRef = useRef(params);
  const dataRef = useRef<SimData>(createSim(params));
  const runningRef = useRef(true);
  const [running, setRunningState] = useState(true);
  const [metrics, setMetrics] = useState<Metrics>(() => computeMetrics(createSim(params), params));

  useEffect(() => {
    paramsRef.current = params;
  }, [params]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastUi = 0;
    const loop = (now: number) => {
      const dtReal = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (runningRef.current) step(dataRef.current, paramsRef.current, dtReal * paramsRef.current.speed);
      if (now - lastUi > UI_UPDATE_MS) {
        lastUi = now;
        setMetrics(computeMetrics(dataRef.current, paramsRef.current));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const setRunning = useCallback((value: boolean) => {
    runningRef.current = value;
    setRunningState(value);
  }, []);

  const reset = useCallback((next?: Params) => {
    dataRef.current = createSim(next ?? paramsRef.current);
  }, []);

  return { dataRef, paramsRef, metrics, running, setRunning, reset };
}
