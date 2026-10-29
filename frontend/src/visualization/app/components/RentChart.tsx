import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useElementSize } from "../hooks/useElementSize";
import {
  MAP_WIDTH_KM,
  evaluatePoint,
  findFarmableDistance,
  formatDecimal,
  formatRent,
  getCropEconomics,
  sampleMarketCurves,
} from "../rent";
import type {
  City,
  CropDefinition,
  MarketCurveSeries,
  ModelConfig,
  Road,
} from "../types";
import type { MapProbe } from "./MapCanvas";
import { InlineFormula } from "./Formula";

interface RentChartProps {
  cities: City[];
  roads: Road[];
  config: ModelConfig;
  selectedMarketId: string;
  mapAspect: number;
  mapProbe: MapProbe | null;
  resetKey: number;
  onSelectMarket: (id: string) => void;
  onToggleCrop: (id: string) => void;
}

interface PlotGeometry {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const rough = value / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / power;
  const nice =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 3
          ? 3
          : normalized <= 5
            ? 5
            : 10;
  return nice * power * 4;
}

function pathFromPoints(
  points: Array<{ x: number; y: number }>,
): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) =>
      `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
    )
    .join("");
}

function valueAtDistance(
  series: MarketCurveSeries,
  distance: number,
): number {
  if (series.points.length === 0) return 0;
  const exactIndex = Math.min(
    series.points.length - 1,
    Math.max(
      0,
      Math.round(
        (distance / series.points[series.points.length - 1].distanceKm) *
          (series.points.length - 1),
      ),
    ),
  );
  return series.points[exactIndex].rent;
}

function envelopeSeries(
  series: MarketCurveSeries[],
): Array<{ distanceKm: number; rent: number; crop: CropDefinition | null }> {
  if (series.length === 0) return [];
  return series[0].points.map((point, index) => {
    let bestRent = 0;
    let bestCrop: CropDefinition | null = null;
    for (const item of series) {
      const rent = item.points[index]?.rent ?? 0;
      if (rent > bestRent) {
        bestRent = rent;
        bestCrop = item.crop;
      }
    }
    return { distanceKm: point.distanceKm, rent: bestRent, crop: bestCrop };
  });
}

function observations(
  selectedCity: City,
  cities: City[],
  config: ModelConfig,
  mapAspect: number,
  roads: Road[],
) {
  const nearby = evaluatePoint(
    {
      x: selectedCity.x + 0.006,
      y: selectedCity.y,
    },
    cities,
    config,
    mapAspect,
    roads,
  );
  const midDistance = 3.2;
  const mid = evaluatePoint(
    {
      x: selectedCity.x + midDistance / MAP_WIDTH_KM,
      y: selectedCity.y,
    },
    cities,
    config,
    mapAspect,
    roads,
  );
  return {
    centralCrop: nearby.winner?.crop.shortName ?? "无人竞租",
    midCrop: mid.winner?.crop.shortName ?? "未耕作",
    midDistance,
    midMarket: mid.winner?.city.name ?? mid.nearestCity.name,
  };
}

export function RentChart({
  cities,
  roads,
  config,
  selectedMarketId,
  mapAspect,
  mapProbe,
  resetKey,
  onSelectMarket,
  onToggleCrop,
}: RentChartProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(wrapperRef, { width: 880, height: 342 });
  const [hoverDistance, setHoverDistance] = useState<number | null>(null);
  const [showActualRent, setShowActualRent] = useState(false);
  const selectedCity =
    cities.find((city) => city.id === selectedMarketId) ?? cities[0];

  useEffect(() => {
    setShowActualRent(false);
  }, [resetKey]);

  const maxZero = Math.max(
    ...config.crops.map(
      (crop) => getCropEconomics(crop, config.freightRate).zeroDistanceKm,
    ),
    4,
  );
  const maxDistance = Math.min(12, Math.max(5, Math.ceil(maxZero * 1.05)));
  const chartHeight = size.width < 540 ? 330 : 350;
  const plotLeft = size.width < 540 ? 80 : 68;
  const plotRight = size.width < 540 ? 18 : 24;
  const plotTop = 34;
  const plotWidth = Math.max(160, size.width - plotLeft - plotRight);
  const plotHeight = chartHeight - 92;
  const plot: PlotGeometry = {
    left: plotLeft,
    top: plotTop,
    width: plotWidth,
    height: plotHeight,
    bottom: plotTop + plotHeight,
    right: plotLeft + plotWidth,
  };

  const series = useMemo(
    () =>
      selectedCity
        ? sampleMarketCurves(
            selectedCity,
            config.crops,
            config,
            mapAspect,
            maxDistance,
            120,
            roads,
          )
        : [],
    [config, mapAspect, maxDistance, roads, selectedCity],
  );
  const baselineSeries = useMemo(
    () =>
      selectedCity && config.traffic.enabled
        ? sampleMarketCurves(
            selectedCity,
            config.crops,
            {
              ...config,
              traffic: { ...config.traffic, enabled: false },
            },
            mapAspect,
            maxDistance,
            80,
            roads,
          )
        : [],
    [config, mapAspect, maxDistance, roads, selectedCity],
  );
  const globalEnvelope = useMemo(() => {
    if (!selectedCity || cities.length <= 1) return [];
    return series[0]?.points.map((sample) => {
      const evaluation = evaluatePoint(
        {
          x: selectedCity.x + sample.distanceKm / MAP_WIDTH_KM,
          y: selectedCity.y,
        },
        cities,
        config,
        mapAspect,
        roads,
      );
      return {
        distanceKm: sample.distanceKm,
        rent: evaluation.winner?.rent ?? 0,
      };
    }) ?? [];
  }, [cities, config, mapAspect, roads, selectedCity, series]);

  const maxRent = Math.max(
    ...config.crops.map(
      (crop) => getCropEconomics(crop, config.freightRate).a,
    ),
    1000,
  );
  const yMax = niceCeiling(maxRent);
  const xScale = (distance: number) =>
    plot.left + (distance / maxDistance) * plot.width;
  const yScale = (rent: number) =>
    plot.bottom - (Math.max(0, rent) / yMax) * plot.height;

  const envelope = envelopeSeries(series);
  const baselineEnvelope = envelopeSeries(baselineSeries);
  const envelopePath = pathFromPoints(
    envelope.map((point) => ({
      x: xScale(point.distanceKm),
      y: yScale(point.rent),
    })),
  );
  const baselineEnvelopePath = pathFromPoints(
    baselineEnvelope.map((point) => ({
      x: xScale(point.distanceKm),
      y: yScale(point.rent),
    })),
  );
  const globalEnvelopePath = pathFromPoints(
    globalEnvelope.map((point) => ({
      x: xScale(point.distanceKm),
      y: yScale(point.rent),
    })),
  );
  const boundaries = envelope.reduce<
    Array<{ distance: number; rent: number; crop: CropDefinition }>
  >((result, point, index) => {
    const previous = envelope[index - 1];
    if (
      point.crop &&
      previous?.crop &&
      point.crop.id !== previous.crop.id &&
      point.rent > 0 &&
      result.length < 5
    ) {
      result.push({
        distance: point.distanceKm,
        rent: point.rent,
        crop: point.crop,
      });
    }
    return result;
  }, []);

  const actualHoverDistance = hoverDistance ?? mapProbe?.selectedMarketDistanceKm;
  const boundedHover =
    actualHoverDistance !== undefined && actualHoverDistance <= maxDistance
      ? actualHoverDistance
      : null;
  let hoverEnvelope: { rent: number; crop: CropDefinition | null } = {
    rent: 0,
    crop: null,
  };
  if (boundedHover !== null && envelope.length > 0) {
    const nearest = envelope.reduce((best, point) =>
      Math.abs(point.distanceKm - boundedHover) <
      Math.abs(best.distanceKm - boundedHover)
        ? point
        : best,
    );
    hoverEnvelope.rent = nearest.rent;
    hoverEnvelope.crop = nearest.crop;
  }

  const xTickStep = maxDistance <= 8 ? 2 : 3;
  const xTicks: number[] = [];
  for (let distance = 0; distance <= maxDistance; distance += xTickStep) {
    xTicks.push(distance);
  }
  if (xTicks.at(-1) !== maxDistance) xTicks.push(maxDistance);
  const yTicks = [0, yMax / 4, yMax / 2, (yMax * 3) / 4, yMax];

  const handleChartPointer = (
    event: ReactPointerEvent<SVGRectElement>,
  ) => {
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * size.width;
    const distance = ((svgX - plot.left) / plot.width) * maxDistance;
    setHoverDistance(Math.max(0, Math.min(maxDistance, distance)));
  };

  const chartObservations = observations(
    selectedCity,
    cities,
    config,
    mapAspect,
    roads,
  );
  const farmableDistance = findFarmableDistance(series);
  const chartFactor = selectedCity
    ? (() => {
        const nearPoint = evaluatePoint(
          { x: selectedCity.x + 0.004, y: selectedCity.y },
          [selectedCity],
          config,
          mapAspect,
          roads,
        );
        return nearPoint.trafficMultiplier;
      })()
    : 1;

  return (
    <div className="rent-chart-module">
      <div className="chart-toolbar">
        <div className="chart-profile-note">
          <span className="section-index">剖面</span>
          <span>
            向东剖面
            {config.traffic.enabled
              ? ` · 当前端运价系数 ${formatDecimal(chartFactor, 2)}`
              : " · 均质运费率"}
          </span>
        </div>
        <div className="chart-toolbar-actions">
          <button
            type="button"
            className={`actual-rent-toggle ${showActualRent ? "is-active" : ""}`}
            aria-pressed={showActualRent}
            disabled={config.crops.length === 0}
            onClick={() => setShowActualRent((visible) => !visible)}
          >
            <span aria-hidden="true" />
            实际地租
          </button>
          <label className="select-control">
            <span>观察市场</span>
            <select
              value={selectedCity?.id ?? ""}
              onChange={(event) => onSelectMarket(event.target.value)}
              aria-label="选择曲线对应的市场"
            >
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="chart-plot" ref={wrapperRef}>
        {config.crops.length === 0 && (
          <div className="chart-empty-overlay">
            <strong>尚未添加作物</strong>
            <span>打开“作物参数”侧栏，添加作物后即可查看竞租曲线。</span>
          </div>
        )}
        <svg
          viewBox={`0 0 ${size.width} ${chartHeight}`}
          role="img"
          aria-labelledby="rent-chart-title rent-chart-desc"
        >
          <title id="rent-chart-title">地租与距离关系图</title>
          <desc id="rent-chart-desc">
            不同作物从城市中心向外递减的地租直线，以及各直线中的最高值构成的上包络。
          </desc>
          <defs>
            <clipPath id="rent-plot-clip">
              <rect
                x={plot.left}
                y={plot.top}
                width={plot.width}
                height={plot.height}
              />
            </clipPath>
          </defs>

          <rect
            x={plot.left}
            y={plot.top}
            width={plot.width}
            height={plot.height}
            fill="var(--chart-paper)"
            stroke="var(--border)"
            rx="3"
          />

          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={plot.left}
                x2={plot.right}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="var(--border)"
                strokeWidth={tick === 0 ? 1 : 0.65}
                strokeDasharray={tick === 0 ? "" : "2 5"}
              />
              <text
                x={plot.left - 10}
                y={yScale(tick) + 4}
                textAnchor="end"
                fontSize={size.width < 540 ? 11.5 : 12.5}
                fill="var(--muted)"
              >
                {tick === 0 ? "0" : formatRent(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={plot.bottom}
                y2={plot.bottom + 5}
                stroke="var(--chart-axis)"
              />
              <text
                x={xScale(tick)}
                y={plot.bottom + 19}
                textAnchor="middle"
                fontSize={size.width < 540 ? 11.5 : 12.5}
                fill="var(--muted)"
              >
                {tick}
              </text>
            </g>
          ))}

          <text
            className="axis-title"
            data-axis="x"
            x={plot.left + plot.width / 2}
            y={chartHeight - 12}
            textAnchor="middle"
            fontSize="13"
            fill="var(--ink)"
          >
            到市场的距离 <tspan fontStyle="italic">d</tspan>（km）
          </text>
          <text
            className="axis-title"
            data-axis="y"
            x="16"
            y={plot.top + plot.height / 2}
            transform={`rotate(-90 16 ${plot.top + plot.height / 2})`}
            textAnchor="middle"
            fontSize="13"
            fill="var(--ink)"
          >
            单位面积地租 <tspan fontStyle="italic">R</tspan>（元/ha）
          </text>

          <g clipPath="url(#rent-plot-clip)">
            {showActualRent &&
              config.traffic.enabled &&
              baselineEnvelopePath && (
              <path
                d={baselineEnvelopePath}
                fill="none"
                stroke="var(--chart-axis)"
                strokeWidth="1.2"
                strokeDasharray="5 5"
                opacity="0.58"
              />
            )}

            {series.map((item) => {
              const visible = item.crop.visible;
              if (!visible) return null;
              return (
                <path
                  key={item.crop.id}
                  d={pathFromPoints(
                    item.points.map((point) => ({
                      x: xScale(point.distanceKm),
                      y: yScale(point.rent),
                    })),
                  )}
                  fill="none"
                  stroke={item.crop.color}
                  strokeWidth="1.45"
                  strokeDasharray={item.crop.dash}
                  opacity="0.9"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}

            {showActualRent && globalEnvelopePath && (
              <path
                data-global-envelope
                d={globalEnvelopePath}
                fill="none"
                stroke="#C65D3B"
                strokeWidth="1.8"
                strokeDasharray="8 4"
                strokeLinecap="round"
                opacity="0.82"
              />
            )}

            {showActualRent && boundaries.map((boundary, index) => (
              <g key={`${boundary.distance}-${boundary.crop.id}`}>
                <line
                  x1={xScale(boundary.distance)}
                  x2={xScale(boundary.distance)}
                  y1={plot.bottom}
                  y2={yScale(boundary.rent)}
                  stroke="var(--chart-axis)"
                  strokeWidth="0.7"
                  strokeDasharray="3 4"
                />
                <foreignObject
                  data-boundary-formula
                  x={Math.min(
                    plot.right - 44,
                    Math.max(plot.left + 2, xScale(boundary.distance) - 22),
                  )}
                  y={Math.max(plot.top + 2, yScale(boundary.rent) - 28)}
                  width="44"
                  height="24"
                  pointerEvents="none"
                >
                  <div className="svg-formula-label">
                    <InlineFormula latex={`d_{${index + 1}}`} />
                  </div>
                </foreignObject>
              </g>
            ))}

            {showActualRent && envelopePath && (
              <path
                data-actual-envelope
                d={envelopePath}
                fill="none"
                stroke="var(--ink)"
                strokeWidth="2.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {boundedHover !== null && (
              <g>
                <line
                  x1={xScale(boundedHover)}
                  x2={xScale(boundedHover)}
                  y1={plot.top}
                  y2={plot.bottom}
                  stroke="#C65D3B"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                {series
                  .filter((item) => item.crop.visible)
                  .map((item) => (
                    <circle
                      key={item.crop.id}
                      cx={xScale(boundedHover)}
                      cy={yScale(valueAtDistance(item, boundedHover))}
                      r="3.2"
                      fill="var(--paper)"
                      stroke={item.crop.color}
                      strokeWidth="1.6"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                {showActualRent && (
                  <circle
                    cx={xScale(boundedHover)}
                    cy={yScale(hoverEnvelope.rent)}
                    r="4.8"
                    fill="var(--ink)"
                    stroke="var(--paper)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            )}
          </g>

          <rect
            x={plot.left}
            y={plot.top}
            width={plot.width}
            height={plot.height}
            fill="transparent"
            data-chart-hit
            data-chart-hover-overlay="cross-series"
            onPointerMove={handleChartPointer}
            onPointerDown={handleChartPointer}
            onPointerLeave={() => setHoverDistance(null)}
          />

          {showActualRent && envelopePath && (
          <g transform={`translate(${plot.left + 8} ${plot.top + 9})`}>
            <rect
              width={config.traffic.enabled ? 168 : 136}
              height="25"
              rx="12.5"
              fill="var(--paper)"
              fillOpacity="0.93"
              stroke="var(--border)"
              strokeWidth="0.7"
            />
            <line
              x1="12"
              x2="31"
              y1="12.5"
              y2="12.5"
              stroke="var(--ink)"
              strokeWidth="2.6"
              strokeLinecap="round"
            />
            <text x="39" y="16.5" fontSize="11.5" fill="var(--ink)">
              {cities.length > 1 ? "本市场包络" : "上包络 = 实际地租"}
            </text>
          </g>
          )}
          {showActualRent && config.traffic.enabled && (
            <g transform={`translate(${plot.right - 122} ${plot.top + 9})`}>
              <rect
                width="114"
                height="25"
                rx="12.5"
                fill="var(--paper)"
                fillOpacity="0.93"
                stroke="var(--border)"
                strokeWidth="0.7"
              />
              <line
                x1="12"
                x2="31"
                y1="12.5"
                y2="12.5"
                stroke="var(--chart-axis)"
                strokeWidth="1.1"
                strokeDasharray="4 4"
              />
              <text x="38" y="16.5" fontSize="11.5" fill="var(--muted)">
                无道路基线
              </text>
            </g>
          )}
          {showActualRent && globalEnvelopePath && (
            <g transform={`translate(${plot.right - 124} ${plot.top + 40})`}>
              <rect
                width="116"
                height="25"
                rx="12.5"
                fill="var(--paper)"
                fillOpacity="0.93"
                stroke="var(--border)"
                strokeWidth="0.7"
              />
              <line
                x1="12"
                x2="31"
                y1="12.5"
                y2="12.5"
                stroke="#C65D3B"
                strokeWidth="1.8"
                strokeDasharray="6 3"
              />
              <text x="38" y="16.5" fontSize="11.5" fill="var(--muted)">
                全市场包络
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="curve-legend" aria-label="作物曲线图例">
        {config.crops.length === 0 && (
          <span className="curve-legend-empty">暂无作物曲线</span>
        )}
        {config.crops.map((crop) => (
          <button
            key={crop.id}
            type="button"
            className={`curve-legend-button ${crop.visible ? "is-visible" : ""}`}
            aria-pressed={crop.visible}
            onClick={() => onToggleCrop(crop.id)}
          >
            <span
              className="curve-swatch"
              style={{
                borderColor: crop.color,
                borderTopStyle: crop.dash ? "dashed" : "solid",
                opacity: crop.visible ? 1 : 0.34,
              }}
            />
            <span>{crop.shortName}</span>
          </button>
        ))}
      </div>

      <div className="curve-readout">
        {boundedHover === null ? (
          <div className="readout-empty">
            在地租曲线上移动，查看各作物在同一距离的竞租差异；悬停地图也会同步标记。
          </div>
        ) : (
          <>
            <div className="readout-lead">
              <span>距离 d</span>
              <strong>{formatDecimal(boundedHover, 2)} km</strong>
            </div>
            {showActualRent && (
              <div className="readout-lead">
                <span>实际地租</span>
                <strong>
                  {formatRent(hoverEnvelope.rent)} 元/ha ·{" "}
                  {hoverEnvelope.crop?.shortName ?? "未耕作"}
                </strong>
              </div>
            )}
            <div className="readout-series">
              {series
                .filter((item) => item.crop.visible)
                .map((item) => (
                  <span key={item.crop.id}>
                    <i style={{ backgroundColor: item.crop.color }} />
                    {item.crop.shortName}
                    <b>{formatRent(valueAtDistance(item, boundedHover))}</b>
                  </span>
                ))}
            </div>
          </>
        )}
      </div>

      <div className="model-reading">
        <div>
          <span className="section-index">读图</span>
          <strong>近郊由「{chartObservations.centralCrop}」主导</strong>
        </div>
        <div>
          <span>在 {chartObservations.midDistance} km 处，最高竞租来自</span>
          <strong>
            {chartObservations.midCrop} · {chartObservations.midMarket}
          </strong>
        </div>
        <div>
          <span>当前剖面最远耕作边际约</span>
          <strong>{formatDecimal(farmableDistance, 1)} km</strong>
        </div>
      </div>
    </div>
  );
}
