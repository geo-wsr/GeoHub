import { useEffect, useMemo, useRef, useState } from "react";
import { useElementSize } from "../hooks/useElementSize";
import {
  INTENSITY_INPUT_MAX,
  INTENSITY_INPUT_MIN,
  buildIntensityProfile,
  calculateIntensity,
} from "../intensity";
import { formatDecimal, formatRent } from "../rent";
import type { City, ModelConfig, Road } from "../types";
import { InlineFormula } from "./Formula";

interface IntensityLabProps {
  cities: City[];
  roads: Road[];
  config: ModelConfig;
  selectedMarketId: string;
}

export function IntensityLab({
  cities,
  roads,
  config,
  selectedMarketId,
}: IntensityLabProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartSize = useElementSize(chartRef, { width: 720, height: 260 });
  const [selectedCropId, setSelectedCropId] = useState(
    config.crops[0]?.id ?? "",
  );
  const [distanceKm, setDistanceKm] = useState(2.5);
  const [inputPrice, setInputPrice] = useState(5000);

  const selectedCrop =
    config.crops.find((crop) => crop.id === selectedCropId) ??
    config.crops[0];
  const selectedCropIndex = selectedCrop
    ? config.crops.findIndex((crop) => crop.id === selectedCrop.id) + 1
    : 0;
  const selectedCity =
    cities.find((city) => city.id === selectedMarketId) ?? cities[0];
  const maxDistance = selectedCrop
    ? Math.max(
        3,
        Math.min(
          12,
          Math.ceil(
            (selectedCrop.pricePerTonne /
              Math.max(1, config.freightRate)) *
              1.05,
          ),
        ),
      )
    : 12;

  useEffect(() => {
    if (
      selectedCropId &&
      config.crops.some((crop) => crop.id === selectedCropId)
    ) {
      return;
    }
    setSelectedCropId(config.crops[0]?.id ?? "");
  }, [config.crops, selectedCropId]);

  useEffect(() => {
    setDistanceKm((current) => Math.min(current, maxDistance));
  }, [maxDistance]);

  const result =
    selectedCrop && selectedCity
      ? calculateIntensity(
          selectedCrop,
          selectedCity,
          config,
          roads,
          distanceKm,
          inputPrice,
        )
      : null;

  const profile = useMemo(
    () =>
      selectedCrop && selectedCity
        ? buildIntensityProfile(
            selectedCrop,
            selectedCity,
            config,
            roads,
            maxDistance,
            inputPrice,
          )
        : [],
    [
      config,
      inputPrice,
      maxDistance,
      roads,
      selectedCity,
      selectedCrop,
    ],
  );

  const chartWidth = Math.max(320, chartSize.width);
  const chartHeight = chartSize.width < 480 ? 290 : 340;
  const plot = {
    left: 50,
    top: 24,
    right: chartWidth - 18,
    bottom: chartHeight - 42,
  };
  const maxInput = Math.max(
    1,
    ...profile.map((point) => point.optimalInput),
  );
  const yMax = Math.ceil(maxInput * 1.15);
  const sx = (distance: number) =>
    plot.left +
    (distance / Math.max(maxDistance, 0.001)) *
      (plot.right - plot.left);
  const sy = (value: number) =>
    plot.bottom -
    (Math.max(0, value) / yMax) * (plot.bottom - plot.top);
  const profilePath = profile
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"}${sx(point.d).toFixed(1)},${sy(point.optimalInput).toFixed(1)}`,
    )
    .join("");

  const xTicks = [0, maxDistance / 3, (maxDistance * 2) / 3, maxDistance];
  const yTicks = [0, yMax / 2, yMax];

  if (!selectedCrop || !selectedCity) {
    return (
      <section className="card intensity-card">
        <div className="empty-state">
          <strong>暂无作物，无法计算集约程度</strong>
          <span>请先在图例或侧栏中添加作物。</span>
        </div>
      </section>
    );
  }

  return (
    <section className="card intensity-card" aria-labelledby="intensity-title">
      <header className="intensity-header">
        <div>
          <div className="section-kicker">
            <span className="section-index">04</span>
            <span>投入强度</span>
          </div>
          <h2 id="intensity-title">集约程度如何随距离变化？</h2>
        </div>
        <p>
          最优投入出现在边际收益等于投入价格处。道路降低有效运费，会把集约经营进一步向外延伸。
        </p>
      </header>

      <div className="intensity-layout">
        <div className="intensity-controls">
          <label className="intensity-select">
            <span>观察作物</span>
            <select
              value={selectedCrop.id}
              onChange={(event) => setSelectedCropId(event.target.value)}
            >
              {config.crops.map((crop, index) => (
                <option key={crop.id} value={crop.id}>
                  {index + 1}. {crop.name}
                </option>
              ))}
            </select>
          </label>

          <label className="intensity-range">
            <span>
              距市场距离 <InlineFormula latex="d" />
              <output>{formatDecimal(distanceKm, 1)} km</output>
            </span>
            <input
              type="range"
              min={0}
              max={maxDistance}
              step={0.1}
              value={distanceKm}
              onChange={(event) => setDistanceKm(Number(event.target.value))}
            />
          </label>

          <label className="intensity-range">
            <span>
              投入价格 <InlineFormula latex="w" />
              <output>{formatRent(inputPrice)} 元</output>
            </span>
            <input
              type="range"
              min={INTENSITY_INPUT_MIN}
              max={INTENSITY_INPUT_MAX}
              step={500}
              value={inputPrice}
              onChange={(event) => setInputPrice(Number(event.target.value))}
            />
          </label>

        </div>

        <div className="intensity-results" aria-live="polite">
          <div>
            <span>有效运费率 <InlineFormula latex="t_{eff}" /></span>
            <strong>{formatDecimal(result?.effFreightRate ?? 0, 1)} 元/(t·km)</strong>
          </div>
          <div>
            <span>
              市场净价{" "}
              <InlineFormula
                latex={`p_{${selectedCropIndex}}-t_{eff}d`}
              />
            </span>
            <strong>{formatDecimal(result?.netPrice ?? 0, 1)} 元/t</strong>
          </div>
          <div className="intensity-k">
            <span>
              最优投入强度{" "}
              <InlineFormula latex={`k_{${selectedCropIndex}}^*`} />
            </span>
            <strong>{formatDecimal(result?.optimalInput ?? 0, 2)}</strong>
          </div>
          <div className="intensity-output">
            <span>
              最优单产{" "}
              <InlineFormula
                latex={`q_{${selectedCropIndex}}(k_{${selectedCropIndex}}^*)`}
              />
            </span>
            <strong>{formatDecimal(result?.optimalOutput ?? 0, 2)} t/ha</strong>
          </div>
          <div className="intensity-profit">
            <span>
              单位面积净收益{" "}
              <InlineFormula latex={`\\pi_{${selectedCropIndex}}^*`} />
            </span>
            <strong>{formatRent(result?.profit ?? 0)} 元/ha</strong>
          </div>
        </div>

        <div className="intensity-chart">
          <div className="intensity-chart-head">
            <strong>最优投入强度剖面</strong>
            <span>沿 {selectedCity.name} 向东剖面</span>
          </div>
          <div ref={chartRef}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              role="img"
              aria-labelledby="intensity-chart-title intensity-chart-desc"
            >
              <title id="intensity-chart-title">最优投入强度随距离变化图</title>
              <desc id="intensity-chart-desc">
                随着距离增加，最优投入强度通常下降；交通线附近的有效运费较低，因此投入强度可能升高。
              </desc>
              <rect
                x={plot.left}
                y={plot.top}
                width={plot.right - plot.left}
                height={plot.bottom - plot.top}
                fill="var(--chart-paper)"
                stroke="var(--border)"
                rx="3"
              />
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={plot.left}
                    x2={plot.right}
                    y1={sy(tick)}
                    y2={sy(tick)}
                    stroke="var(--border)"
                    strokeWidth="0.7"
                    strokeDasharray="2 5"
                  />
                  <text
                    x={plot.left - 8}
                    y={sy(tick) + 4}
                    textAnchor="end"
                    fontSize="11.5"
                    fill="var(--muted)"
                  >
                    {formatDecimal(tick, 1)}
                  </text>
                </g>
              ))}
              {xTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={sx(tick)}
                    x2={sx(tick)}
                    y1={plot.bottom}
                    y2={plot.bottom + 5}
                    stroke="var(--chart-axis)"
                  />
                  <text
                    x={sx(tick)}
                    y={plot.bottom + 19}
                    textAnchor="middle"
                    fontSize="11.5"
                    fill="var(--muted)"
                  >
                    {formatDecimal(tick, 1)}
                  </text>
                </g>
              ))}
              <text
                x={(plot.left + plot.right) / 2}
                y={chartHeight - 9}
                textAnchor="middle"
                fontSize="12.5"
                fill="var(--ink)"
              >
                距市场距离 <tspan fontStyle="italic">d</tspan>（km）
              </text>
              <text
                x="13"
                y={(plot.top + plot.bottom) / 2}
                transform={`rotate(-90 13 ${(plot.top + plot.bottom) / 2})`}
                textAnchor="middle"
                fontSize="12.5"
                fill="var(--ink)"
              >
                最优投入强度 <tspan fontStyle="italic">k</tspan>
              </text>

              <defs>
                <clipPath id="intensity-plot-clip">
                  <rect
                    x={plot.left}
                    y={plot.top}
                    width={plot.right - plot.left}
                    height={plot.bottom - plot.top}
                  />
                </clipPath>
              </defs>

              <g clipPath="url(#intensity-plot-clip)">
                <path
                  d={`${profilePath}L${sx(maxDistance)},${plot.bottom}L${sx(0)},${plot.bottom}Z`}
                  fill={selectedCrop.fill}
                  opacity="0.55"
                />
                <path
                  d={profilePath}
                  fill="none"
                  stroke={selectedCrop.color}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1={sx(distanceKm)}
                  x2={sx(distanceKm)}
                  y1={plot.top}
                  y2={plot.bottom}
                  stroke="#C65D3B"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
                <circle
                  cx={sx(distanceKm)}
                  cy={sy(result?.optimalInput ?? 0)}
                  r="4.5"
                  fill="#C65D3B"
                  stroke="var(--paper)"
                  strokeWidth="2"
                />
              </g>
            </svg>
          </div>
          <p>
            近市场或道路附近，保留净价较高，最优投入强度更高；向外围延伸时，
            <InlineFormula latex={`k_{${selectedCropIndex}}^*`} /> 逐步下降，
            形成杜能式集约度梯度。
          </p>
        </div>

        <div className="intensity-formulas" aria-label="集约程度计算公式">
          <div className="intensity-formula-stack">
            <div>
              <span>生产响应</span>
              <InlineFormula
                latex={`q_{${selectedCropIndex}}(k)=Q_{${selectedCropIndex}}(1-e^{-k})`}
              />
            </div>
            <div>
              <span>净收益</span>
              <InlineFormula
                latex={`\\pi_{${selectedCropIndex}}=(p_{${selectedCropIndex}}-t_{eff}d)q_{${selectedCropIndex}}(k)-wk`}
              />
            </div>
            <div>
              <span>最优条件</span>
              <InlineFormula
                latex={`(p_{${selectedCropIndex}}-t_{eff}d)Q_{${selectedCropIndex}}e^{-k}=w`}
              />
            </div>
          </div>
          <div className="intensity-formula-featured">
            <span>投入强度</span>
            <InlineFormula
              latex={`k_{${selectedCropIndex}}^*=\\max\\left\\{0,\\ln R_{${selectedCropIndex}}\\right\\}`}
            />
            <InlineFormula
              className="intensity-formula-definition"
              latex={`R_{${selectedCropIndex}}=\\frac{(p_{${selectedCropIndex}}-t_{eff}d)Q_{${selectedCropIndex}}}{w}`}
            />
            <small>
              <InlineFormula
                latex={`Q_{${selectedCropIndex}}=1.6y_{${selectedCropIndex}}`}
              />
            </small>
          </div>
        </div>
      </div>
    </section>
  );
}
