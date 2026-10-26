import type {
  City,
  CropDefinition,
  ModelConfig,
  Road,
} from "./types";

const cropBase: CropDefinition[] = [
  {
    id: "vegetables",
    name: "蔬菜",
    shortName: "蔬菜／鲜货",
    color: "#2F6B5E",
    fill: "#E6F0E7",
    dash: "",
    yieldPerHa: 30,
    pricePerTonne: 1480,
    costPerTonne: 1122,
    visible: true,
  },
  {
    id: "dairy",
    name: "鲜奶与园艺",
    shortName: "鲜奶／园艺",
    color: "#5A886D",
    fill: "#C9DCCA",
    dash: "9 4",
    yieldPerHa: 20,
    pricePerTonne: 1650,
    costPerTonne: 1172,
    visible: true,
  },
  {
    id: "forestry",
    name: "林业",
    shortName: "林业",
    color: "#8A8B3E",
    fill: "#E2E8C4",
    dash: "3 4",
    yieldPerHa: 12.5,
    pricePerTonne: 1250,
    costPerTonne: 637,
    visible: true,
  },
  {
    id: "grain",
    name: "轮作谷物",
    shortName: "谷物",
    color: "#B68B3F",
    fill: "#EDE2C2",
    dash: "11 4",
    yieldPerHa: 7.5,
    pricePerTonne: 1900,
    costPerTonne: 1142,
    visible: true,
  },
  {
    id: "mixed",
    name: "谷草农业",
    shortName: "谷草",
    color: "#C49A4B",
    fill: "#EDD6BF",
    dash: "6 3 2 3",
    yieldPerHa: 5,
    pricePerTonne: 2050,
    costPerTonne: 1189,
    visible: true,
  },
  {
    id: "pasture",
    name: "粗放畜牧",
    shortName: "畜牧",
    color: "#C65D3B",
    fill: "#E2C6B2",
    dash: "2 4",
    yieldPerHa: 3.75,
    pricePerTonne: 2200,
    costPerTonne: 1288,
    visible: true,
  },
];

export const MAX_CROPS = 7;

const cropStylePool = [
  ...cropBase.map((crop) => ({
    color: crop.color,
    fill: crop.fill,
    dash: crop.dash,
  })),
  {
    color: "#8A6BBE",
    fill: "#DED7EA",
    dash: "4 2 1 2",
  },
];

export function createNewCrop(existing: CropDefinition[]): CropDefinition {
  const usedIds = new Set(existing.map((crop) => crop.id));
  let index = 1;
  while (usedIds.has(`crop-${index}`)) index += 1;
  const style =
    cropStylePool.find(
      (candidate) =>
        !existing.some((crop) => crop.color === candidate.color),
    ) ?? cropStylePool[existing.length % cropStylePool.length];

  return {
    id: `crop-${index}`,
    name: `新作物 ${index}`,
    shortName: `新作物 ${index}`,
    color: style.color,
    fill: style.fill,
    dash: style.dash,
    yieldPerHa: 4,
    pricePerTonne: 1800,
    costPerTonne: 1080,
    visible: true,
  };
}

export const CITY_COLORS = [
  "#1F5C4A",
  "#8065A9",
  "#3B6EA8",
  "#8A5A2B",
  "#A14D52",
];

export function cloneConfig(config: ModelConfig): ModelConfig {
  return {
    ...config,
    crops: config.crops.map((crop) => ({ ...crop })),
    traffic: { ...config.traffic },
  };
}

export const baseConfig: ModelConfig = {
  freightRate: 120,
  crops: cropBase,
  traffic: {
    enabled: false,
    lambda: 0.5,
    sigmaKm: 1.15,
    lineWidth: 2.6,
  },
  animation: true,
};

export interface ScenePreset {
  id: "classic" | "corridor" | "twin" | "free";
  eyebrow: string;
  name: string;
  summary: string;
  config: ModelConfig;
  cities: City[];
  roads: Road[];
}

