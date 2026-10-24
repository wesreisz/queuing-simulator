import { useState, type ReactNode } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Layers,
  ShieldAlert,
  Users,
  Waves,
  Timer,
} from 'lucide-react';
import { DAYS_PER_SPRINT, type Metrics, type Params } from '../sim/engine';
import { SCENARIOS } from '../sim/scenarios';

interface SidebarProps {
  params: Params;
  metrics: Metrics;
  activeScenario: string | null;
  resetOnScenario: boolean;
  onChange: (patch: Partial<Params>) => void;
  onScenario: (id: string) => void;
  onResetOnScenarioChange: (value: boolean) => void;
}

function Section({
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="section">
      <button className="section-header" onClick={() => setOpen(!open)}>
        <span className="section-title">
          {icon}
          {title}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span className="slider-row">
        <span>{label}</span>
        <span className="slider-value">{format ? format(value) : value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

function Card({ label, icon, value, sub, tone }: { label: string; icon?: ReactNode; value: ReactNode; sub: string; tone?: string }) {
  return (
    <div className="card">
      <div className="card-label">
        <span>{label}</span>
        {icon}
      </div>
      <div className={`card-value ${tone ?? ''}`}>{value}</div>
      <div className="card-sub">{sub}</div>
    </div>
  );
}

export function Sidebar({
  params,
  metrics,
  activeScenario,
  resetOnScenario,
  onChange,
  onScenario,
  onResetOnScenarioChange,
}: SidebarProps) {
  const flowTone = metrics.flowEfficiency < 15 ? 'tone-red' : metrics.flowEfficiency < 40 ? 'tone-amber' : 'tone-green';
  const utilTone = metrics.maxUtilisation >= 100 ? 'tone-red' : metrics.maxUtilisation >= 85 ? 'tone-amber' : 'tone-green';
  const leadDays = metrics.theoreticalLead;

  return (
    <aside className="sidebar">
      <Section title="Metrics" icon={<Gauge size={12} />} defaultOpen>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-label">Done</div>
            <div className="stat-value tone-purple">{metrics.done}</div>
          </div>
          <div className="stat">
            <div className="stat-label">Dev WIP</div>
            <div className={`stat-value ${metrics.devWip > params.devWipLimit ? 'tone-red' : 'tone-blue'}`}>
              {metrics.devWip} <span className="stat-limit">/ {params.devWipLimit}</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">Review WIP</div>
            <div className={`stat-value ${metrics.reviewWip > params.reviewWipLimit ? 'tone-red' : 'tone-amber'}`}>
              {metrics.reviewWip} <span className="stat-limit">/ {params.reviewWipLimit}</span>
            </div>
          </div>
          <div className="stat">
            <div className="stat-label">QA WIP</div>
            <div className={`stat-value ${metrics.qaWip > params.qaWipLimit ? 'tone-red' : 'tone-green'}`}>
              {metrics.qaWip} <span className="stat-limit">/ {params.qaWipLimit}</span>
            </div>
          </div>
        </div>
        <div className="card-grid">
          <Card
            label="Flow Efficiency"
            icon={<Timer size={12} className="tone-red" />}
            value={`${metrics.flowEfficiency.toFixed(1)}%`}
            sub="Value Added / Lead Time"
            tone={flowTone}
          />
          <Card
            label="Max Utilization"
            icon={<Activity size={12} className="tone-red" />}
            value={metrics.maxUtilisation >= 100 ? '> 100%' : `${metrics.maxUtilisation.toFixed(0)}%`}
            sub={`Bottleneck: Stage ${metrics.bottleneck}`}
            tone={utilTone}
          />
          <Card
            label="Avg Lead Time"
            icon={<Clock size={12} />}
            value={Number.isFinite(leadDays) ? `${leadDays.toFixed(1)}d` : '∞'}
            sub={`Theoretical M/M/c · actual ${metrics.actualLead.toFixed(1)}d`}
          />
          <Card
            label="Total Output"
            icon={<Users size={12} />}
            value={metrics.done}
            sub={`${metrics.throughputPerSprint.toFixed(2)} items/sprint`}
          />
        </div>
      </Section>

      <Section title="Scenarios" icon={<Layers size={12} />}>
        <label className="toggle">
          <input type="checkbox" checked={resetOnScenario} onChange={(e) => onResetOnScenarioChange(e.target.checked)} />
          Reset simulation when switching
        </label>
        <div className="scenario-list">
          {SCENARIOS.map((s) => (
            <button key={s.id} className={`scenario ${activeScenario === s.id ? 'active' : ''}`} onClick={() => onScenario(s.id)}>
              <span className="scenario-name">{s.name}</span>
              <span className="scenario-summary">{s.summary}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Incoming Flow" icon={<Waves size={12} />}>
        <Slider
          label="Arrival rate (λ)"
          value={params.arrivalRate}
          min={0}
          max={6}
          step={0.05}
          format={(v) => `${v.toFixed(2)}/day`}
          onChange={(v) => onChange({ arrivalRate: v })}
        />
        <Slider
          label="Simulation speed"
          value={params.speed}
          min={0.5}
          max={10}
          step={0.5}
          format={(v) => `${(v / DAYS_PER_SPRINT).toFixed(2)} sprints/s`}
          onChange={(v) => onChange({ speed: v })}
        />
      </Section>

      <Section title="Team Capacity" icon={<Users size={12} />}>
        <Slider
          label="Code dev capacity (servers)"
          value={params.devServers}
          min={1}
          max={8}
          step={1}
          onChange={(v) => onChange({ devServers: v })}
        />
        <Slider
          label="Code dev service rate (μ)"
          value={params.devRate}
          min={0.2}
          max={4}
          step={0.1}
          format={(v) => `${v.toFixed(1)}/day`}
          onChange={(v) => onChange({ devRate: v })}
        />
        <Slider
          label="Review capacity (servers)"
          value={params.reviewServers}
          min={1}
          max={8}
          step={1}
          onChange={(v) => onChange({ reviewServers: v })}
        />
        <Slider
          label="Review service rate (μ)"
          value={params.reviewRate}
          min={0.2}
          max={4}
          step={0.1}
          format={(v) => `${v.toFixed(1)}/day`}
          onChange={(v) => onChange({ reviewRate: v })}
        />
        <Slider
          label="QA capacity (servers)"
          value={params.qaServers}
          min={1}
          max={8}
          step={1}
          onChange={(v) => onChange({ qaServers: v })}
        />
        <Slider
          label="QA service rate (μ)"
          value={params.qaRate}
          min={0.2}
          max={4}
          step={0.1}
          format={(v) => `${v.toFixed(1)}/day`}
          onChange={(v) => onChange({ qaRate: v })}
        />
        <Slider label="Code dev WIP limit" value={params.devWipLimit} min={1} max={40} step={1} onChange={(v) => onChange({ devWipLimit: v })} />
        <Slider
          label="Review WIP limit"
          value={params.reviewWipLimit}
          min={1}
          max={40}
          step={1}
          onChange={(v) => onChange({ reviewWipLimit: v })}
        />
        <Slider label="QA WIP limit" value={params.qaWipLimit} min={1} max={40} step={1} onChange={(v) => onChange({ qaWipLimit: v })} />
      </Section>

      <Section title="System Friction" icon={<ShieldAlert size={12} />}>
        <Slider
          label="Blocking % (code dev)"
          value={params.blockingPct}
          min={0}
          max={0.8}
          step={0.01}
          format={pct}
          onChange={(v) => onChange({ blockingPct: v })}
        />
        <Slider
          label="Review rejection %"
          value={params.reviewRejectPct}
          min={0}
          max={0.8}
          step={0.01}
          format={pct}
          onChange={(v) => onChange({ reviewRejectPct: v })}
        />
        <Slider
          label="QA rework %"
          value={params.reworkPct}
          min={0}
          max={0.8}
          step={0.01}
          format={pct}
          onChange={(v) => onChange({ reworkPct: v })}
        />
      </Section>
    </aside>
  );
}
