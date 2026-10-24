export const DAYS_PER_SPRINT = 10;
export const HISTORY_SAMPLE_DAYS = 1;
export const HISTORY_LENGTH = 60;

const BLOCK_MEAN_DAYS = 1.5;
const MAX_SUBSTEP_DAYS = 0.05;
const WAITING_THRESHOLD_DAYS = 1;
const MAX_DONE_ANIMATIONS = 200;

export type Stage = 'queue1' | 'dev' | 'queue2' | 'qa' | 'done';
export type ItemState = 'flowing' | 'waiting' | 'blocked' | 'rework';

export const STATE_COLORS: Record<ItemState, string> = {
  flowing: '#22c55e',
  waiting: '#eab308',
  blocked: '#ef4444',
  rework: '#3b82f6',
};

export interface Item {
  id: number;
  stage: Stage;
  blocked: boolean;
  rework: boolean;
  whale: boolean;
  size: number;
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
  qaServers: number;
  devRate: number;
  qaRate: number;
  blockingPct: number;
  reworkPct: number;
  whaleMode: boolean;
  whaleProb: number;
  whaleMultiplier: number;
  devWipLimit: number;
  qaWipLimit: number;
  speed: number;
}

export interface PressureSample {
  s1: number;
  s2: number;
}

export interface SimData {
  time: number;
  nextArrival: number;
  nextId: number;
  queue1: Item[];
  queue2: Item[];
  dev: Server[];
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
  qaWip: number;
  backlog: number;
  flowEfficiency: number;
  maxUtilisation: number;
  bottleneck: 1 | 2;
  theoreticalLead: number;
  actualLead: number;
  throughputPerSprint: number;
  history: PressureSample[];
}

export const getExponential = (rate: number) => -Math.log(1 - Math.random()) / rate;

const newServer = (): Server => ({ item: null, remaining: 0, blockedRemaining: 0 });

export function createSim(params: Params): SimData {
  return {
    time: 0,
    nextArrival: params.arrivalRate > 0 ? getExponential(params.arrivalRate) : Infinity,
    nextId: 1,
    queue1: [],
    queue2: [],
    dev: Array.from({ length: params.devServers }, newServer),
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

function spawn(data: SimData, params: Params) {
  const whale = params.whaleMode && Math.random() < params.whaleProb;
  const item: Item = {
    id: data.nextId++,
    stage: 'queue1',
    blocked: false,
    rework: false,
    whale,
    size: whale ? params.whaleMultiplier : 1,
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
    if (!Number.isFinite(data.nextArrival)) data.nextArrival = getExponential(params.arrivalRate);
    data.nextArrival -= dt;
    while (data.nextArrival <= 0) {
      spawn(data, params);
      data.nextArrival += getExponential(params.arrivalRate);
    }
  } else {
    data.nextArrival = Infinity;
  }

  for (const s of data.dev) {
    if (s.item) {
      if (s.item.blocked) {
        s.blockedRemaining -= dt;
        if (s.blockedRemaining <= 0) {
          enqueue(s.item, data.queue2, 'queue2', data.time);
          s.item = null;
        }
      } else {
        s.remaining -= dt;
        s.item.valueAdded += dt;
        if (s.remaining <= 0) {
          if (Math.random() < params.blockingPct) {
            s.item.blocked = true;
            s.blockedRemaining = getExponential(1 / BLOCK_MEAN_DAYS);
          } else {
            enqueue(s.item, data.queue2, 'queue2', data.time);
            s.item = null;
          }
        }
      }
    }
    if (!s.item && data.queue1.length > 0) {
      const item = data.queue1.shift()!;
      item.stage = 'dev';
      s.item = item;
      s.remaining = getExponential(params.devRate) * item.size;
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
      s.remaining = getExponential(params.qaRate) * item.size;
    }
  }

  if (data.time - data.lastSample >= HISTORY_SAMPLE_DAYS) {
    data.lastSample = data.time;
    data.history.push({
      s1: (devWip(data) / Math.max(1, params.devWipLimit)) * 100,
      s2: (qaWip(data) / Math.max(1, params.qaWipLimit)) * 100,
    });
    if (data.history.length > HISTORY_LENGTH) data.history.shift();
  }
}

export function step(data: SimData, params: Params, dt: number) {
  syncServers(data.dev, params.devServers, data.queue1, 'queue1', data.time);
  syncServers(data.qa, params.qaServers, data.queue2, 'queue2', data.time);
  let remaining = dt;
  while (remaining > 0) {
    const d = Math.min(remaining, MAX_SUBSTEP_DAYS);
    substep(data, params, d);
    remaining -= d;
  }
}

export const devWip = (data: SimData) => data.queue1.length + data.dev.filter((s) => s.item).length;
export const qaWip = (data: SimData) => data.queue2.length + data.qa.filter((s) => s.item).length;

export function itemState(item: Item, now: number): ItemState {
  if (item.blocked) return 'blocked';
  if (item.rework && item.stage === 'queue1') return 'rework';
  if ((item.stage === 'queue1' || item.stage === 'queue2') && now - item.enqueuedAt > WAITING_THRESHOLD_DAYS) {
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

export function computeMetrics(data: SimData, params: Params): Metrics {
  const meanSize = params.whaleMode ? 1 + params.whaleProb * (params.whaleMultiplier - 1) : 1;
  const lambdaEff = params.arrivalRate / Math.max(0.01, 1 - params.reworkPct);
  const mu1 = params.devRate / meanSize;
  const mu2 = params.qaRate / meanSize;
  const rho1 = lambdaEff / (params.devServers * mu1);
  const rho2 = lambdaEff / (params.qaServers * mu2);

  const sprints = data.time / DAYS_PER_SPRINT;
  const throughputPerSprint = sprints > 0 ? data.completed / sprints : 0;
  return {
    time: data.time,
    done: data.completed,
    devWip: devWip(data),
    qaWip: qaWip(data),
    backlog: data.queue1.length,
    flowEfficiency: data.totalLead > 0 ? (data.totalValueAdded / data.totalLead) * 100 : 0,
    maxUtilisation: Math.max(rho1, rho2) * 100,
    bottleneck: rho2 >= rho1 ? 2 : 1,
    theoreticalLead: mmcTimeInSystem(lambdaEff, mu1, params.devServers) + mmcTimeInSystem(lambdaEff, mu2, params.qaServers),
    actualLead: data.completed > 0 ? data.totalLead / data.completed : 0,
    throughputPerSprint,
    history: data.history.slice(),
  };
}
