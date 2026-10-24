import { BRAND } from '../theme';

export const DAYS_PER_SPRINT = 10;
export const HISTORY_SAMPLE_DAYS = 1;
export const HISTORY_LENGTH = 60;

const BLOCK_MEAN_DAYS = 1.5;
const MAX_SUBSTEP_DAYS = 0.05;
const WAITING_THRESHOLD_DAYS = 1;
const MAX_DONE_ANIMATIONS = 200;

export type Stage = 'queue1' | 'dev' | 'queueReview' | 'review' | 'queue2' | 'qa' | 'done';
export type ItemState = 'flowing' | 'waiting' | 'blocked' | 'rework';

export const STATE_COLORS: Record<ItemState, string> = {
  flowing: BRAND.jadeGreen,
  waiting: BRAND.turmericYellow,
  blocked: BRAND.flamingoPink,
  rework: BRAND.sapphireBlue,
};

export interface Item {
  id: number;
  stage: Stage;
  blocked: boolean;
  rework: boolean;
  arrivedAt: number;
  enqueuedAt: number;
  valueAdded: number;
  x: number;
  y: number;
}

export interface Server {
  item: Item | null;
  remaining: number;
  blockedRemaining: number;
}

export interface Params {
  arrivalRate: number;
  devServers: number;
  reviewServers: number;
  qaServers: number;
  devRate: number;
  reviewRate: number;
  qaRate: number;
  blockingPct: number;
  reviewRejectPct: number;
  reworkPct: number;
  devWipLimit: number;
  reviewWipLimit: number;
  qaWipLimit: number;
  speed: number;
}

export interface PressureSample {
  s1: number;
  s2: number;
  s3: number;
}

export interface SimData {
  time: number;
  nextArrival: number;
  nextId: number;
  queue1: Item[];
  queueReview: Item[];
  queue2: Item[];
  dev: Server[];
  review: Server[];
  qa: Server[];
  doneAnim: Item[];
  completed: number;
  totalLead: number;
  totalValueAdded: number;
  history: PressureSample[];
  lastSample: number;
}

export interface Metrics {
  time: number;
  done: number;
  devWip: number;
  reviewWip: number;
  qaWip: number;
  backlog: number;
  flowEfficiency: number;
  maxUtilisation: number;
  bottleneck: 1 | 2 | 3;
  theoreticalLead: number;
  actualLead: number;
  throughputPerSprint: number;
  history: PressureSample[];
}

/** Random duration (in days) from an exponential distribution with the given mean. */
export function randomDuration(meanDays: number): number {
  return -meanDays * Math.log1p(-Math.random());
}

const newServer = (): Server => ({ item: null, remaining: 0, blockedRemaining: 0 });

export function createSim(params: Params): SimData {
  return {
    time: 0,
    nextArrival: params.arrivalRate > 0 ? randomDuration(1 / params.arrivalRate) : Infinity,
    nextId: 1,
    queue1: [],
    queueReview: [],
    queue2: [],
    dev: Array.from({ length: params.devServers }, newServer),
    review: Array.from({ length: params.reviewServers }, newServer),
    qa: Array.from({ length: params.qaServers }, newServer),
    doneAnim: [],
    completed: 0,
    totalLead: 0,
    totalValueAdded: 0,
    history: [],
    lastSample: 0,
  };
}

function syncServers(servers: Server[], count: number, queue: Item[], queueStage: Stage, now: number) {
  while (servers.length < count) servers.push(newServer());
  while (servers.length > count) {
    const s = servers.pop()!;
    if (s.item) {
      s.item.stage = queueStage;
      s.item.blocked = false;
      s.item.enqueuedAt = now;
      queue.unshift(s.item);
    }
  }
}

function enqueue(item: Item, queue: Item[], stage: Stage, now: number) {
  item.stage = stage;
  item.blocked = false;
  item.enqueuedAt = now;
  queue.push(item);
}

