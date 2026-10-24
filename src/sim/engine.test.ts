import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeMetrics, createSim, mmcTimeInSystem, stageUtilisations, step, type Params, type SimData } from './engine';
import { DEFAULT_PARAMS, SCENARIOS } from './scenarios';

const withParams = (overrides: Partial<Params>): Params => ({ ...DEFAULT_PARAMS, ...overrides });

const scenario = (id: string): Params => {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario ${id}`);
  return withParams(s.params);
};

const metricsFor = (params: Params) => computeMetrics(createSim(params), params);

/** Replaces Math.random with a deterministic generator (mulberry32) so simulation runs are repeatable. */
function seedRandom(seed: number) {
  let a = seed;
  vi.spyOn(Math, 'random').mockImplementation(() => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

function run(params: Params, days: number): SimData {
  const data = createSim(params);
  for (let t = 0; t < days; t += 0.05) step(data, params, 0.05);
  return data;
}

const queueInFront = (data: SimData, stage: 1 | 2 | 3) => [data.queue1, data.queueReview, data.queue2][stage - 1].length;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('mmcTimeInSystem', () => {
  it('matches the M/M/1 formula 1 / (mu - lambda)', () => {
    expect(mmcTimeInSystem(1, 2, 1)).toBeCloseTo(1);
    expect(mmcTimeInSystem(1.5, 2, 1)).toBeCloseTo(2);
  });

  it('matches a hand-calculated M/M/2 value', () => {
    // lambda = 1, mu = 1, c = 2: P(wait) = 1/3, Wq = 1/3, W = Wq + 1/mu = 4/3
    expect(mmcTimeInSystem(1, 1, 2)).toBeCloseTo(4 / 3);
  });

  it('returns the service time alone when nothing arrives', () => {
    expect(mmcTimeInSystem(0, 4, 3)).toBeCloseTo(0.25);
  });

  it('returns Infinity when the stage is at or over capacity', () => {
    expect(mmcTimeInSystem(2, 2, 1)).toBe(Infinity);
    expect(mmcTimeInSystem(5, 1, 3)).toBe(Infinity);
  });
});

describe('stageUtilisations', () => {
  it('is arrivals divided by capacity when no stage is overloaded', () => {
    const [dev, review, qa] = stageUtilisations(scenario('healthy'));
    expect(dev).toBeCloseTo(1.2 / 2.1);
    expect(review).toBeCloseTo(0.6);
    expect(qa).toBeCloseTo(0.6);
  });

  it('caps QA at what an overloaded review stage can pass on', () => {
    const [dev, review, qa] = stageUtilisations(scenario('review-bottleneck'));
    expect(dev).toBeCloseTo(4 / 12);
    expect(review).toBeCloseTo(2);
    expect(qa).toBeCloseTo(1);
  });

  it('caps review and QA at what an overloaded code dev stage can pass on', () => {
    const [dev, review, qa] = stageUtilisations(scenario('product-bottleneck'));
    expect(dev).toBeCloseTo(3 / 2.1);
    expect(review).toBeCloseTo(2.1 / 4);
    expect(qa).toBeCloseTo(2.1 / 4);
  });

  it('adds QA rework load to every stage', () => {
    const base = { arrivalRate: 1, devServers: 1, reviewServers: 1, qaServers: 1, devRate: 10, reviewRate: 10, qaRate: 10 };
    expect(stageUtilisations(withParams({ ...base, reworkPct: 0 }))).toEqual([0.1, 0.1, 0.1]);
    const [dev, review, qa] = stageUtilisations(withParams({ ...base, reworkPct: 0.5 }));
    expect(dev).toBeCloseTo(0.2);
    expect(review).toBeCloseTo(0.2);
    expect(qa).toBeCloseTo(0.2);
  });

  it('adds review rejection load to code dev and review but not QA', () => {
    const base = { arrivalRate: 1, devServers: 1, reviewServers: 1, qaServers: 1, devRate: 10, reviewRate: 10, qaRate: 10 };
    const [dev, review, qa] = stageUtilisations(withParams({ ...base, reviewRejectPct: 0.5 }));
    expect(dev).toBeCloseTo(0.2);
    expect(review).toBeCloseTo(0.2);
    expect(qa).toBeCloseTo(0.1);
  });
});

describe('computeMetrics bottleneck', () => {
  it.each([
    ['healthy', 2, 60],
    ['product-bottleneck', 1, (3 / 2.1) * 100],
    ['bottleneck', 3, (2.5 / 1.5) * 100],
    ['agentic', 2, 60],
    ['review-bottleneck', 2, 200],
  ] as const)('scenario %s reports Stage %i at %f%% utilization', (id, stage, utilisation) => {
    const metrics = metricsFor(scenario(id));
    expect(metrics.bottleneck).toBe(stage);
    expect(metrics.maxUtilisation).toBeCloseTo(utilisation);
  });

  it('does not blame a downstream stage that only matches an overloaded upstream stage', () => {
    const params = withParams({ arrivalRate: 4, devServers: 3, devRate: 4, reviewServers: 1, reviewRate: 2, qaServers: 1, qaRate: 2 });
    expect(metricsFor(params).bottleneck).toBe(2);
  });

  it('blames the upstream stage even when a downstream stage has slightly less capacity', () => {
    // Review gets 4/day against 2/day of capacity; QA only ever receives 2/day against 1.9/day.
    // Without upstream capping, QA would look worse (4 / 1.9 = 210%) than review (200%).
    const params = withParams({ arrivalRate: 4, devServers: 3, devRate: 4, reviewServers: 1, reviewRate: 2, qaServers: 1, qaRate: 1.9 });
    const metrics = metricsFor(params);
    expect(metrics.bottleneck).toBe(2);
    expect(metrics.maxUtilisation).toBeCloseTo(200);
  });

  it('breaks exact ties toward the earlier stage', () => {
    const params = withParams({ arrivalRate: 1, devServers: 1, devRate: 2, reviewServers: 1, reviewRate: 2, qaServers: 1, qaRate: 2 });
    expect(metricsFor(params).bottleneck).toBe(1);
  });

  it('reports infinite theoretical lead time when any stage is overloaded', () => {
    expect(metricsFor(scenario('review-bottleneck')).theoreticalLead).toBe(Infinity);
    expect(Number.isFinite(metricsFor(scenario('healthy')).theoreticalLead)).toBe(true);
  });
});

describe('simulation agrees with the reported bottleneck', () => {
  it.each(['product-bottleneck', 'bottleneck', 'review-bottleneck'])(
    'scenario %s grows the queue in front of the reported bottleneck the most',
    (id) => {
      seedRandom(42);
      const params = scenario(id);
      const data = run(params, 150);
      const { bottleneck } = computeMetrics(data, params);
      const queues = [1, 2, 3].map((s) => queueInFront(data, s as 1 | 2 | 3));
      expect(queueInFront(data, bottleneck)).toBe(Math.max(...queues));
      expect(queueInFront(data, bottleneck)).toBeGreaterThan(50);
    },
  );

  it.each(['healthy', 'agentic'])('scenario %s keeps every queue short', (id) => {
    seedRandom(42);
    const data = run(scenario(id), 150);
    expect(data.queue1.length).toBeLessThan(15);
    expect(data.queueReview.length).toBeLessThan(15);
    expect(data.queue2.length).toBeLessThan(15);
    expect(data.completed).toBeGreaterThan(100);
  });
});

describe('rework routing', () => {
  it('sends rejected reviews back to the backlog as rework', () => {
    seedRandom(7);
    const data = run(withParams({ reviewRejectPct: 1 }), 30);
    expect(data.completed).toBe(0);
    expect(data.queue2.length + data.qa.filter((s) => s.item).length).toBe(0);
    expect(data.queue1.some((item) => item.rework)).toBe(true);
  });

  it('sends QA failures back to the backlog as rework', () => {
    seedRandom(7);
    const data = run(withParams({ reworkPct: 1 }), 30);
    expect(data.completed).toBe(0);
    expect(data.queue1.some((item) => item.rework)).toBe(true);
  });
});
