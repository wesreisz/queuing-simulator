import type { Params } from './engine';

export const DEFAULT_PARAMS: Params = {
  arrivalRate: 1.2,
  devServers: 3,
  reviewServers: 1,
  qaServers: 1,
  devRate: 0.7,
  reviewRate: 2.0,
  qaRate: 2.0,
  blockingPct: 0,
  reviewRejectPct: 0,
  reworkPct: 0,
  whaleMode: false,
  whaleProb: 0.25,
  whaleMultiplier: 5,
  devWipLimit: 15,
  reviewWipLimit: 8,
  qaWipLimit: 8,
  speed: 2,
};

export interface Scenario {
  id: string;
  name: string;
  summary: string;
  params: Partial<Params>;
}

const NO_FRICTION = { blockingPct: 0, reviewRejectPct: 0, reworkPct: 0, whaleMode: false };

export const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    name: 'Healthy Traditional Flow',
    summary: 'Balanced stages with slack capacity. Queues stay short.',
    params: { ...NO_FRICTION, arrivalRate: 1.2, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 0.7, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'product-bottleneck',
    name: 'The Product Bottleneck',
    summary: 'Healthy team, but product pushes slightly more than the system finishes. The product backlog grows without bound.',
    params: { ...NO_FRICTION, arrivalRate: 3.0, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 0.7, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'bottleneck',
    name: 'The QA Bottleneck',
    summary: 'High Dev capacity vs. low QA capacity. The QA queue grows without bound.',
    params: { ...NO_FRICTION, arrivalRate: 2.5, devServers: 3, reviewServers: 2, qaServers: 1, devRate: 1.2, reviewRate: 2.0, qaRate: 1.5 },
  },
  {
    id: 'agentic',
    name: 'Agentic Development',
    summary: 'Healthy team with code dev at maximum speed. Coding is much faster, but review and QA still set the pace.',
    params: { ...NO_FRICTION, arrivalRate: 1.2, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 4.0, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'review-bottleneck',
    name: 'Code Review Bottleneck',
    summary: 'Fast code dev and QA, but reviewers can’t keep up. The review queue grows without bound.',
    params: { ...NO_FRICTION, arrivalRate: 5.0, devServers: 2, reviewServers: 3, qaServers: 2, devRate: 4.0, reviewRate: 1.5, qaRate: 4.0 },
  },
];
