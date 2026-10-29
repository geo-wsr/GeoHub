import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon } from "../home/Icons";
import type { Theme } from "../theme";
import { AtmosphereHelpDialog } from "./AtmosphereHelpDialog";
import {
  ForceLatitudeChart,
  WindDeflectionGauge,
} from "./AuxiliaryCharts";
import { ForceCanvas } from "./ForceCanvas";
import { FormulaBlock, InlineMath } from "./FormulaBlock";
import { deriveAtmosphereState, toDisplayF, toDisplayForce } from "./forces";
import {
  ATMOSPHERE_PRESETS,
  cloneConfig,
  getAtmospherePreset,
  randomAtmosphereConfig,
} from "./presets";
import type {
  AtmosphereConfig,
  AtmospherePreset,
  NormalizedPoint,
} from "./types";
import "./atmosphere.css";

interface AtmosphericLabProps {
  theme: Theme;
  onToggleTheme: () => void;
  onBackHome: () => void;
}

interface RangeControlProps {
  label: string;
  symbol?: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  hint: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

const DEFAULT_CENTER: NormalizedPoint = { x: 0.485, y: 0.43 };
const DEFAULT_PRESET = getAtmospherePreset("gradient-low");

const FORCE_INTRO = [
  {
    key: "pressure",
    name: "气压梯度力",
    formula: "−(1/ρ)∇p",
    description: "气压分布不均，将空气由高压推向低压。",
  },
  {
    key: "coriolis",
    name: "地转偏向力",
    formula: "fV",
    description: "地球自转的惯性效应，垂直于运动方向。",
  },
  {
    key: "centrifugal",
    name: "惯性离心力",
    formula: "V²/R",
    description: "曲线运动的视示力，沿曲率半径向外。",
  },
  {
    key: "friction",
    name: "摩擦力",
    formula: "−kV",
    description: "边界层湍流拖曳，与速度方向相反。",
  },
] as const;

function RangeControl({
  label,
  symbol,
  value,
  min,
  max,
  step,
  display,
  hint,
  disabled = false,
  onChange,
}: RangeControlProps) {
  return (
    <label className={`atf-range-control ${disabled ? "is-disabled" : ""}`}>
      <span className="atf-range-heading">
        <span>
          {symbol && <span className="atf-range-symbol">{symbol}</span>}
          {label}
        </span>
        <strong>{display}</strong>
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
      <small>{hint}</small>
    </label>
  );
}

export default function AtmosphericLab({
  theme,
  onToggleTheme,
  onBackHome,
}: AtmosphericLabProps) {
  const [activePresetId, setActivePresetId] = useState<
    AtmospherePreset["id"] | null
  >(DEFAULT_PRESET.id);
  const [basePresetId, setBasePresetId] = useState<AtmospherePreset["id"]>(
    DEFAULT_PRESET.id,
  );
  const [config, setConfig] = useState<AtmosphereConfig>(() =>
    cloneConfig(DEFAULT_PRESET.config),
  );
  const [center, setCenter] = useState<NormalizedPoint>(DEFAULT_CENTER);
  const [formulasOpen, setFormulasOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [animationOn, setAnimationOn] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(() =>
    typeof window === "undefined"
      ? true
      : !window.matchMedia("(max-width: 1080px)").matches,
  );
  const [compactLayout, setCompactLayout] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 1080px)").matches,
  );
  const [announcement, setAnnouncement] = useState("");
  const controlsPanelRef = useRef<HTMLElement>(null);
  const controlsTriggerRef = useRef<HTMLButtonElement>(null);

  const state = useMemo(
    () => deriveAtmosphereState(config, center, 212),
    [center, config],
  );

  const updateConfig = useCallback((patch: Partial<AtmosphereConfig>) => {
    setConfig((current) => ({ ...current, ...patch }));
    setActivePresetId(null);
  }, []);

  const loadPreset = useCallback(
    (preset: AtmospherePreset, announcementText?: string) => {
      setConfig(cloneConfig(preset.config));
      setCenter(DEFAULT_CENTER);
      setActivePresetId(preset.id);
      setBasePresetId(preset.id);
      setAnnouncement(
        announcementText ?? `已载入${preset.name}参数。`,
      );
    },
    [],
  );

  const resetView = useCallback(() => {
    loadPreset(
      getAtmospherePreset(basePresetId),
      "视图中心、动画与参数已恢复。",
    );
    setFormulasOpen(true);
    setAnimationOn(true);
  }, [basePresetId, loadPreset]);

