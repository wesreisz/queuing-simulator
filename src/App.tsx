import { useState } from 'react';
import { ChevronDown, Info, Pause, Play, RotateCcw } from 'lucide-react';
import { DAYS_PER_SPRINT, STATE_COLORS, type Params } from './sim/engine';
import { DEFAULT_PARAMS, SCENARIOS } from './sim/scenarios';
import { useSimulation } from './sim/useSimulation';
import { SimCanvas } from './components/SimCanvas';
import { PressureChart } from './components/PressureChart';
import { Sidebar } from './components/Sidebar';
import { STAGE_COLORS } from './theme';
import './App.css';

const LEGEND = [
  { color: STATE_COLORS.flowing, text: 'Moving normally' },
  { color: STATE_COLORS.waiting, text: 'Queued for over a day' },
  { color: STATE_COLORS.blocked, text: 'Stuck on a blocker' },
  { color: STATE_COLORS.rework, text: 'Sent back for rework' },
];

export default function App() {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [activeScenario, setActiveScenario] = useState<string | null>('healthy');
  const [resetOnScenario, setResetOnScenario] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const { dataRef, metrics, running, setRunning, reset } = useSimulation(params);

  const handleChange = (patch: Partial<Params>) => {
    setParams((p) => ({ ...p, ...patch }));
    setActiveScenario(null);
  };

  const handleScenario = (id: string) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) return;
    const next = { ...params, ...scenario.params };
    setParams(next);
    setActiveScenario(id);
    if (resetOnScenario) reset(next);
  };

  return (
    <div className="app">
      <header className="hero">
        <h1>Queuing Theory Simulator</h1>
        <p>
          What happens to the system when we optimize some parts of software delivery and not the entire value chain?
        </p>
      </header>

      <div className="sim-panel">
        <Sidebar
          params={params}
          metrics={metrics}
          activeScenario={activeScenario}
          resetOnScenario={resetOnScenario}
          onChange={handleChange}
          onScenario={handleScenario}
          onResetOnScenarioChange={setResetOnScenario}
        />

        <main className="stage-area">
          <div className="canvas-wrap">
            <SimCanvas dataRef={dataRef} />
            <div className="time-badge">Time: {(metrics.time / DAYS_PER_SPRINT).toFixed(1)} sprints</div>
            <div className="toolbar">
              <div className="button-group">
                <button
                  className={`icon-btn ${running ? 'active' : ''}`}
                  onClick={() => setRunning(!running)}
                  title={running ? 'Pause' : 'Play'}
                >
                  {running ? <Pause size={13} /> : <Play size={13} />}
                </button>
                <button className="icon-btn" onClick={() => reset()} title="Reset">
                  <RotateCcw size={13} />
                </button>
              </div>
              <div className="legend">
                <button className="legend-btn" onClick={() => setLegendOpen(!legendOpen)}>
                  <Info size={12} /> Legend <ChevronDown size={12} />
                </button>
                {legendOpen && (
                  <div className="legend-menu">
                    {LEGEND.map((l) => (
                      <div key={l.text} className="legend-item">
                        <span className="legend-dot" style={{ background: l.color }} />
                        {l.text}
                      </div>
                    ))}
                    <div className="legend-item">
                      <span className="legend-ring" />
                      Idle capacity (S)
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="chart-wrap">
            <div className="chart-header">
              <span className="chart-title">WIP vs. Limit by Stage</span>
              <span className="chart-keys">
                <span>
                  <i style={{ background: STAGE_COLORS.dev }} /> Stage 1 (Code Dev)
                </span>
                <span>
                  <i style={{ background: STAGE_COLORS.review }} /> Stage 2 (Code Review)
                </span>
                <span>
                  <i style={{ background: STAGE_COLORS.qa }} /> Stage 3 (QA)
                </span>
              </span>
            </div>
            <PressureChart history={metrics.history} />
          </div>
        </main>
      </div>

      <footer className="credit">
        The original idea for this simulator came from a similar one by Ryan Snowden:{' '}
        <a href="https://www.ryansnowden.com/labs/query-theory-simulator/" target="_blank" rel="noopener noreferrer">
          Queuing Theory Simulator
        </a>
        .
      </footer>
    </div>
  );
}