function spawn(data: SimData) {
  const item: Item = {
    id: data.nextId++,
    stage: 'queue1',
    blocked: false,
    rework: false,
    arrivedAt: data.time,
    enqueuedAt: data.time,
    valueAdded: 0,
    x: 168,
    y: 200,
  };
  data.queue1.push(item);
}

function substep(data: SimData, params: Params, dt: number) {
  data.time += dt;

  if (params.arrivalRate > 0) {
    if (!Number.isFinite(data.nextArrival)) data.nextArrival = randomDuration(1 / params.arrivalRate);
    data.nextArrival -= dt;
    while (data.nextArrival <= 0) {
      spawn(data);
      data.nextArrival += randomDuration(1 / params.arrivalRate);
    }
  } else {
    data.nextArrival = Infinity;
  }

  for (const s of data.dev) {
    if (s.item) {
      if (s.item.blocked) {
        s.blockedRemaining -= dt;
        if (s.blockedRemaining <= 0) {
          enqueue(s.item, data.queueReview, 'queueReview', data.time);
          s.item = null;
        }
      } else {
        s.remaining -= dt;
        s.item.valueAdded += dt;
        if (s.remaining <= 0) {
          if (Math.random() < params.blockingPct) {
            s.item.blocked = true;
            s.blockedRemaining = randomDuration(BLOCK_MEAN_DAYS);
          } else {
            enqueue(s.item, data.queueReview, 'queueReview', data.time);
            s.item = null;
          }
        }
      }
    }
    if (!s.item && data.queue1.length > 0) {
      const item = data.queue1.shift()!;
      item.stage = 'dev';
      s.item = item;
      s.remaining = randomDuration(1 / params.devRate);
    }
  }

  for (const s of data.review) {
    if (s.item) {
      s.remaining -= dt;
      s.item.valueAdded += dt;
      if (s.remaining <= 0) {
        const item = s.item;
        s.item = null;
        if (Math.random() < params.reviewRejectPct) {
          item.rework = true;
          enqueue(item, data.queue1, 'queue1', data.time);
        } else {
          enqueue(item, data.queue2, 'queue2', data.time);
        }
      }
    }
    if (!s.item && data.queueReview.length > 0) {
      const item = data.queueReview.shift()!;
      item.stage = 'review';
      s.item = item;
      s.remaining = randomDuration(1 / params.reviewRate);
    }
  }

  for (const s of data.qa) {
    if (s.item) {
      s.remaining -= dt;
      s.item.valueAdded += dt;
      if (s.remaining <= 0) {
        const item = s.item;
        s.item = null;
        if (Math.random() < params.reworkPct) {
          item.rework = true;
          enqueue(item, data.queue1, 'queue1', data.time);
        } else {
          item.stage = 'done';
          data.completed++;
          data.totalLead += data.time - item.arrivedAt;
          data.totalValueAdded += item.valueAdded;
          data.doneAnim.push(item);
          if (data.doneAnim.length > MAX_DONE_ANIMATIONS) data.doneAnim.shift();
        }
      }
    }
    if (!s.item && data.queue2.length > 0) {
      const item = data.queue2.shift()!;
      item.stage = 'qa';
      item.rework = false;
      s.item = item;
      s.remaining = randomDuration(1 / params.qaRate);
    }
  }

  if (data.time - data.lastSample >= HISTORY_SAMPLE_DAYS) {
    data.lastSample = data.time;
    data.history.push({
      s1: (devWip(data) / Math.max(1, params.devWipLimit)) * 100,
      s2: (reviewWip(data) / Math.max(1, params.reviewWipLimit)) * 100,
      s3: (qaWip(data) / Math.max(1, params.qaWipLimit)) * 100,
    });
    if (data.history.length > HISTORY_LENGTH) data.history.shift();
  }
}

export function step(data: SimData, params: Params, dt: number) {
  syncServers(data.dev, params.devServers, data.queue1, 'queue1', data.time);
  syncServers(data.review, params.reviewServers, data.queueReview, 'queueReview', data.time);
  syncServers(data.qa, params.qaServers, data.queue2, 'queue2', data.time);
  let remaining = dt;
  while (remaining > 0) {
    const d = Math.min(remaining, MAX_SUBSTEP_DAYS);
    substep(data, params, d);
    remaining -= d;
  }
}

