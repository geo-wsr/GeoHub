import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ControlPanel,
  type ControlTab,
} from "./components/ControlPanel";
import { Formula, InlineFormula } from "./components/Formula";
import { HelpDialog } from "./components/HelpDialog";
import { InlineCropEditor } from "./components/InlineCropEditor";
import { IntensityLab } from "./components/IntensityLab";
import { MapCanvas, type MapProbe } from "./components/MapCanvas";
import { RentChart } from "./components/RentChart";
import { useAnimatedModel } from "./hooks/useAnimatedModel";
import { Icon } from "./home/Icons";
import {
  CITY_COLORS,
  MAX_CROPS,
  SCENE_PRESETS,
  cloneConfig,
  createNewCrop,
  createRandomConfig,
  getPreset,
  type ScenePreset,
} from "./presets";
import { MODEL_ASPECT, formatRent, getCropEconomics } from "./rent";
import type {
  City,
  CropDefinition,
  MapTool,
  ModelConfig,
  NormalizedPoint,
  Road,
} from "./types";
import type { Theme } from "./theme";

const initialPreset = SCENE_PRESETS[0];

interface UndoSnapshot {
  label: string;
  activePresetId: ScenePreset["id"];
  config: ModelConfig;
  cities: City[];
  roads: Road[];
  selectedMarketId: string;
}

interface AppProps {
  theme: Theme;
  onBackHome: () => void;
  onToggleTheme: () => void;
}