  const resetParameters = useCallback(() => {
    loadPreset(
      getAtmospherePreset(basePresetId),
      "全部物理参数已恢复到当前预设。",
    );
  }, [basePresetId, loadPreset]);

  const randomize = useCallback(() => {
    setConfig((current) => randomAtmosphereConfig(current));
    setActivePresetId(null);
    setAnnouncement("已生成一组新的物理参数，可继续微调。");
  }, []);

  const nearBalance = state.netMagnitude < 3e-5;
  const balanceStatus =
    config.windMode === "balance" &&
    state.balanceSolution &&
    !state.balanceSolution.converged
      ? "平衡近似"
      : nearBalance
        ? config.friction > 1e-7
          ? "边界层平衡"
          : config.geometry === "parallel"
            ? "地转平衡"
            : "梯度风平衡"
        : "合力未归零";
  const modeLabel =
    config.windMode === "balance" ? "平衡反算" : "自由风速";
  const pressureLabel =
    config.geometry === "parallel"
      ? "平行等压线"
      : config.pressureCenter === "low"
        ? "圆形低压"
        : "圆形高压";
  const circulationLabel =
    config.geometry === "circular"
      ? `${config.hemisphere === 1 ? "北半球" : "南半球"} · ${
          config.pressureCenter === "low"
            ? config.hemisphere === 1
              ? "逆时针"
              : "顺时针"
            : config.hemisphere === 1
              ? "顺时针"
              : "逆时针"
        }环流`
      : config.hemisphere === 1
        ? "北半球 · 右偏"
        : "南半球 · 左偏";

