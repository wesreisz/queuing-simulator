import type { Params } from './engine';

export const DEFAULT_PARAMS: Params = {
  arrivalRate: 2.5,
  devServers: 3,
  qaServers: 1,
  devRate: 1.2,
  qaRate: 1.5,
  blockingPct: 0,
  reworkPct: 0,
  whaleMode: false,
  whaleProb: 0.25,
  whaleMultiplier: 5,
  devWipLimit: 15,
  qaWipLimit: 8,
  devCost: 9600,
  qaCost: 9600,
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
    id: 'bottleneck',
    name: 'The Bottleneck',
    summary: 'High Dev capacity vs. low QA capacity. The QA queue grows without bound.',
    params: { ...NO_FRICTION, arrivalRate: 2.5, devServers: 3, qaServers: 1, devRate: 1.2, qaRate: 1.5 },
  },
  {
    id: 'integration-hell',
    name: 'Integration Hell',
    summary: 'Moderate arrivals, high blocking & rework. Busy servers, terrible flow.',
    params: {
      arrivalRate: 1.2,
      devServers: 3,
      qaServers: 2,
      devRate: 1.2,
      qaRate: 1.2,
      blockingPct: 0.35,
      reworkPct: 0.3,
      whaleMode: false,
    },
  },
  {
    id: 'utilisation-trap',
    name: 'The Utilisation Trap',
    summary: 'Arrival rate ≈ 98% of capacity with zero friction. Queue times explode.',
    params: { ...NO_FRICTION, arrivalRate: 2.35, devServers: 2, qaServers: 2, devRate: 1.2, qaRate: 1.2 },
  },
  {
    id: 'whale',
    name: 'Whale Variability',
    summary: 'Low arrivals, 25% chance of 5x larger tasks blocking the guppies.',
    params: {
      arrivalRate: 0.8,
      devServers: 3,
      qaServers: 2,
      devRate: 1.2,
      qaRate: 1.2,
      blockingPct: 0,
      reworkPct: 0,
      whaleMode: true,
      whaleProb: 0.25,
    },
  },
  {
    id: 'healthy',
    name: 'Healthy Flow',
    summary: 'Balanced stages with slack capacity. Queues stay short.',
    params: { ...NO_FRICTION, arrivalRate: 1.5, devServers: 2, qaServers: 2, devRate: 1.2, qaRate: 1.2 },
  },
];