export default function App({
  theme,
  onBackHome,
  onToggleTheme,
}: AppProps) {
  const [activePresetId, setActivePresetId] = useState<
    ScenePreset["id"]
  >(initialPreset.id);
  const [config, setConfig] = useState<ModelConfig>(() =>
    cloneConfig(initialPreset.config),
  );
  const [cities, setCities] = useState<City[]>(() =>
    initialPreset.cities.map((city) => ({ ...city })),
  );
  const [roads, setRoads] = useState<Road[]>(() =>
    initialPreset.roads.map((road) => ({
      ...road,
      points: road.points.map((point) => ({ ...point })),
    })),
  );
  const [selectedMarketId, setSelectedMarketId] = useState(
    initialPreset.cities[0].id,
  );
  const [helpOpen, setHelpOpen] = useState(false);
  const [mapTool, setMapTool] = useState<MapTool>("move");
  const [mapProbe, setMapProbe] = useState<MapProbe | null>(null);
  const [inlineCropId, setInlineCropId] = useState<string | null>(null);
  const [controlTab, setControlTab] = useState<ControlTab>("scene");
  const [controlsCollapsed, setControlsCollapsed] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(max-width: 1240px)").matches,
  );
  const [mapViewResetKey, setMapViewResetKey] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [undoSnapshot, setUndoSnapshot] = useState<UndoSnapshot | null>(
    null,
  );
  const animatedConfig = useAnimatedModel(config);
  const activeScene =
    SCENE_PRESETS.find((scene) => scene.id === activePresetId) ??
    SCENE_PRESETS[0];

  const openControlPanel = useCallback((tab?: ControlTab) => {
    if (tab) setControlTab(tab);
    setControlsCollapsed(false);
  }, []);

  const selectedCity =
    cities.find((city) => city.id === selectedMarketId) ?? cities[0];

  const recordUndo = useCallback(
    (label: string) => {
      setUndoSnapshot({
        label,
        activePresetId,
        config: cloneConfig(config),
        cities: cities.map((city) => ({ ...city })),
        roads: roads.map((road) => ({
          ...road,
          points: road.points.map((point) => ({ ...point })),
        })),
        selectedMarketId,
      });
    },
    [activePresetId, cities, config, roads, selectedMarketId],
  );

  const applyPreset = useCallback((id: ScenePreset["id"], message: string) => {
    const preset = getPreset(id);
    setActivePresetId(id);
    setConfig(cloneConfig(preset.config));
    setCities(preset.cities.map((city) => ({ ...city })));
    setRoads(
      preset.roads.map((road) => ({
        ...road,
        points: road.points.map((point) => ({ ...point })),
      })),
    );
    setSelectedMarketId(preset.cities[0].id);
    setMapProbe(null);
    setInlineCropId(null);
    setMapTool("move");
    setMapViewResetKey((key) => key + 1);
    setAnnouncement(message);
  }, []);

  const loadPreset = useCallback(
    (
      id: ScenePreset["id"],
      options?: { undoLabel?: string; announcement?: string },
    ) => {
      const preset = getPreset(id);
      recordUndo(options?.undoLabel ?? `切换到${preset.name}`);
      applyPreset(
        id,
        options?.announcement ?? `已载入${preset.name}场景。`,
      );
    },
    [applyPreset, recordUndo],
  );

  const resetView = useCallback(() => {
    loadPreset(activePresetId, {
      undoLabel: "重置视图",
      announcement:
        "所有参数、地图视图和图层状态已恢复到当前场景预设；可使用撤销恢复。",
    });
    setControlTab("scene");
  }, [activePresetId, loadPreset]);

  const resetParameters = useCallback(() => {
    loadPreset(activePresetId, {
      undoLabel: "重置参数",
      announcement: "参数、作物与城市已恢复；可使用撤销恢复此前设置。",
    });
  }, [activePresetId, loadPreset]);

  const randomizeParameters = useCallback(() => {
    recordUndo("随机生成作物参数");
    setConfig((current) => createRandomConfig(current));
    setAnnouncement("已生成一组随机作物参数，可继续微调。");
  }, [recordUndo]);

  const handleCropChange = useCallback(
    (
      id: string,
      field: keyof Pick<
        CropDefinition,
        "yieldPerHa" | "pricePerTonne" | "costPerTonne"
      >,
      value: number,
    ) => {
      setConfig((current) => ({
        ...current,
        crops: current.crops.map((crop) =>
          crop.id === id ? { ...crop, [field]: value } : crop,
        ),
      }));
    },
    [],
  );

  const handleToggleCrop = useCallback((id: string) => {
    setConfig((current) => ({
      ...current,
      crops: current.crops.map((crop) =>
        crop.id === id ? { ...crop, visible: !crop.visible } : crop,
      ),
    }));
    setAnnouncement("作物曲线显隐已切换。");
  }, []);

  const handleAddCrop = useCallback(() => {
    setConfig((current) => {
      if (current.crops.length >= MAX_CROPS) return current;
      return {
        ...current,
        crops: [...current.crops, createNewCrop(current.crops)],
      };
    });
    setAnnouncement("已添加作物，可继续修改名称和参数。");
  }, []);

  const handleDeleteCrop = useCallback(
    (id: string) => {
      const crop = config.crops.find((item) => item.id === id);
      if (!crop) return;
      recordUndo(`删除作物“${crop.name}”`);
      setConfig((current) => ({
        ...current,
        crops: current.crops.filter((item) => item.id !== id),
      }));
      setInlineCropId((current) => (current === id ? null : current));
      setAnnouncement(`已删除作物“${crop.name}”；可使用撤销恢复。`);
    },
    [config.crops, recordUndo],
  );

  const handleRenameCrop = useCallback((id: string, name: string) => {
    const nextName = name.slice(0, 20);
    setConfig((current) => ({
      ...current,
      crops: current.crops.map((crop) =>
        crop.id === id
          ? {
              ...crop,
              name: nextName,
              shortName: nextName || "未命名作物",
            }
          : crop,
      ),
    }));
  }, []);

  const handleSelectMarket = useCallback((id: string) => {
    setSelectedMarketId(id);
    setAnnouncement("已切换地租曲线对应的市场。");
  }, []);

  const handleDeleteCity = useCallback(
    (id: string) => {
      const target = cities.find((city) => city.id === id);
      if (!target) return;
      if (cities.length <= 1) {
        setAnnouncement("至少保留一座市场；可先添加新城市后再删除。");
        return;
      }
      recordUndo(`删除市场“${target.name}”`);
      const withoutTarget = cities.filter((city) => city.id !== id);
      const remaining = withoutTarget.map((city, index) =>
        index === 0 ? { ...city, role: "primary" as const } : city,
      );
      setCities(remaining);
      if (selectedMarketId === id) setSelectedMarketId(remaining[0].id);
      setMapProbe(null);
      setAnnouncement(`已删除${target.name}；可使用撤销恢复。`);
    },
    [cities, recordUndo, selectedMarketId],
  );

  const handleAddCity = useCallback(
    (point: NormalizedPoint) => {
      const maxIndex = cities.reduce((max, city) => {
        const match = city.id.match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const city: City = {
        id: `market-${maxIndex + 1}`,
        name: `新市场 ${cities.length + 1}`,
        x: point.x,
        y: point.y,
        role: "secondary",
        color: CITY_COLORS[(cities.length + 1) % CITY_COLORS.length],
      };
      setCities((current) => [...current, city]);
      setSelectedMarketId(city.id);
      setAnnouncement(`已新增${city.name}，并切换为曲线观察市场。`);
    },
    [cities],
  );

  const handleAddRoad = useCallback(
    (points: NormalizedPoint[]) => {
      if (points.length < 2) return;
      const maxIndex = roads.reduce((max, road) => {
        const match = road.id.match(/(\d+)$/);
        return match ? Math.max(max, Number(match[1])) : max;
      }, 0);
      const road: Road = {
        id: `road-${maxIndex + 1}`,
        name: `交通线 ${maxIndex + 1}`,
        points,
      };
      setRoads((current) => [...current, road]);
      setConfig((current) => ({
        ...current,
        traffic: { ...current.traffic, enabled: true },
      }));
      setAnnouncement("已添加交通线并开启运费折减。");
    },
    [roads],
  );

  const handleDeleteRoad = useCallback(
    (id: string) => {
      const road = roads.find((item) => item.id === id);
      if (!road) return;
      recordUndo(`删除${road.name}`);
      const remaining = roads.filter((road) => road.id !== id);
      setRoads(remaining);
      if (remaining.length === 0) {
        setConfig((model) => ({
          ...model,
          traffic: { ...model.traffic, enabled: false },
        }));
      }
      setAnnouncement(`已删除${road.name}；可使用撤销恢复。`);
    },
    [recordUndo, roads],
  );

  const undoLastAction = useCallback(() => {
    if (!undoSnapshot) return;
    setActivePresetId(undoSnapshot.activePresetId);
    setConfig(cloneConfig(undoSnapshot.config));
    setCities(undoSnapshot.cities.map((city) => ({ ...city })));
    setRoads(
      undoSnapshot.roads.map((road) => ({
        ...road,
        points: road.points.map((point) => ({ ...point })),
      })),
    );
    setSelectedMarketId(undoSnapshot.selectedMarketId);
    setMapProbe(null);
    setInlineCropId(null);
    setMapTool("move");
    setMapViewResetKey((key) => key + 1);
    setAnnouncement(`已撤销：${undoSnapshot.label}。`);
    setUndoSnapshot(null);
  }, [undoSnapshot]);

  useEffect(() => {
    if (!undoSnapshot) return;
    const timer = window.setTimeout(() => setUndoSnapshot(null), 10_000);
    return () => window.clearTimeout(timer);
  }, [undoSnapshot]);

  const legendRows = useMemo(
    () =>
      config.crops.map((crop) => ({
        crop,
        economics: getCropEconomics(crop, config.freightRate),
      })),
    [config],
  );
  const inlineCrop =
    config.crops.find((crop) => crop.id === inlineCropId) ?? null;

  return (
    <div className="app-shell" data-theme={theme}>
      <header className="topbar">
        <a className="brand" href="#home" aria-label="返回平台首页">
          <span className="brand-mark">泉</span>
          <span>
            <strong>泉盒子的GeoHub</strong>
            <small>PLATFORM · ECONOMIC GEOGRAPHY</small>
          </span>
        </a>
        <div className="topbar-actions">
          <button
            className="app-home-button"
            onClick={onBackHome}
            type="button"
          >
            可视化实验室
          </button>
          <div className="topbar-meta">
            <span>约翰·海因里希·冯·杜能 · 1826</span>
            <span className="meta-divider" aria-hidden="true" />
            <span>教学模型 / 浏览器实时计算</span>
          </div>
          <button
            type="button"
            className="app-theme-toggle"
            aria-label={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
            onClick={onToggleTheme}
          >
            <Icon name={theme === "dark" ? "sun" : "moon"} size={17} />
          </button>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <h1>
              杜能圈交互实验室：
              <br />
              <span>地租、距离与农业区位</span>
            </h1>
            <p className="hero-subtitle">
              调整运费率、作物参数、交通线和城市位置，观察农业圈层如何变化。
            </p>
          </div>
          <div className="hero-actions" aria-label="页面操作">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setHelpOpen(true)}
            >
              <span aria-hidden="true">?</span> 帮助 / 原理说明
            </button>
          </div>
        </section>

        <section className="intro-card" aria-labelledby="intro-title">
          <div className="intro-copy">
            <div className="section-kicker">
              <span className="section-index">01</span>
              <span>从“孤立国”到一块地</span>
            </div>
            <h2 id="intro-title">
              同一片平原上，为什么越靠近城市，土地经营得越精细？
            </h2>
            <p>
              冯·杜能假设一个与外界隔绝的“孤立国”：平原中央只有一座城市，
              土地肥沃、地形和技术相同，农户把农产品运往唯一的市场。区位不同，
              运费不同；扣除生产与运输成本后剩余的地租，决定了每块地最合适的用途。
            </p>
            <div className="intro-tags" aria-label="模型关键词">
              <span>均质平原</span>
              <span>唯一市场</span>
              <span>运费随距离递增</span>
              <span>最高竞租决定用途</span>
            </div>
          </div>

          <div className="intro-formula">
            <div className="formula-header">
              <div>
                <strong>区位地租函数</strong>
              </div>
              <span className="formula-status">LIVE</span>
            </div>
            <Formula />
            <div className="symbol-grid" aria-label="公式变量说明">
              <span>
                <InlineFormula latex="y_i" /> 单产
              </span>
              <span>
                <InlineFormula latex="p_i" /> 价格
              </span>
              <span>
                <InlineFormula latex="c_i" /> 成本
              </span>
              <span>
                <InlineFormula latex="t" /> 运费率
              </span>
              <span>
                <InlineFormula latex="d" /> 距离
              </span>
              <span>
                <InlineFormula latex="R_i" /> 地租
              </span>
            </div>
          </div>

          <div className="model-chain" aria-label="模型推导链">
            <div>
              <span>01</span>
              <strong>到市场距离</strong>
              <small>
                空间位置 <InlineFormula latex="d" />
              </small>
            </div>
            <span className="chain-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <span>02</span>
              <strong>运输成本</strong>
              <small>
                <InlineFormula latex="y_i\,t\,d" />
              </small>
            </div>
            <span className="chain-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <span>03</span>
              <strong>可支付地租</strong>
              <small>
                <InlineFormula latex="a_i-b_id" />
              </small>
            </div>
            <span className="chain-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <span>04</span>
              <strong>最高竞租者</strong>
              <small>
                <InlineFormula latex="\max_{i,k}R_i^k(x)" />
              </small>
            </div>
          </div>
        </section>

        <section
          className={`workspace ${controlsCollapsed ? "is-control-collapsed" : ""}`}
          aria-label="交互实验区"
        >
          <div className="visual-pair">
            <article className="card map-card">
              <header className="card-header map-card-header">
                <div>
                  <div className="section-kicker">
                    <span className="section-index">02</span>
                    <span>空间格局</span>
                  </div>
                  <h2>市场中心与农业圈层</h2>
                </div>
              </header>

              <div className="map-command-bar" aria-label="地图快捷操作">
                <div className="map-tool-row">
                  <div className="map-toolset" role="group" aria-label="地图工具">
                    <button
                      type="button"
                      className={`map-tool-button ${mapTool === "move" ? "is-active" : ""}`}
                      aria-pressed={mapTool === "move"}
                      onClick={() => setMapTool("move")}
                    >
                      <span aria-hidden="true">✥</span>
                      移动
                    </button>
                    <button
                      type="button"
                      className={`map-tool-button ${mapTool === "drawRoad" ? "is-active" : ""}`}
                      aria-pressed={mapTool === "drawRoad"}
                      onClick={() => setMapTool("drawRoad")}
                    >
                      <span aria-hidden="true">╱</span>
                      画道路
                    </button>
                    <button
                      type="button"
                      className={`map-tool-button ${mapTool === "addCity" ? "is-active" : ""}`}
                      aria-pressed={mapTool === "addCity"}
                      onClick={() => setMapTool("addCity")}
                    >
                      <span aria-hidden="true">＋</span>
                      添加城市
                    </button>
                    <button
                      type="button"
                      className={`map-tool-button map-tool-button--delete ${mapTool === "delete" ? "is-active" : ""}`}
                      aria-pressed={mapTool === "delete"}
                      onClick={() => setMapTool("delete")}
                    >
                      <span aria-hidden="true">×</span>
                      删除
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`map-traffic-toggle ${config.traffic.enabled ? "is-active" : ""}`}
                    aria-pressed={config.traffic.enabled}
                    disabled={roads.length === 0}
                    onClick={() =>
                      setConfig((current) => ({
                        ...current,
                        traffic: {
                          ...current.traffic,
                          enabled: !current.traffic.enabled,
                        },
                      }))
                    }
                  >
                    <span className="command-glyph command-glyph--road" aria-hidden="true">━</span>
                    <span>
                      <small>{roads.length} 条道路</small>
                      <strong>
                        {roads.length === 0
                          ? "先画道路"
                          : config.traffic.enabled
                            ? "折减开启"
                            : "折减关闭"}
                      </strong>
                    </span>
                  </button>
                </div>
                <div className="map-utility-row">
                  <button
                    type="button"
                    className="command-text-button"
                    onClick={resetView}
                  >
                    ↺ 重置视图
                  </button>
                  <button
                    type="button"
                    className="command-text-button"
                    onClick={() => openControlPanel("scene")}
                  >
                    场景：{activeScene.name}
                  </button>
                  <button
                    type="button"
                    className="command-text-button"
                    onClick={() => openControlPanel("crops")}
                  >
                    作物参数
                  </button>
                  <button
                    type="button"
                    className="command-text-button command-text-button--strong"
                    aria-expanded={!controlsCollapsed}
                    onClick={() =>
                      controlsCollapsed
                        ? openControlPanel(controlTab)
                        : setControlsCollapsed(true)
                    }
                  >
                    {controlsCollapsed ? "展开侧栏" : "收起侧栏"}
                  </button>
                </div>
              </div>

              <MapCanvas
                cities={cities}
                roads={roads}
                config={animatedConfig}
                selectedMarketId={selectedMarketId}
                mapTool={mapTool}
                viewResetKey={mapViewResetKey}
                onCitiesChange={setCities}
                onRoadsChange={setRoads}
                onAddRoad={handleAddRoad}
                onDeleteRoad={handleDeleteRoad}
                onDeleteCity={handleDeleteCity}
                onSelectMarket={handleSelectMarket}
                onAddCity={handleAddCity}
                onProbeChange={setMapProbe}
              />

              <div className="map-legend" aria-labelledby="legend-title">
                <div className="legend-heading">
                  <div>
                    <h3 id="legend-title">图例与当前竞租参数</h3>
                  </div>
                  <span className="legend-note">
                    点击图例项可就地调整作物参数；曲线沿用同色和线型。
                  </span>
                </div>
                {legendRows.length === 0 ? (
                  <div className="empty-state">
                    <strong>尚未添加作物</strong>
                    <span>展开侧栏并切换到“作物参数”，添加 1–7 类作物。</span>
                  </div>
                ) : (
                  <div className="legend-grid">
                    {legendRows.map(({ crop, economics }, index) => (
                      <button
                        type="button"
                        className={`legend-item ${inlineCropId === crop.id ? "is-editing" : ""}`}
                        key={crop.id}
                        aria-pressed={inlineCropId === crop.id}
                        onClick={() =>
                          setInlineCropId((current) =>
                            current === crop.id ? null : crop.id,
                          )
                        }
                      >
                        <span
                          className="legend-swatch"
                          style={{
                            backgroundColor: crop.fill,
                            borderColor: crop.color,
                          }}
                        />
                        <span className="legend-name">
                          <strong>
                            {index + 1}. {crop.name}
                          </strong>
                          <small>
                            <InlineFormula
                              latex={`a_{${index + 1}}=${formatRent(economics.a)}`}
                            />
                          </small>
                        </span>
                        <span className="legend-b">
                          <InlineFormula
                            latex={`b_{${index + 1}}=${formatRent(economics.b)}`}
                          />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {inlineCrop && (
                  <InlineCropEditor
                    crop={inlineCrop}
                    cropIndex={
                      config.crops.findIndex(
                        (crop) => crop.id === inlineCrop.id,
                      ) + 1
                    }
                    freightRate={config.freightRate}
                    onChange={(field, value) =>
                      handleCropChange(inlineCrop.id, field, value)
                    }
                    onRename={(name) => handleRenameCrop(inlineCrop.id, name)}
                    onDelete={() => handleDeleteCrop(inlineCrop.id)}
                    onClose={() => setInlineCropId(null)}
                  />
                )}
                <p className="legend-footnote">
                  <InlineFormula latex="a_i=y_i(p_i-c_i),\quad b_i=y_it" />；
                  单位面积地租为元/ha，未耕作区域保持纸色。
                </p>
              </div>
            </article>

            <article className="card chart-card">
              <header className="card-header chart-card-header">
                <div>
                  <div className="section-kicker">
                    <span className="section-index">03</span>
                    <span>竞租与包络</span>
                  </div>
                  <h2>谁愿意为这块地支付最多？</h2>
                </div>
                <div className="chart-callout">
                  <span>观察市场</span>
                  <strong>{selectedCity?.name ?? "中央市场"}</strong>
                  <small>
                    {config.traffic.enabled
                      ? "道路折减已计入有效距离"
                      : "运费率在各方向一致"}
                  </small>
                </div>
              </header>
              <RentChart
                cities={cities}
                roads={roads}
                config={animatedConfig}
                selectedMarketId={selectedMarketId}
                mapAspect={MODEL_ASPECT}
                mapProbe={mapProbe}
                resetKey={mapViewResetKey}
                onSelectMarket={handleSelectMarket}
                onToggleCrop={handleToggleCrop}
              />
            </article>
          </div>

          {!controlsCollapsed && (
            <>
              <button
                type="button"
                className="control-scrim"
                aria-label="关闭参数侧栏"
                onClick={() => setControlsCollapsed(true)}
              />
              <ControlPanel
                config={config}
                cities={cities}
                selectedMarketId={selectedMarketId}
                activePresetId={activePresetId}
                activeTab={controlTab}
                addCityMode={mapTool === "addCity"}
                onConfigChange={setConfig}
                onCropChange={handleCropChange}
                onAddCrop={handleAddCrop}
                onDeleteCrop={handleDeleteCrop}
                onRenameCrop={handleRenameCrop}
                onSelectPreset={loadPreset}
                onSelectMarket={handleSelectMarket}
                onDeleteCity={handleDeleteCity}
                onToggleAddCity={() =>
                  setMapTool((tool) =>
                    tool === "addCity" ? "move" : "addCity",
                  )
                }
                onReset={resetParameters}
                onRandomize={randomizeParameters}
                onTabChange={setControlTab}
                onClose={() => setControlsCollapsed(true)}
              />
            </>
          )}
        </section>

        <IntensityLab
          cities={cities}
          roads={roads}
          config={animatedConfig}
          selectedMarketId={selectedMarketId}
        />

        <section className="principles" aria-labelledby="principles-title">
          <header className="principles-header">
            <div>
              <h2 id="principles-title">把圈层看成一场持续竞租</h2>
            </div>
            <p>
              杜能圈不是一张固定模板。它是一组条件暂时均衡的结果：距离改变成本，
              成本改变竞租，最高竞租者决定土地用途。
            </p>
          </header>

          <div className="principle-grid">
            <article className="principle-card principle-card--paper">
              <span className="principle-number">A</span>
              <h3>圈层为何出现？</h3>
              <p>
                近市场处，各作物都保有较高剩余；随距离增加，高单产、高运费敏感度的
                作物地租下降更快。截距与斜率不同，直线交叉后便出现从集约到粗放的顺序。
              </p>
              <div className="mini-formula">
                <InlineFormula latex="\max_i R_i(d)=\max_i(a_i-b_i d)" />
              </div>
            </article>
            <article className="principle-card">
              <span className="principle-number">B</span>
              <h3>道路为何向外拉伸？</h3>
              <p>
                道路附近的单位运费率下降，竞租线绕截距向外旋转并变平，耕作边际因此
                外移。道路中心的影响最强，向两侧按高斯函数衰减，于是圆环成为走廊。
              </p>
              <div className="mini-diagram mini-diagram--road" aria-hidden="true">
                <span className="diagram-circle diagram-circle--one" />
                <span className="diagram-circle diagram-circle--two" />
                <span className="diagram-road" />
              </div>
            </article>
            <article className="principle-card">
              <span className="principle-number">C</span>
              <h3>多城市为何形成分界？</h3>
              <p>
                每个位置同时比较所有市场：作物 i 在城市 k 的竞租是{" "}
                <InlineFormula latex="a_i-b_i d_{\mathrm{eff},k}" />
                。全局最高值决定用途，也让两个市场的影响区在相遇处形成弯曲边界，
                而非固定的同心圆。
              </p>
              <div className="mini-formula">
                <InlineFormula latex="\max_k\max_i R_i^k(x)" />
              </div>
            </article>
          </div>

        </section>
      </main>

      <footer className="page-footer">
        <div>
          <span className="brand-mark brand-mark--small">泉</span>
          <p>
            杜能圈交互实验室 · 教学模型，数值与边界为解释机制而设，不代表特定地区实测。
          </p>
        </div>
      </footer>

      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      {undoSnapshot && (
        <aside className="undo-toast" role="status" aria-live="polite">
          <span>
            <small>刚刚执行</small>
            <strong>{undoSnapshot.label}</strong>
          </span>
          <button type="button" onClick={undoLastAction}>
            撤销
          </button>
          <button
            type="button"
            className="undo-toast-close"
            aria-label="关闭撤销提示"
            onClick={() => setUndoSnapshot(null)}
          >
            ×
          </button>
        </aside>
      )}
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