export const devWip = (data: SimData) => data.queue1.length + data.dev.filter((s) => s.item).length;
export const reviewWip = (data: SimData) => data.queueReview.length + data.review.filter((s) => s.item).length;
export const qaWip = (data: SimData) => data.queue2.length + data.qa.filter((s) => s.item).length;

export function itemState(item: Item, now: number): ItemState {
  if (item.blocked) return 'blocked';
  if (item.rework && item.stage === 'queue1') return 'rework';
  if ((item.stage === 'queue1' || item.stage === 'queueReview' || item.stage === 'queue2') && now - item.enqueuedAt > WAITING_THRESHOLD_DAYS) {
    return 'waiting';
  }
  return 'flowing';
}

const factorial = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};

/** Average time in an M/M/c stage (queue wait + service), Infinity when unstable. */
export function mmcTimeInSystem(lambda: number, mu: number, c: number): number {
  if (lambda <= 0) return 1 / mu;
  const rho = lambda / (c * mu);
  if (rho >= 1) return Infinity;
  const a = lambda / mu;
  let sum = 0;
  for (let i = 0; i < c; i++) sum += Math.pow(a, i) / factorial(i);
  const last = (Math.pow(a, c) / factorial(c)) * (1 / (1 - rho));
  const pWait = last / (sum + last);
  const wq = pWait / (c * mu - lambda);
  return wq + 1 / mu;
}

/** Utilization (rho) of Code Dev, Code Review and QA, in that order. */
export function stageUtilisations(params: Params): [number, number, number] {
  const lambdaQa = params.arrivalRate / Math.max(0.01, 1 - params.reworkPct);
  const lambdaDev = lambdaQa / Math.max(0.01, 1 - params.reviewRejectPct);
  const devCapacity = params.devServers * params.devRate;
  const reviewCapacity = params.reviewServers * params.reviewRate;
  // A stage can only receive what the stage before it is able to pass on.
  const lambdaReview = Math.min(lambdaDev, devCapacity);
  const lambdaQaReachable = Math.min(lambdaReview, reviewCapacity) * (1 - params.reviewRejectPct);
  return [
    lambdaDev / devCapacity,
    lambdaReview / reviewCapacity,
    Math.min(lambdaQa, lambdaQaReachable) / (params.qaServers * params.qaRate),
  ];
}

export function computeMetrics(data: SimData, params: Params): Metrics {
  const lambdaQa = params.arrivalRate / Math.max(0.01, 1 - params.reworkPct);
  const lambdaDev = lambdaQa / Math.max(0.01, 1 - params.reviewRejectPct);
  const mu1 = params.devRate;
  const mu2 = params.reviewRate;
  const mu3 = params.qaRate;
  const rhos = stageUtilisations(params);
  const maxRho = Math.max(...rhos);

  const sprints = data.time / DAYS_PER_SPRINT;
  const throughputPerSprint = sprints > 0 ? data.completed / sprints : 0;
  return {
    time: data.time,
    done: data.completed,
    devWip: devWip(data),
    reviewWip: reviewWip(data),
    qaWip: qaWip(data),
    backlog: data.queue1.length,
    flowEfficiency: data.totalLead > 0 ? (data.totalValueAdded / data.totalLead) * 100 : 0,
    maxUtilisation: maxRho * 100,
    bottleneck: (rhos.indexOf(maxRho) + 1) as 1 | 2 | 3,
    theoreticalLead:
      mmcTimeInSystem(lambdaDev, mu1, params.devServers) +
      mmcTimeInSystem(lambdaDev, mu2, params.reviewServers) +
      mmcTimeInSystem(lambdaQa, mu3, params.qaServers),
    actualLead: data.completed > 0 ? data.totalLead / data.completed : 0,
    throughputPerSprint,
    history: data.history.slice(),
  };
}