  useEffect(() => {
    setAnnouncement(
      `物理状态更新：${pressureLabel}，${balanceStatus}，风速 ${state.windSpeed.toFixed(1)} 米每秒。`,
    );
  }, [balanceStatus, pressureLabel, state.windSpeed]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1080px)");
    const syncLayout = () => setCompactLayout(media.matches);
    syncLayout();
    media.addEventListener("change", syncLayout);
    return () => media.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    if (!controlsOpen || !compactLayout) return;
    const panel = controlsPanelRef.current;
    if (!panel) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector =
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusables = () =>
      [...panel.querySelectorAll<HTMLElement>(focusableSelector)].filter(
        (element) =>
          element.getClientRects().length > 0 &&
          window.getComputedStyle(element).visibility !== "hidden",
      );
    panel.querySelector<HTMLButtonElement>(".atf-panel-close")?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setControlsOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => {
        if (controlsTriggerRef.current) {
          controlsTriggerRef.current.focus();
        } else if (previousFocus instanceof HTMLElement) {
          previousFocus.focus();
        }
      });
    };
  }, [compactLayout, controlsOpen]);

  return (
    <div className="atf-app" data-theme={theme}>
      <header className="atf-topbar">
        <button
          type="button"
          className="atf-brand"
          onClick={onBackHome}
          aria-label="返回泉盒子地理可视化平台首页"
        >
          <span className="atf-brand-mark">泉</span>
          <span>
            <strong>大气水平运动受力实验室</strong>
            <small>QUANHEZI · ATMOSPHERIC DYNAMICS</small>
          </span>
        </button>
        <div className="atf-topbar-meta">
          <span>水平动量 / 单位质量力</span>
          <i aria-hidden="true" />
          <span>浏览器实时向量求解</span>
        </div>
        <div className="atf-topbar-actions">
          <button
            type="button"
            className="atf-icon-button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
            title={theme === "dark" ? "切换到亮色主题" : "切换到暗色主题"}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
          <button
            type="button"
            className="atf-home-button"
            onClick={onBackHome}
          >
            平台首页
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </header>

      <main>
        <section className="atf-hero">
          <div className="atf-hero-copy">
            <h1>
              大气水平运动受力实验室：
              <br />
              <em>从气压梯度力到梯度风</em>
            </h1>
            <p>
              调节气压梯度、纬度、曲率半径与摩擦力，观察四个力如何合成出地转风、
              梯度风与边界层风。
            </p>
          </div>
          <div className="atf-hero-actions" aria-label="页面操作">
            <button type="button" className="atf-button" onClick={resetView}>
              <span aria-hidden="true">↺</span>
              重置视图
            </button>
            <button
              type="button"
              className="atf-button"
              onClick={() => setHelpOpen(true)}
            >
              <span aria-hidden="true">?</span>
              帮助 / 原理说明
            </button>
            <button
              type="button"
              className="atf-button atf-button--primary"
              aria-pressed={formulasOpen}
              onClick={() => setFormulasOpen((open) => !open)}
            >
              {formulasOpen ? "隐藏公式" : "显示公式"}
            </button>
          </div>
          <div className="atf-hero-metrics" aria-label="当前模型摘要">
            <div>
              <span>气压梯度</span>
              <strong>{config.pressureGradientHpa100km.toFixed(2)}</strong>
              <small>hPa / 100 km</small>
            </div>
            <div>
              <span>风速</span>
              <strong>{state.windSpeed.toFixed(1)}</strong>
              <small>m / s</small>
            </div>
            <div>
              <span>合力</span>
              <strong>{toDisplayForce(state.netMagnitude)}</strong>
              <small>10⁻³ m / s²</small>
            </div>
            <div className="atf-hero-status">
              <span>模型状态</span>
              <strong>
                <i />
                {balanceStatus}
              </strong>
              <small>{modeLabel}</small>
            </div>
          </div>
        </section>

        <section className="atf-intro" aria-labelledby="atf-intro-title">
          <div className="atf-intro-main">
            <h2 id="atf-intro-title">
              风不是被某一个力“推出来”
              <br />
              而是四力共同留下的一条轨迹。
            </h2>
            <p>
              气压不均提供初始加速度；地球自转改变运动方向；曲线路径带来惯性离心效应；
              近地面湍流持续耗散动量。改变任一条件，平衡风的大小与方向都会重新确定。
            </p>
          </div>
          <div className="atf-force-intro-grid">
            {FORCE_INTRO.map((force) => (
              <article
                className={`atf-force-intro atf-force-intro--${force.key}`}
                key={force.key}
              >
                <div>
                  <strong>{force.name}</strong>
                </div>
                <code>{force.formula}</code>
                <p>{force.description}</p>
              </article>
            ))}
          </div>
          <div className="atf-balance-strip">
            <div>
              <span>地转平衡</span>
              <strong>Fₚ ↔ F꜀</strong>
              <small>直线 / 等速 / 无摩擦</small>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <span>梯度风平衡</span>
              <strong>Fₚ + F꜀ + C = 0</strong>
              <small>曲线 / 等速 / 无摩擦</small>
            </div>
            <i aria-hidden="true">→</i>
            <div>
              <span>边界层风</span>
              <strong>+ Ff → 偏向低压</strong>
              <small>摩擦参与 / 风斜穿等压线</small>
            </div>
          </div>
        </section>

        {formulasOpen && (
          <section className="atf-formulas" aria-label="核心公式">
            <header>
              <div>
                <h2>所有箭头都由这些关系计算</h2>
              </div>
              <span className="atf-formula-live">
                <i />
                KATEX · LIVE
              </span>
            </header>
            <div className="atf-formula-grid">
              <FormulaBlock
                label="气压梯度力"
                latex={String.raw`\vec{F}_p=-\frac{1}{\rho}\nabla p,\quad G=\frac{1}{\rho}\frac{\Delta p}{\Delta n}`}
              />
              <FormulaBlock
                label="地转偏向力"
                latex={String.raw`\vec{F}_c=-f\hat{k}\times\vec{V},\quad f=2\Omega\sin\varphi`}
              />
              <FormulaBlock
                label="惯性离心力"
                latex={String.raw`C=\frac{V^2}{R}`}
              />
              <FormulaBlock
                label="摩擦力 / 合力"
                latex={String.raw`\vec{F}_f=-k\vec{V},\quad \vec{F}_{\rm net}=\sum\vec{F}`}
              />
            </div>
            <div className="atf-variable-row">
              <span>
                <InlineMath latex="G" />{" "}
                {toDisplayForce(state.forces.pressure.magnitude)}
              </span>
              <span>
                <InlineMath latex="f" /> {toDisplayF(state.coriolisParameter)}
              </span>
              <span>
                <InlineMath latex="V" /> {state.windSpeed.toFixed(1)} m/s
              </span>
              <span>
                <InlineMath latex="R" />{" "}
                {config.geometry === "circular"
                  ? `${config.curvatureKm.toFixed(0)} km`
                  : "∞"}
              </span>
              <span>
                <InlineMath latex="k" />{" "}
                {(config.friction * 10_000).toFixed(1)} × 10⁻⁴ s⁻¹
              </span>
            </div>
          </section>
        )}

        <section
          className={`atf-workspace ${controlsOpen ? "has-controls" : ""}`}
          aria-label="受力与风场交互实验区"
        >
          <div className="atf-main-column">
            <article className="atf-visual-card">
              <header className="atf-card-header">
                <div>
                  <h2>空气质点的实时矢量合成</h2>
                </div>
                <div className="atf-card-status" aria-live="polite">
                  <span className={nearBalance ? "is-balanced" : ""}>
                    <i />
                    {balanceStatus}
                  </span>
                  <button
                    type="button"
                    aria-pressed={animationOn}
                    onClick={() => setAnimationOn((active) => !active)}
                  >
                    流线 {animationOn ? "暂停" : "播放"}
                  </button>
                  {!controlsOpen && (
                    <button
                      ref={controlsTriggerRef}
                      type="button"
                      aria-expanded={false}
                      aria-controls="atmosphere-control-panel"
                      onClick={() => setControlsOpen(true)}
                    >
                      展开参数
                    </button>
                  )}
                </div>
              </header>
              <ForceCanvas
                config={config}
                state={state}
                center={center}
                animationOn={animationOn}
                onCenterChange={setCenter}
                onCurvatureChange={(curvatureKm) =>
                  updateConfig({ curvatureKm })
                }
              />
              <div className="atf-readout-grid">
                <div>
                  <span>场景</span>
                  <strong>{pressureLabel}</strong>
                  <small>{circulationLabel}</small>
                </div>
                <div>
                  <span>科氏参数 f</span>
                  <strong>{toDisplayF(state.coriolisParameter)}</strong>
                  <small>× 10⁻⁴ s⁻¹</small>
                </div>
                <div>
                  <span>与等压线夹角</span>
                  <strong>{Math.abs(state.deflectionAngle).toFixed(1)}°</strong>
                  <small>{config.friction > 1e-7 ? "向低压侧" : "切向"}</small>
                </div>
                <div>
                  <span>合力</span>
                  <strong>{toDisplayForce(state.netMagnitude)}</strong>
                  <small>× 10⁻³ m/s²</small>
                </div>
              </div>
            </article>

            <div className="atf-chart-grid">
              <ForceLatitudeChart state={state} />
              <WindDeflectionGauge state={state} />
            </div>

            <article className="atf-concept-card">
              <div>
                <h2>先看力的方向，再解释风为什么偏</h2>
              </div>
              <div className="atf-concept-columns">
                <section>
                  <strong>半球只改变偏向</strong>
                  <p>
                    北半球地转偏向力指向速度右侧，南半球指向左侧。赤道处{" "}
                    <InlineMath latex="f=0" />，没有地转平衡。
                  </p>
                </section>
                <section>
                  <strong>曲率改变平衡速度</strong>
                  <p>
                    低压中心处离心力向外，高压中心处离心力也向外。它与气压梯度力
                    有时同向、有时反向，因此高、低压的梯度风速度不同。
                  </p>
                </section>
                <section>
                  <strong>摩擦制造入流角</strong>
                  <p>
                    摩擦力使风斜穿等压线并指向低压。自由大气{" "}
                    <InlineMath latex="k=0" /> 时，风恢复近切向的平衡状态。
                  </p>
                </section>
              </div>
            </article>
          </div>

          {controlsOpen && (
            <>
              <button
                type="button"
                className="atf-control-scrim"
                aria-label="关闭参数与控制面板"
                onClick={() => setControlsOpen(false)}
              />
              <aside
                ref={controlsPanelRef}
                id="atmosphere-control-panel"
                className="atf-control-panel"
                aria-label="参数与控制"
                role={compactLayout ? "dialog" : undefined}
                aria-modal={compactLayout ? true : undefined}
              >
                <header>
                  <div>
                    <h2>参数与控制</h2>
                  </div>
                  <button
                    type="button"
                    className="atf-panel-close"
                    onClick={() => setControlsOpen(false)}
                    aria-label="收起参数与控制"
                  >
                    ×
                  </button>
                </header>

                <div className="atf-control-scroll">
                  <section className="atf-control-section">
                    <div className="atf-control-section-title">
                      <span>平衡预设</span>
                      <small>可继续修改</small>
                    </div>
                    <div
                      className="atf-preset-grid"
                      role="group"
                      aria-label="平衡预设"
                    >
                      {ATMOSPHERE_PRESETS.map((preset, index) => (
                        <button
                          type="button"
                          key={preset.id}
                          className={
                            activePresetId === preset.id ? "is-active" : ""
                          }
                          aria-pressed={activePresetId === preset.id}
                          onClick={() => loadPreset(preset)}
                        >
                          <span>0{index + 1}</span>
                          <strong>{preset.shortName}</strong>
                          <small>{preset.description}</small>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="atf-control-section">
                    <div className="atf-control-section-title">
                      <span>求解方式</span>
                      <small>{balanceStatus}</small>
                    </div>
                    <div
                      className="atf-segmented"
                      role="group"
                      aria-label="风速求解方式"
                    >
                      <button
                        type="button"
                        className={
                          config.windMode === "free" ? "is-active" : ""
                        }
                        aria-pressed={config.windMode === "free"}
                        onClick={() =>
                          updateConfig({
                            windMode: "free",
                            windSpeed: state.windSpeed || 10,
                            windAngle: state.windAngle,
                          })
                        }
                      >
                        自由调节 V
                      </button>
                      <button
                        type="button"
                        className={
                          config.windMode === "balance" ? "is-active" : ""
                        }
                        aria-pressed={config.windMode === "balance"}
                        onClick={() => updateConfig({ windMode: "balance" })}
                      >
                        由平衡计算 V
                      </button>
                    </div>
                    {config.windMode === "balance" ? (
                      <div className="atf-computed-wind">
                        <div>
                          <span>反算风速</span>
                          <strong>{state.windSpeed.toFixed(2)} m/s</strong>
                        </div>
                        <div>
                          <span>方向角</span>
                          <strong>{state.windAngle.toFixed(1)}°</strong>
                        </div>
                        <small>
                          {state.balanceSolution?.converged
                            ? `二维牛顿迭代 · 残差 ${toDisplayForce(state.netMagnitude)} × 10⁻³ m/s²`
                            : "当前参数不存在严格零合力，显示最接近的近似解"}
                        </small>
                      </div>
                    ) : (
                      <>
                        <RangeControl
                          label="风速"
                          symbol="V"
                          value={config.windSpeed}
                          min={0}
                          max={35}
                          step={0.1}
                          display={`${config.windSpeed.toFixed(1)} m/s`}
                          hint="自由模式直接设定矢量长度"
                          onChange={(windSpeed) => updateConfig({ windSpeed })}
                        />
                        <RangeControl
                          label="风向角"
                          symbol="θ"
                          value={config.windAngle}
                          min={0}
                          max={359}
                          step={1}
                          display={`${config.windAngle.toFixed(0)}°`}
                          hint="屏幕方向：0° 向右，顺时针增加"
                          onChange={(windAngle) => updateConfig({ windAngle })}
                        />
                      </>
                    )}
                  </section>

                  <section className="atf-control-section">
                    <div className="atf-control-section-title">
                      <span>等压线几何</span>
                      <small>{pressureLabel}</small>
                    </div>
                    <div
                      className="atf-segmented"
                      role="group"
                      aria-label="等压线几何"
                    >
                      <button
                        type="button"
                        className={
                          config.geometry === "parallel" ? "is-active" : ""
                        }
                        aria-pressed={config.geometry === "parallel"}
                        onClick={() =>
                          updateConfig({ geometry: "parallel" })
                        }
                      >
                        平行线
                      </button>
                      <button
                        type="button"
                        className={
                          config.geometry === "circular" ? "is-active" : ""
                        }
                        aria-pressed={config.geometry === "circular"}
                        onClick={() =>
                          updateConfig({ geometry: "circular" })
                        }
                      >
                        圆形线
                      </button>
                    </div>
                    {config.geometry === "circular" && (
                      <div
                        className="atf-segmented atf-segmented--compact"
                        role="group"
                        aria-label="气压中心类型"
                      >
                        <button
                          type="button"
                          className={
                            config.pressureCenter === "low" ? "is-active" : ""
                          }
                          aria-pressed={config.pressureCenter === "low"}
                          onClick={() =>
                            updateConfig({ pressureCenter: "low" })
                          }
                        >
                          低压中心 L
                        </button>
                        <button
                          type="button"
                          className={
                            config.pressureCenter === "high" ? "is-active" : ""
                          }
                          aria-pressed={config.pressureCenter === "high"}
                          onClick={() =>
                            updateConfig({ pressureCenter: "high" })
                          }
                        >
                          高压中心 H
                        </button>
                      </div>
                    )}
                    <div
                      className="atf-segmented atf-segmented--compact"
                      role="group"
                      aria-label="半球"
                    >
                      <button
                        type="button"
                        className={
                          config.hemisphere === 1 ? "is-active" : ""
                        }
                        aria-pressed={config.hemisphere === 1}
                        onClick={() => updateConfig({ hemisphere: 1 })}
                      >
                        北半球
                      </button>
                      <button
                        type="button"
                        className={
                          config.hemisphere === -1 ? "is-active" : ""
                        }
                        aria-pressed={config.hemisphere === -1}
                        onClick={() => updateConfig({ hemisphere: -1 })}
                      >
                        南半球
                      </button>
                    </div>
                  </section>

                  <section className="atf-control-section">
                    <div className="atf-control-section-title">
                      <span>物理参数</span>
                      <small>实时重算</small>
                    </div>
                    <RangeControl
                      label="气压梯度"
                      symbol="Δp/Δn"
                      value={config.pressureGradientHpa100km}
                      min={0.4}
                      max={2.8}
                      step={0.05}
                      display={`${config.pressureGradientHpa100km.toFixed(2)} hPa/100km`}
                      hint="等压线越密，单位质量加速度越大"
                      onChange={(pressureGradientHpa100km) =>
                        updateConfig({ pressureGradientHpa100km })
                      }
                    />
                    <RangeControl
                      label="空气密度"
                      symbol="ρ"
                      value={config.density}
                      min={0.9}
                      max={1.3}
                      step={0.01}
                      display={`${config.density.toFixed(2)} kg/m³`}
                      hint="G = (1/ρ)(Δp/Δn)"
                      onChange={(density) => updateConfig({ density })}
                    />
                    <RangeControl
                      label="纬度"
                      symbol="φ"
                      value={config.latitude}
                      min={0}
                      max={90}
                      step={1}
                      display={`${config.latitude.toFixed(0)}°`}
                      hint="赤道 f = 0；极点旋转效应最强"
                      onChange={(latitude) => updateConfig({ latitude })}
                    />
                    <RangeControl
                      label="曲率半径"
                      symbol="R"
                      value={config.curvatureKm}
                      min={300}
                      max={3_000}
                      step={10}
                      display={
                        config.geometry === "parallel"
                          ? "∞"
                          : `${config.curvatureKm.toFixed(0)} km`
                      }
                      hint="也可以直接拖动主图中的空气质点"
                      disabled={config.geometry === "parallel"}
                      onChange={(curvatureKm) =>
                        updateConfig({ curvatureKm })
                      }
                    />
                    <RangeControl
                      label="摩擦系数"
                      symbol="k"
                      value={config.friction}
                      min={0}
                      max={0.0003}
                      step={0.00001}
                      display={`${(config.friction * 10_000).toFixed(1)} × 10⁻⁴ s⁻¹`}
                      hint="0 为自由大气；增大后风偏向低压"
                      onChange={(friction) => updateConfig({ friction })}
                    />
                    <RangeControl
                      label="等压线间距"
                      value={config.isobarSpacing}
                      min={0.7}
                      max={1.35}
                      step={0.05}
                      display={`${config.isobarSpacing.toFixed(2)}×`}
                      hint="仅调整读图间距，不改变所设气压梯度"
                      onChange={(isobarSpacing) =>
                        updateConfig({ isobarSpacing })
                      }
                    />
                  </section>
                </div>

                <footer className="atf-panel-actions">
                  <button type="button" onClick={resetParameters}>
                    重置参数
                  </button>
                  <button type="button" onClick={randomize}>
                    随机参数
                  </button>
                  <button
                    type="button"
                    className="atf-panel-actions-primary"
                    onClick={() => setHelpOpen(true)}
                  >
                    公式说明
                  </button>
                </footer>
              </aside>
            </>
          )}
        </section>
      </main>

      <footer className="atf-footer">
        <div>
          <span className="atf-brand-mark atf-brand-mark--small">泉</span>
          <p>
            大气水平运动受力实验室 · 教学简化模型，数值用于解释力平衡，
            不构成特定地点或时刻的风预报。
          </p>
        </div>
        <button type="button" onClick={onBackHome}>
          返回平台首页 ↑
        </button>
      </footer>

      <AtmosphereHelpDialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
      />
      <div className="atf-sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
