import type { AtmosphereConfig, AtmospherePreset } from "./types";

const BASE: AtmosphereConfig = {
  geometry: "circular",
  pressureCenter: "low",
  pressureGradientHpa100km: 1.4,
  density: 1.2,
  latitude: 42,
  hemisphere: 1,
  curvatureKm: 1_000,
  friction: 0,
  isobarSpacing: 1,
  windMode: "balance",
  windSpeed: 11.5,
  windAngle: 235,
};

export const ATMOSPHERE_PRESETS: AtmospherePreset[] = [
  {
    id: "geostrophic",
    name: "地转风 · 中纬自由大气",
    shortName: "地转风",
    description: "直线等压线，气压梯度力与地转偏向力平衡。",
    config: {
      ...BASE,
      geometry: "parallel",
      pressureGradientHpa100km: 1.3,
      latitude: 45,
      friction: 0,
    },
  },
  {
    id: "gradient-low",
    name: "梯度风 · 低压",
    shortName: "梯度风低压",
    description: "低压中心附近的三力平衡，北半球呈逆时针环流。",
    config: {
      ...BASE,
      geometry: "circular",
      pressureCenter: "low",
      pressureGradientHpa100km: 1.25,
      latitude: 42,
      curvatureKm: 1_000,
      friction: 0,
    },
  },
  {
    id: "gradient-high",
    name: "梯度风 · 高压",
    shortName: "梯度风高压",
    description: "高压中心附近的三力平衡，北半球呈顺时针环流。",
    config: {
      ...BASE,
      geometry: "circular",
      pressureCenter: "high",
      pressureGradientHpa100km: 1.1,
      latitude: 38,
      curvatureKm: 1_200,
      friction: 0,
    },
  },
  {
    id: "boundary",
    name: "边界层风 · 摩擦偏转",
    shortName: "边界层",
    description: "加入湍流拖曳后，风斜穿等压线并偏向低压。",
    config: {
      ...BASE,
      geometry: "circular",
      pressureCenter: "low",
      pressureGradientHpa100km: 1.55,
      latitude: 40,
      curvatureKm: 850,
      friction: 2.2e-4,
    },
  },
];

export function cloneConfig(config: AtmosphereConfig): AtmosphereConfig {
  return { ...config };
}

export function getAtmospherePreset(
  id: AtmospherePreset["id"],
): AtmospherePreset {
  return (
    ATMOSPHERE_PRESETS.find((preset) => preset.id === id) ??
    ATMOSPHERE_PRESETS[1]
  );
}

export function randomAtmosphereConfig(
  current: AtmosphereConfig,
): AtmosphereConfig {
  const randomBetween = (min: number, max: number) =>
    min + Math.random() * (max - min);
  return {
    ...current,
    pressureGradientHpa100km: Number(
      randomBetween(0.8, 2.4).toFixed(2),
    ),
    density: Number(randomBetween(1.05, 1.3).toFixed(2)),
    latitude: Number(randomBetween(12, 68).toFixed(0)),
    curvatureKm: Number(randomBetween(450, 2_200).toFixed(0)),
    friction: Math.random() < 0.45 ? 0 : randomBetween(0.4e-4, 2.8e-4),
    windMode: "balance",
  };
}
