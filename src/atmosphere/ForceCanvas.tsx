import {
  type PointerEvent as ReactPointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AtmosphereConfig,
  AtmosphereState,
  ForceVector,
  NormalizedPoint,
} from "./types";
import { angleOf, toDisplayForce } from "./forces";

type ForceKey = "pressure" | "coriolis" | "centrifugal" | "friction" | "net";

interface ForceCanvasProps {
  config: AtmosphereConfig;
  state: AtmosphereState;
  center: NormalizedPoint;
  animationOn: boolean;
  onCenterChange: (center: NormalizedPoint) => void;
  onCurvatureChange: (radiusKm: number) => void;
}

interface ForceMeta {
  key: ForceKey;
  label: string;
  formula: string;
  color: string;
  directionDescription: string;
}

const WIDTH = 900;
const HEIGHT = 650;
const PARCEL_ANGLE = 212;
const FORCE_META: ForceMeta[] = [
  {
    key: "pressure",
    label: "气压梯度力",
    formula: "Fₚ = −(1/ρ)∇p",
    color: "#c65d3b",
    directionDescription: "由高压指向低压，垂直于等压线",
  },
  {
    key: "coriolis",
    label: "地转偏向力",
    formula: "F꜀ = f V",
    color: "#3b6ea8",
    directionDescription: "北半球在速度右侧，南半球在速度左侧",
  },
  {
    key: "centrifugal",
    label: "惯性离心力",
    formula: "C = V²/R",
    color: "#8a6bbe",
    directionDescription: "沿曲率半径向外，直线等压线时为零",
  },
  {
    key: "friction",
    label: "摩擦力",
    formula: "Ff = −k V",
    color: "#7a6a58",
    directionDescription: "与风矢量方向相反，边界层中不为零",
  },
];

const FORCE_KEYS = FORCE_META.map((force) => force.key);

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function visualRadius(radiusKm: number) {
  return clamp(
    88 + 115 * (Math.log10(radiusKm / 300) / Math.log10(10)),
    78,
    220,
  );
}

function physicsRadius(radiusPixels: number) {
  const normalized = clamp((radiusPixels - 88) / 115, 0, 1);
  return clamp(300 * 10 ** normalized, 300, 3_000);
}

function vectorLength(
  force: ForceVector,
  maximumMagnitude: number,
): number {
  if (force.magnitude < 1e-9) return 0;
  return 18 + 98 * (force.magnitude / Math.max(maximumMagnitude, 1e-9));
}

function labelAnchor(angle: number) {
  const cosine = Math.cos((angle * Math.PI) / 180);
  if (cosine > 0.28) return "start";
  if (cosine < -0.28) return "end";
  return "middle";
}

