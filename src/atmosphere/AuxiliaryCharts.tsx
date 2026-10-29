import { coriolisParameter, toDisplayF, toDisplayForce } from "./forces";
import type { AtmosphereState } from "./types";

interface AuxiliaryChartsProps {
  state: AtmosphereState;
}

const CHART_WIDTH = 420;
const CHART_HEIGHT = 240;
const PLOT = { left: 48, right: 386, top: 26, bottom: 188 };

function latitudeForce(latitude: number, speed: number) {
  return Math.abs(coriolisParameter(latitude, 1)) * speed;
}

function latitudePoint(latitude: number, speed: number) {
  const maximum = Math.max(0.0001, Math.abs(coriolisParameter(90, 1)) * speed);
  return {
    x:
      PLOT.left +
      (latitude / 90) * (PLOT.right - PLOT.left),
    y:
      PLOT.bottom -
      (latitudeForce(latitude, speed) / maximum) *
        (PLOT.bottom - PLOT.top),
  };
}

export function ForceLatitudeChart({ state }: AuxiliaryChartsProps) {
  const curvature = Array.from({ length: 91 }, (_, latitude) =>
    latitudePoint(latitude, state.windSpeed),
  );
  const path = curvature
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const current = latitudePoint(state.config.latitude, state.windSpeed);
  const maximumForce = Math.max(
    1e-9,
    Math.abs(coriolisParameter(90, 1)) * state.windSpeed,
  );

  return (
    <article className="atf-mini-card">
      <header>
        <div>
          <h3>地转偏向力随纬度增加</h3>
        </div>
        <span className="atf-mini-tag">固定 V</span>
      </header>
      <svg
        className="atf-mini-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={`纬度 ${state.config.latitude} 度时地转偏向力 ${toDisplayForce(state.coriolisMagnitude)} 乘十的负三次方米每二次方秒`}
      >
        <g className="atf-chart-grid">
          {[0, 0.25, 0.5, 0.75, 1].map((value) => {
            const y =
              PLOT.bottom - value * (PLOT.bottom - PLOT.top);
            return (
              <g key={value}>
                <line x1={PLOT.left} x2={PLOT.right} y1={y} y2={y} />
                <text x={PLOT.left - 8} y={y + 4} textAnchor="end">
                  {(maximumForce * value * 1_000).toFixed(1)}
                </text>
              </g>
            );
          })}
          {[0, 30, 60, 90].map((latitude) => {
            const point = latitudePoint(latitude, state.windSpeed);
            return (
              <g key={latitude}>
                <line
                  x1={point.x}
                  x2={point.x}
                  y1={PLOT.top}
                  y2={PLOT.bottom}
                />
                <text
                  x={point.x}
                  y={PLOT.bottom + 20}
                  textAnchor="middle"
                >
                  {latitude}°
                </text>
              </g>
            );
          })}
        </g>
        <path className="atf-chart-curve" d={path} />
        <line
          className="atf-chart-marker"
          x1={current.x}
          x2={current.x}
          y1={PLOT.top}
          y2={PLOT.bottom}
        />
        <circle
          className="atf-chart-point"
          cx={current.x}
          cy={current.y}
          r="5"
        />
        <g className="atf-chart-readout">
          <rect
            x={Math.min(current.x + 10, 290)}
            y={Math.max(current.y - 42, 18)}
            width="98"
            height="36"
            rx="5"
          />
          <text
            x={Math.min(current.x + 18, 298)}
            y={Math.max(current.y - 25, 35)}
          >
            φ {state.config.latitude.toFixed(0)}°
          </text>
          <text
            x={Math.min(current.x + 18, 298)}
            y={Math.max(current.y - 11, 49)}
          >
            fV {toDisplayForce(state.coriolisMagnitude)}
          </text>
        </g>
        <text
          className="atf-axis-title"
          x="14"
          y="112"
          transform="rotate(-90 14 112)"
          textAnchor="middle"
        >
          fV / 10⁻³ m·s⁻²
        </text>
        <text
          className="atf-axis-title"
          x={(PLOT.left + PLOT.right) / 2}
          y="225"
          textAnchor="middle"
        >
          纬度 φ
        </text>
      </svg>
      <footer>
        <span>
          <b>f =</b> {toDisplayF(state.coriolisParameter)} × 10⁻⁴ s⁻¹
        </span>
        <span>赤道处 f = 0</span>
      </footer>
    </article>
  );
}