const primaryCity: City = {
  id: "market-1",
  name: "中央市场",
  x: 0.5,
  y: 0.52,
  role: "primary",
  color: CITY_COLORS[0],
};

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "classic",
    eyebrow: "基础模型",
    name: "单中心基础",
    summary: "均质平原、单一市场，观察最清晰的上包络圈层。",
    config: {
      ...cloneConfig(baseConfig),
      traffic: { ...baseConfig.traffic, enabled: false },
    },
    cities: [{ ...primaryCity }],
    roads: [],
  },
  {
    id: "corridor",
    eyebrow: "交通冲击",
    name: "交通线影响",
    summary: "沿东西向道路降低有效运费，比较沿线与外围的形状差异。",
    config: {
      ...cloneConfig(baseConfig),
      freightRate: 130,
      traffic: {
        ...baseConfig.traffic,
        enabled: true,
        lambda: 0.5,
        sigmaKm: 1.2,
        lineWidth: 2.8,
      },
    },
    cities: [{ ...primaryCity }],
    roads: [
      {
        id: "road-1",
        name: "东西向交通线",
        points: [
          { x: 0.02, y: 0.52 },
          { x: 0.98, y: 0.52 },
        ],
      },
    ],
  },
  {
    id: "twin",
    eyebrow: "多中心",
    name: "双城竞争",
    summary: "关闭道路，观察两个市场各自竞租范围相遇后的分界。",
    config: {
      ...cloneConfig(baseConfig),
      freightRate: 110,
      traffic: { ...baseConfig.traffic, enabled: false },
    },
    cities: [
      {
        ...primaryCity,
        name: "河西市场",
        x: 0.36,
        y: 0.50,
      },
      {
        id: "market-2",
        name: "东部市镇",
        x: 0.76,
        y: 0.42,
        role: "secondary",
        color: CITY_COLORS[1],
      },
    ],
    roads: [],
  },
  {
    id: "free",
    eyebrow: "开放实验",
    name: "自由探索",
    summary: "三座市场与一条交通走廊并存，适合自由调整与对比。",
    config: {
      ...cloneConfig(baseConfig),
      freightRate: 105,
      traffic: {
        ...baseConfig.traffic,
        enabled: true,
        lambda: 0.42,
        sigmaKm: 1.45,
        lineWidth: 2.4,
      },
    },
    cities: [
      {
        ...primaryCity,
        name: "中央市场",
        x: 0.47,
        y: 0.52,
      },
      {
        id: "market-2",
        name: "西北市镇",
        x: 0.25,
        y: 0.27,
        role: "secondary",
        color: CITY_COLORS[1],
      },
      {
        id: "market-3",
        name: "东部市镇",
        x: 0.78,
        y: 0.42,
        role: "secondary",
        color: CITY_COLORS[2],
      },
    ],
    roads: [
      {
        id: "road-1",
        name: "东西向交通线",
        points: [
          { x: 0.02, y: 0.52 },
          { x: 0.98, y: 0.52 },
        ],
      },
    ],
  },
];

export function getPreset(id: ScenePreset["id"]): ScenePreset {
  return SCENE_PRESETS.find((scene) => scene.id === id) ?? SCENE_PRESETS[0];
}

export function createRandomConfig(
  source: ModelConfig,
  random: () => number = Math.random,
): ModelConfig {
  const next = cloneConfig(source);
  next.freightRate = Math.round(65 + random() * 110);
  next.traffic.lambda = 0.35 + random() * 0.55;
  next.traffic.sigmaKm = 0.75 + random() * 1.45;

  const slopeScale = 0.72 + random() * 0.55;
  next.crops = next.crops.map((crop, index) => {
    const scalar = slopeScale * (0.9 + random() * 0.2);
    const marginBase = crop.pricePerTonne - crop.costPerTonne;
    const margin = Math.max(
      80,
      marginBase * (0.84 + random() * 0.3) * (1 - index * 0.018),
    );

    return {
      ...crop,
      yieldPerHa: Math.max(1, crop.yieldPerHa * scalar),
      pricePerTonne: Math.round(crop.pricePerTonne * (0.94 + random() * 0.12)),
      costPerTonne: Math.max(
        1,
        Math.round(crop.pricePerTonne - margin),
      ),
    };
  });

  return next;
}