export function ForceCanvas({
  config,
  state,
  center,
  animationOn,
  onCenterChange,
  onCurvatureChange,
}: ForceCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragMode = useRef<"center" | "radius" | null>(null);
  const [hoveredForce, setHoveredForce] = useState<ForceKey | null>(null);

  const centerPoint = useMemo(
    () => ({ x: center.x * WIDTH, y: center.y * HEIGHT }),
    [center],
  );
  const radius = visualRadius(config.curvatureKm);
  const parcel = useMemo(
    () =>
      config.geometry === "circular"
        ? {
            x: centerPoint.x + Math.cos((PARCEL_ANGLE * Math.PI) / 180) * radius,
            y: centerPoint.y + Math.sin((PARCEL_ANGLE * Math.PI) / 180) * radius,
          }
        : { x: 452, y: 332 },
    [centerPoint, config.geometry, radius],
  );

  const maximumMagnitude = Math.max(
    1e-9,
    ...FORCE_KEYS.map((key) => state.forces[key].magnitude),
  );
  const originOffsets: Record<Exclude<ForceKey, "net">, number> = {
    pressure: -17,
    coriolis: -5.5,
    centrifugal: 5.5,
    friction: 17,
  };

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = svgRef.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * HEIGHT,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragMode.current) return;
    const point = pointFromEvent(event);
    if (!point) return;
    if (dragMode.current === "center") {
      onCenterChange({
        x: clamp(point.x / WIDTH, 0.28, 0.72),
        y: clamp(point.y / HEIGHT, 0.24, 0.72),
      });
      return;
    }
    const offset = Math.hypot(
      point.x - centerPoint.x,
      point.y - centerPoint.y,
    );
    onCurvatureChange(physicsRadius(offset));
  };

  const finishDrag = () => {
    dragMode.current = null;
  };

  const isobarPath = (index: number) => {
    const spacing = 58 * config.isobarSpacing;
    const r = radius + spacing * index;
    return `M ${centerPoint.x - r} ${centerPoint.y} A ${r} ${r} 0 1 0 ${centerPoint.x + r} ${centerPoint.y} A ${r} ${r} 0 1 0 ${centerPoint.x - r} ${centerPoint.y}`;
  };

  const renderForce = (meta: ForceMeta) => {
    const force = state.forces[meta.key];
    const rawAngle = angleOf(force);
    const perpendicular = {
      x: -Math.sin((rawAngle * Math.PI) / 180),
      y: Math.cos((rawAngle * Math.PI) / 180),
    };
    const originOffset =
      meta.key === "net" ? 0 : originOffsets[meta.key as Exclude<ForceKey, "net">];
    const origin = {
      x: parcel.x + perpendicular.x * originOffset,
      y: parcel.y + perpendicular.y * originOffset,
    };
    const length = vectorLength(force, maximumMagnitude);
    const unit =
      force.magnitude > 1e-12
        ? { x: force.x / force.magnitude, y: force.y / force.magnitude }
        : { x: 0, y: 0 };
    const end = {
      x: origin.x + unit.x * length,
      y: origin.y + unit.y * length,
    };
    const anchor = labelAnchor(rawAngle);
    const labelX = end.x + unit.x * 10 + (anchor === "middle" ? 0 : 0);
    const labelY = end.y + unit.y * 10 + 4;
    const value = toDisplayForce(force.magnitude);
    const labelWidth = Math.max(45, 28 + value.length * 7);
    const isHovered = hoveredForce === meta.key;
    const dash =
      meta.key === "friction"
        ? "6 5"
        : meta.key === "centrifugal"
          ? "2 5"
          : undefined;

    return (
      <g
        className={`atf-force atf-force--${meta.key} ${isHovered ? "is-hovered" : ""}`}
        key={meta.key}
        role="button"
        tabIndex={0}
        aria-label={`${meta.label}，${value}×10⁻³ m/s²，${meta.directionDescription}`}
        onFocus={() => setHoveredForce(meta.key)}
        onBlur={() => setHoveredForce(null)}
        onPointerEnter={() => setHoveredForce(meta.key)}
        onPointerLeave={() => setHoveredForce(null)}
      >
        <title>
          {meta.label} · {meta.formula} · {value} × 10⁻³ m/s²
        </title>
        {Math.abs(originOffset) > 1 && force.magnitude > 1e-9 && (
          <line
            className="atf-force-connector"
            x1={parcel.x}
            y1={parcel.y}
            x2={origin.x}
            y2={origin.y}
            stroke={meta.color}
          />
        )}
        {force.magnitude < 1e-9 ? (
          <>
            <circle
              className="atf-zero-force"
              cx={origin.x}
              cy={origin.y}
              r="7"
              stroke={meta.color}
            />
            <text
              className="atf-force-label"
              fill={meta.color}
              x={origin.x + 12}
              y={origin.y + 4}
            >
              {meta.label} = 0
            </text>
          </>
        ) : (
          <>
            <line
              className="atf-force-shaft"
              x1={origin.x}
              y1={origin.y}
              x2={end.x}
              y2={end.y}
              stroke={meta.color}
              strokeDasharray={dash}
              markerEnd={`url(#atf-arrow-${meta.key})`}
            />
            <g className="atf-force-label-group">
              <rect
                className="atf-force-label-back"
                x={
                  anchor === "start"
                    ? labelX - 3
                    : anchor === "end"
                      ? labelX - labelWidth + 3
                      : labelX - labelWidth / 2
                }
                y={labelY - 15}
                width={labelWidth}
                height="22"
                rx="4"
              />
              <text
                className="atf-force-label"
                fill={meta.color}
                x={labelX}
                y={labelY}
                textAnchor={anchor}
              >
                {meta.label} {value}
              </text>
            </g>
          </>
        )}
      </g>
    );
  };

  const hoveredMeta = FORCE_META.find((force) => force.key === hoveredForce);
  const windLength = 32 + 30 * clamp(state.windSpeed / 30, 0, 1);
  const windEnd = {
    x: parcel.x + (state.velocity.x / Math.max(state.windSpeed, 1e-9)) * windLength,
    y: parcel.y + (state.velocity.y / Math.max(state.windSpeed, 1e-9)) * windLength,
  };
  const windClass =
    state.velocity.x < 0 ? "atf-streamlines is-reverse" : "atf-streamlines";

  return (
    <div className="atf-canvas-shell">
      <div className="atf-canvas-caption">
        <span>
          <i className="atf-status-light" />
          实时矢量合成
        </span>
        <span>悬停 / 聚焦任一力读取数值</span>
      </div>
      <svg
        ref={svgRef}
        className={`atf-canvas ${dragMode.current ? "is-dragging" : ""}`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={
          config.geometry === "circular"
            ? `${config.pressureCenter === "low" ? "低压" : "高压"}圆形等压线受力图，风速 ${state.windSpeed.toFixed(1)} 米每秒`
            : `平行等压线受力图，风速 ${state.windSpeed.toFixed(1)} 米每秒`
        }
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        onPointerLeave={finishDrag}
      >
        <defs>
          <pattern
            id="atf-grid"
            width="30"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <path d="M 30 0 L 0 0 0 30" className="atf-grid-line" />
          </pattern>
          <radialGradient id="atf-low-fill" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#4a6fa5" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#4a6fa5" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="atf-high-fill" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#d9a441" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#d9a441" stopOpacity="0" />
          </radialGradient>
          {FORCE_META.map((force) => (
            <marker
              id={`atf-arrow-${force.key}`}
              key={force.key}
              markerHeight="8"
              markerWidth="9"
              orient="auto"
              refX="7"
              refY="4"
              viewBox="0 0 9 8"
            >
              <path d="M 0 0 L 9 4 L 0 8 Z" fill={force.color} />
            </marker>
          ))}
          <marker
            id="atf-arrow-net"
            markerHeight="7"
            markerWidth="8"
            orient="auto"
            refX="6"
            refY="3.5"
            viewBox="0 0 8 7"
          >
            <path d="M 0 0 L 8 3.5 L 0 7 Z" fill="#22302a" />
          </marker>
          <marker
            id="atf-wind-arrow"
            markerHeight="8"
            markerWidth="9"
            orient="auto"
            refX="7"
            refY="4"
            viewBox="0 0 9 8"
          >
            <path d="M 0 0 L 9 4 L 0 8 Z" fill="#2f6b5e" />
          </marker>
        </defs>

        <rect width={WIDTH} height={HEIGHT} className="atf-map-paper" />
        <rect width={WIDTH} height={HEIGHT} fill="url(#atf-grid)" />

        {config.geometry === "parallel" ? (
          <>
            <g className="atf-isobars">
              {[100, 190, 280, 370, 460, 550].map((y) => (
                <line key={y} x1="34" x2="866" y1={y} y2={y} />
              ))}
            </g>
            <g className="atf-pressure-labels">
              <text x="50" y="72">H · 高气压</text>
              <text x="842" y="606" textAnchor="end">L · 低气压</text>
            </g>
            <g className={windClass} aria-hidden="true">
              {[150, 235, 325, 415, 505].map((y) => (
                <line key={y} x1="72" x2="828" y1={y} y2={y} />
              ))}
            </g>
          </>
        ) : (
          <>
            <circle
              cx={centerPoint.x}
              cy={centerPoint.y}
              r="215"
              fill={
                config.pressureCenter === "low"
                  ? "url(#atf-low-fill)"
                  : "url(#atf-high-fill)"
              }
            />
            <g className="atf-isobars">
              {[0, 1, 2, 3, 4].map((index) => (
                <path key={index} d={isobarPath(index)} />
              ))}
            </g>
            <g className={windClass} aria-hidden="true">
              {[0, 1].map((index) => (
                <path
                  key={index}
                  d={isobarPath(index)}
                  className={state.velocity.x < 0 ? "is-reverse" : ""}
                />
              ))}
            </g>
            <g className="atf-pressure-centre">
              <circle
                className="atf-centre-halo"
                cx={centerPoint.x}
                cy={centerPoint.y}
                r="30"
              />
              <text
                x={centerPoint.x}
                y={centerPoint.y + 8}
                textAnchor="middle"
              >
                {config.pressureCenter === "low" ? "L" : "H"}
              </text>
              <text
                className="atf-centre-caption"
                x={centerPoint.x}
                y={centerPoint.y + 48}
                textAnchor="middle"
              >
                {config.pressureCenter === "low" ? "低压中心" : "高压中心"}
              </text>
              <circle
                className="atf-drag-handle"
                cx={centerPoint.x}
                cy={centerPoint.y}
                r="11"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  dragMode.current = "center";
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
              >
                <title>拖动等压线中心</title>
              </circle>
            </g>
          </>
        )}

        <g className="atf-wind-vector">
          <line
            x1={parcel.x}
            y1={parcel.y}
            x2={windEnd.x}
            y2={windEnd.y}
            markerEnd="url(#atf-wind-arrow)"
          />
          <text
            x={windEnd.x + 8}
            y={windEnd.y - 8}
            className="atf-wind-label"
          >
            V = {state.windSpeed.toFixed(1)} m/s
          </text>
        </g>

        <g className="atf-parcel">
          <circle className="atf-parcel-pulse" cx={parcel.x} cy={parcel.y} r="17" />
          <circle className="atf-parcel-body" cx={parcel.x} cy={parcel.y} r="8" />
          <text x={parcel.x + 14} y={parcel.y + 24}>
            空气质点
          </text>
          {config.geometry === "circular" && (
            <circle
              className="atf-radius-handle"
              cx={parcel.x}
              cy={parcel.y}
              r="14"
              onPointerDown={(event) => {
                event.stopPropagation();
                dragMode.current = "radius";
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            >
              <title>拖动空气质点调整曲率半径</title>
            </circle>
          )}
        </g>

        {FORCE_META.map(renderForce)}
        {state.netMagnitude > 3e-5 && (
          <g className="atf-force atf-force--net">
            <line
              className="atf-net-force"
              x1={parcel.x}
              y1={parcel.y}
              x2={
                parcel.x +
                (state.forces.net.x / state.netMagnitude) *
                  (36 +
                    52 * (state.netMagnitude / Math.max(maximumMagnitude, 1e-9)))
              }
              y2={
                parcel.y +
                (state.forces.net.y / state.netMagnitude) *
                  (36 +
                    52 * (state.netMagnitude / Math.max(maximumMagnitude, 1e-9)))
              }
              markerEnd="url(#atf-arrow-net)"
            />
          </g>
        )}

        <g className="atf-map-legend">
          <rect x="24" y="544" width="246" height="82" rx="10" />
          <text x="40" y="568" className="atf-legend-title">图例</text>
          {FORCE_META.map((force, index) => (
            <g
              key={`legend-${force.key}`}
              transform={`translate(${40 + (index % 2) * 116} ${586 + Math.floor(index / 2) * 18})`}
            >
              <line x1="0" y1="0" x2="20" y2="0" stroke={force.color} />
              <circle cx="20" cy="0" r="2.4" fill={force.color} />
              <text x="27" y="4">{force.label}</text>
            </g>
          ))}
        </g>

        <g className="atf-map-note">
          <text x="876" y="632" textAnchor="end">
            {config.geometry === "circular"
              ? `R ${config.curvatureKm.toFixed(0)} km · 拖动中心 / 质点`
              : "平行等压线 · R → ∞"}
          </text>
        </g>
      </svg>

      {hoveredMeta && (
        <aside className="atf-force-tooltip" role="status">
          <strong style={{ color: hoveredMeta.color }}>{hoveredMeta.label}</strong>
          <span>{hoveredMeta.formula}</span>
          <b>
            {toDisplayForce(state.forces[hoveredMeta.key].magnitude)} × 10⁻³
            m/s²
          </b>
          <small>{hoveredMeta.directionDescription}</small>
        </aside>
      )}

      <div className="atf-canvas-footer">
        <span>
          合力{" "}
          <strong>{toDisplayForce(state.netMagnitude)}</strong> × 10⁻³ m/s²
        </span>
        <span>
          风向 <strong>{state.windAngle.toFixed(0)}°</strong>
        </span>
        <span className={animationOn ? "" : "is-muted"}>
          流线 {animationOn ? "运动中" : "已暂停"}
        </span>
      </div>
    </div>
  );
}
