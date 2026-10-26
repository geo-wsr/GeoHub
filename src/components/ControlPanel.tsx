import type { ReactNode } from "react";
import { getCropEconomics, formatDecimal, formatRent } from "../rent";
import {
  MAX_CROPS,
  SCENE_PRESETS,
  type ScenePreset,
} from "../presets";
import type { City, CropDefinition, ModelConfig } from "../types";
import { InlineFormula } from "./Formula";

interface RangeControlProps {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  hint?: string;
  digits?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  suffix = "",
  hint,
  digits = 0,
  disabled = false,
  onChange,
}: RangeControlProps) {
  return (
    <label className="range-control">
      <span className="range-heading">
        <span>
          {label}
          {hint && <small>{hint}</small>}
        </span>
        <output>
          {digits > 0
            ? value.toFixed(digits)
            : Math.round(value).toLocaleString("zh-CN")}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export type ControlTab = "scene" | "space" | "crops";

interface ControlPanelProps {
  config: ModelConfig;
  cities: City[];
  selectedMarketId: string;
  activePresetId: ScenePreset["id"];
  activeTab: ControlTab;
  addCityMode: boolean;
  onConfigChange: (config: ModelConfig) => void;
  onCropChange: (
    id: string,
    field: keyof Pick<
      CropDefinition,
      "yieldPerHa" | "pricePerTonne" | "costPerTonne"
    >,
    value: number,
  ) => void;
  onAddCrop: () => void;
  onDeleteCrop: (id: string) => void;
  onRenameCrop: (id: string, name: string) => void;
  onSelectPreset: (id: ScenePreset["id"]) => void;
  onSelectMarket: (id: string) => void;
  onDeleteCity: (id: string) => void;
  onToggleAddCity: () => void;
  onReset: () => void;
  onRandomize: () => void;
  onTabChange: (tab: ControlTab) => void;
  onClose: () => void;
}

export function ControlPanel({
  config,
  cities,
  selectedMarketId,
  activePresetId,
  activeTab,
  addCityMode,
  onConfigChange,
  onCropChange,
  onAddCrop,
  onDeleteCrop,
  onRenameCrop,
  onSelectPreset,
  onSelectMarket,
  onDeleteCity,
  onToggleAddCity,
  onReset,
  onRandomize,
  onTabChange,
  onClose,
}: ControlPanelProps) {
  const activePreset =
    SCENE_PRESETS.find((preset) => preset.id === activePresetId) ??
    SCENE_PRESETS[0];

  return (
    <aside className="control-panel">
      <div className="control-header">
        <div>
          <h2>参数与交互</h2>
        </div>
        <button
          className="panel-collapse"
          type="button"
          aria-label="收起参数侧栏"
          onClick={onClose}
        >
          收起
        </button>
      </div>

      <div className="control-body">
        <nav className="control-tabs" aria-label="参数分类">
          <button
            type="button"
            className={activeTab === "scene" ? "is-active" : ""}
            aria-pressed={activeTab === "scene"}
            onClick={() => onTabChange("scene")}
          >
            场景与运费
          </button>
          <button
            type="button"
            className={activeTab === "space" ? "is-active" : ""}
            aria-pressed={activeTab === "space"}
            onClick={() => onTabChange("space")}
          >
            交通与市场
          </button>
          <button
            type="button"
            className={activeTab === "crops" ? "is-active" : ""}
            aria-pressed={activeTab === "crops"}
            onClick={() => onTabChange("crops")}
          >
            作物参数
          </button>
        </nav>

        {activeTab === "scene" && (
          <div className="control-tab-panel">
        <section className="control-section preset-section">
          <div className="control-section-heading">
            <span>场景预设</span>
            <em>非关卡 · 可随时切换</em>
          </div>
          <div className="preset-grid">
            {SCENE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`preset-card ${preset.id === activePresetId ? "is-active" : ""}`}
                onClick={() => onSelectPreset(preset.id)}
                aria-pressed={preset.id === activePresetId}
              >
                <span>{preset.eyebrow}</span>
                <strong>{preset.name}</strong>
              </button>
            ))}
          </div>
          <p className="preset-summary">{activePreset.summary}</p>
          <div className="panel-actions">
            <button type="button" className="small-button" onClick={onReset}>
              重置参数
            </button>
            <button
              type="button"
              className="small-button small-button--accent"
              onClick={onRandomize}
            >
              随机参数
            </button>
          </div>
        </section>

        <section className="control-section">
          <div className="control-section-heading">
            <span>共同运费率</span>
            <em>元 /（吨·公里）</em>
          </div>
          <RangeControl
            label={
              <>
                全市场运费率 <InlineFormula latex="t" />
              </>
            }
            value={config.freightRate}
            min={40}
            max={180}
            step={5}
            suffix=" 元"
            onChange={(value) =>
              onConfigChange({ ...config, freightRate: value })
            }
          />
          <p className="control-note">
            运费率越高，各地租线越陡，城市影响范围越短。
          </p>
        </section>

        <section className="control-section compact-last">
          <div className="switch-row">
            <span>
              <strong>平滑过渡</strong>
              <small>参数变化时用短时插值移动圈层</small>
            </span>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.animation}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    animation: event.target.checked,
                  })
                }
              />
              <span aria-hidden="true" />
              <b>{config.animation ? "开启" : "关闭"}</b>
            </label>
          </div>
        </section>
          </div>
        )}

        {activeTab === "space" && (
          <div className="control-tab-panel">
        <section className="control-section">
          <div className="control-section-heading">
            <span>交通条件</span>
            <label className="switch">
              <input
                type="checkbox"
                checked={config.traffic.enabled}
                onChange={(event) =>
                  onConfigChange({
                    ...config,
                    traffic: {
                      ...config.traffic,
                      enabled: event.target.checked,
                    },
                  })
                }
              />
              <span aria-hidden="true" />
              <b>{config.traffic.enabled ? "开启" : "关闭"}</b>
            </label>
          </div>

          <div
            className={`traffic-controls ${config.traffic.enabled ? "" : "is-disabled"}`}
          >
            <RangeControl
              label="道路影响强度 λ"
              value={config.traffic.lambda}
              min={0.15}
              max={0.9}
              step={0.01}
              digits={2}
              disabled={!config.traffic.enabled}
              onChange={(value) =>
                onConfigChange({
                  ...config,
                  traffic: { ...config.traffic, lambda: value },
                })
              }
            />
            <RangeControl
              label="影响范围 σ"
              value={config.traffic.sigmaKm}
              min={0.45}
              max={2.5}
              step={0.05}
              digits={2}
              suffix=" km"
              disabled={!config.traffic.enabled}
              onChange={(value) =>
                onConfigChange({
                  ...config,
                  traffic: { ...config.traffic, sigmaKm: value },
                })
              }
            />
            <RangeControl
              label="道路线宽"
              value={config.traffic.lineWidth}
              min={1}
              max={7}
              step={0.5}
              digits={1}
              suffix=" px"
              disabled={!config.traffic.enabled}
              onChange={(value) =>
                onConfigChange({
                  ...config,
                  traffic: { ...config.traffic, lineWidth: value },
                })
              }
            />
          </div>
          <p className="control-note">
            道路附近有效运费率按高斯衰减折减，沿线圈层会显著外推。
          </p>
        </section>

        <section className="control-section">
          <div className="control-section-heading">
            <span>市场中心</span>
            <button
              type="button"
              className={`add-city-button ${addCityMode ? "is-active" : ""}`}
              onClick={onToggleAddCity}
              aria-pressed={addCityMode}
            >
              {addCityMode ? "取消放置" : "＋ 添加城市"}
            </button>
          </div>
          <div className="city-list">
            {cities.map((city, index) => (
              <div
                key={city.id}
                className={`city-list-row ${selectedMarketId === city.id ? "is-selected" : ""}`}
              >
                <button
                  type="button"
                  className="city-select"
                  onClick={() => onSelectMarket(city.id)}
                  aria-pressed={selectedMarketId === city.id}
                >
                  <span
                    className="city-dot"
                    style={{ backgroundColor: city.color }}
                  />
                  <span>
                    <strong>
                      {index + 1}. {city.name}
                    </strong>
                    <small>
                      {city.role === "primary" ? "主市场" : "竞争市场"} ·{" "}
                      {formatDecimal(city.x, 2)} / {formatDecimal(city.y, 2)}
                    </small>
                  </span>
                </button>
                {cities.length > 1 ? (
                  <button
                    type="button"
                    className="city-delete"
                    onClick={() => onDeleteCity(city.id)}
                    aria-label={`删除${city.name}`}
                  >
                    ×
                  </button>
                ) : (
                  <span className="city-fixed" title="至少保留一个市场">
                    保留
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="control-note">
            直接拖动地图上的圆点改变城市位置；点击曲线面板中的市场名可切换观察对象。
          </p>
        </section>
          </div>
        )}

        {activeTab === "crops" && (
          <div className="control-tab-panel">
        <section className="control-section crop-section">
          <div className="control-section-heading">
            <span>作物参数</span>
            <em>实时计算截距与斜率</em>
          </div>
          <div className="crop-list-toolbar">
            <span>{config.crops.length} / {MAX_CROPS} 类作物</span>
            <button
              type="button"
              className="add-crop-button"
              disabled={config.crops.length >= MAX_CROPS}
              onClick={onAddCrop}
            >
              ＋ 添加作物
            </button>
          </div>
          {config.crops.length === 0 && (
            <div className="crop-empty">
              <strong>当前没有作物</strong>
              <span>添加作物后，地图与竞租曲线会立即恢复计算。</span>
            </div>
          )}
          <div className="crop-controls">
            {config.crops.map((crop, cropIndex) => {
              const economics = getCropEconomics(crop, config.freightRate);
              return (
                <details key={crop.id} className="crop-control">
                  <summary>
                    <span
                      className="crop-dot"
                      style={{ backgroundColor: crop.color }}
                    />
                    <span className="crop-summary-title">
                      <input
                        className="crop-name-input"
                        value={crop.name}
                        maxLength={20}
                        aria-label={`重命名${crop.name}`}
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          onRenameCrop(crop.id, event.target.value)
                        }
                      />
                      <small>
                        <InlineFormula
                          latex={`a_{${cropIndex + 1}}=${formatRent(economics.a)}\\quad b_{${cropIndex + 1}}=${formatRent(economics.b)}`}
                        />
                      </small>
                    </span>
                    <button
                      type="button"
                      className="crop-delete-button"
                      aria-label={`删除${crop.name}`}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteCrop(crop.id);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      ×
                    </button>
                    <span className="crop-chevron" aria-hidden="true">
                      参数
                    </span>
                  </summary>
                  <div className="crop-fields">
                    <RangeControl
                      label={
                        <>
                          单产 <InlineFormula latex={`y_{${cropIndex + 1}}`} />
                        </>
                      }
                      value={crop.yieldPerHa}
                      min={1}
                      max={45}
                      step={0.25}
                      digits={2}
                      suffix=" t/ha"
                      onChange={(value) =>
                        onCropChange(crop.id, "yieldPerHa", value)
                      }
                    />
                    <RangeControl
                      label={
                        <>
                          价格 <InlineFormula latex={`p_{${cropIndex + 1}}`} />
                        </>
                      }
                      value={crop.pricePerTonne}
                      min={500}
                      max={3200}
                      step={10}
                      suffix=" 元/t"
                      onChange={(value) =>
                        onCropChange(crop.id, "pricePerTonne", value)
                      }
                    />
                    <RangeControl
                      label={
                        <>
                          成本 <InlineFormula latex={`c_{${cropIndex + 1}}`} />
                        </>
                      }
                      value={crop.costPerTonne}
                      min={200}
                      max={2800}
                      step={10}
                      suffix=" 元/t"
                      onChange={(value) =>
                        onCropChange(crop.id, "costPerTonne", value)
                      }
                    />
                    <div className="economics-strip">
                      <span>
                        <InlineFormula
                          latex={`a_{${cropIndex + 1}}=y_{${cropIndex + 1}}(p_{${cropIndex + 1}}-c_{${cropIndex + 1}})=${formatRent(economics.a)}`}
                        />
                      </span>
                      <span>
                        <InlineFormula
                          latex={`b_{${cropIndex + 1}}=y_{${cropIndex + 1}}t=${formatRent(economics.b)}`}
                        />
                      </span>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
          <p className="control-note">
            可添加、重命名或删除 0–7 类作物；曲线显隐可在地租曲线图例中切换。
          </p>
        </section>
          </div>
        )}
      </div>
    </aside>
  );
}