export function WindDeflectionGauge({ state }: AuxiliaryChartsProps) {
  const deflection = Math.max(-90, Math.min(90, state.deflectionAngle));
  const inwardComponent =
    state.velocity.x * state.pressureUnit.x +
    state.velocity.y * state.pressureUnit.y;
  const directionText =
    state.config.friction < 1e-7
      ? "自由大气：近似沿等压线"
      : inwardComponent > 0.02
        ? "边界层：风偏向低压"
        : "边界层：风偏离切向";
  const arcLength = Math.PI * 82;
  const pointerRadians = ((deflection - 90) * Math.PI) / 180;
  const pointerEnd = {
    x: 145 + Math.cos(pointerRadians) * 76,
    y: 163 + Math.sin(pointerRadians) * 76,
  };

  return (
    <article className="atf-mini-card atf-gauge-card">
      <header>
        <div>
          <h3>风与等压线的夹角</h3>
        </div>
        <span className="atf-mini-tag">偏差 {Math.abs(deflection).toFixed(1)}°</span>
      </header>
      <div className="atf-gauge-main">
        <svg
          className="atf-gauge"
          viewBox="0 0 290 205"
          role="img"
          aria-label={`风与等压线夹角 ${Math.abs(deflection).toFixed(1)} 度，${directionText}`}
        >
          <path
            className="atf-gauge-track"
            d="M 63 163 A 82 82 0 0 1 227 163"
            pathLength="100"
          />
          <path
            className="atf-gauge-progress"
            d="M 63 163 A 82 82 0 0 1 227 163"
            pathLength="100"
            strokeDasharray={`${Math.abs(deflection) / 1.8} ${arcLength}`}
          />
          {[-90, -45, 0, 45, 90].map((tick) => {
            const radians = ((tick - 90) * Math.PI) / 180;
            const inner = {
              x: 145 + Math.cos(radians) * 68,
              y: 163 + Math.sin(radians) * 68,
            };
            const outer = {
              x: 145 + Math.cos(radians) * 82,
              y: 163 + Math.sin(radians) * 82,
            };
            return (
              <g key={tick}>
                <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} />
                <text
                  x={145 + Math.cos(radians) * 98}
                  y={168 + Math.sin(radians) * 98}
                  textAnchor="middle"
                >
                  {Math.abs(tick)}°
                </text>
              </g>
            );
          })}
          <line
            className="atf-gauge-isobar"
            x1="30"
            x2="260"
            y1="163"
            y2="163"
          />
          <text className="atf-gauge-isobar-label" x="30" y="179">
            等压线切向
          </text>
          <line
            className="atf-gauge-pointer"
            x1="145"
            y1="163"
            x2={pointerEnd.x}
            y2={pointerEnd.y}
          />
          <circle className="atf-gauge-axis" cx="145" cy="163" r="6" />
          <path
            className="atf-gauge-low-arrow"
            d="M 145 163 L 145 84"
            markerEnd="url(#atf-gauge-arrow)"
          />
          <defs>
            <marker
              id="atf-gauge-arrow"
              markerHeight="7"
              markerWidth="8"
              orient="auto"
              refX="6"
              refY="3.5"
              viewBox="0 0 8 7"
            >
              <path d="M 0 0 L 8 3.5 L 0 7 Z" fill="#c65d3b" />
            </marker>
          </defs>
        </svg>
        <div className="atf-gauge-readout">
          <strong>{Math.abs(deflection).toFixed(1)}°</strong>
          <span>{directionText}</span>
          <small>
            {state.config.hemisphere === 1 ? "北半球" : "南半球"} ·{" "}
            {state.config.friction < 1e-7 ? "k = 0" : "k > 0"}
          </small>
        </div>
      </div>
      <footer>
        <span>0° 表示和等压线相切</span>
        <span>角度取风速相对切向的偏差</span>
      </footer>
    </article>
  );
}
