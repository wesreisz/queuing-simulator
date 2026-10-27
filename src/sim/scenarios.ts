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
  changeFailurePct: 0,
  deployIntervalDays: 0,
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

const NO_FRICTION = { blockingPct: 0, reviewRejectPct: 0, reworkPct: 0, changeFailurePct: 0 };
const CONTINUOUS_DEPLOY = { deployIntervalDays: 0 };

export const SCENARIOS: Scenario[] = [
  {
    id: 'healthy',
    name: 'Healthy Traditional Flow',
    summary: 'Balanced stages with slack capacity. Queues stay short.',
    params: { ...NO_FRICTION, ...CONTINUOUS_DEPLOY, arrivalRate: 1.2, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 0.7, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'product-bottleneck',
    name: 'The Product Bottleneck',
    summary: 'Healthy team, but product pushes slightly more than the system finishes. The product backlog grows without bound.',
    params: { ...NO_FRICTION, ...CONTINUOUS_DEPLOY, arrivalRate: 3.0, devServers: 3, reviewServers: 2, qaServers: 2, devRate: 0.7, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'bottleneck',
    name: 'The QA Bottleneck',
    summary: 'Plenty of developers and reviewers, but too few testers. Work piles up in Ready for QA.',
    params: { ...NO_FRICTION, ...CONTINUOUS_DEPLOY, arrivalRate: 2.5, devServers: 3, reviewServers: 2, qaServers: 1, devRate: 1.2, reviewRate: 2.0, qaRate: 1.5 },
  },
  {
    id: 'agentic',
    name: 'Agentic Development',
    summary: 'Healthy team with code dev at maximum speed. Coding is much faster, but review and QA still set the pace.',
    params: { ...NO_FRICTION, ...CONTINUOUS_DEPLOY, arrivalRate: 1.2, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 4.0, reviewRate: 2.0, qaRate: 2.0 },
  },
  {
    id: 'review-bottleneck',
    name: 'Code Review Bottleneck',
    summary: 'Agents code at full speed and demand rises to 4/day, but review can’t keep up. The PR queue grows without bound.',
    params: { ...NO_FRICTION, ...CONTINUOUS_DEPLOY, arrivalRate: 4.0, devServers: 3, reviewServers: 1, qaServers: 1, devRate: 4.0, reviewRate: 2.0, qaRate: 2.0 },
  },
];
