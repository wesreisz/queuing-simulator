import type { Params } from './engine';

export const DEFAULT_PARAMS: Params = {
  arrivalRate: 1.2,
  devServers: 3,
  qaServers: 1,
  devRate: 0.7,
  qaRate: 2.0,
  blockingPct: 0,
  reworkPct: 0,
  whaleMode: false,
  whaleProb: 0.25,
  whaleMultiplier: 5,
  devWipLimit: 15,
  qaWipLimit: 8,
  speed: 2,
};

export interface Scenario {
  id: string;
  name: string;
  summary: string;
  params: Partial<Params>;
}

const NO_FRICTION = { blockingPct: 0, reworkPct: 0, whaleMode: false };

export const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    name: 'Healthy Flow',
    summary: 'Balanced stages with slack capacity. Queues stay short.',
    params: { ...NO_FRICTION, arrivalRate: 1.2, devServers: 3, qaServers: 1, devRate: 0.7, qaRate: 2.0 },
  },
  {
    id: 'bottleneck',
    name: 'The Bottleneck',
    summary: 'High Dev capacity vs. low QA capacity. The QA queue grows without bound.',
    params: { ...NO_FRICTION, arrivalRate: 2.5, devServers: 3, qaServers: 1, devRate: 1.2, qaRate: 1.5 },
  },
];
