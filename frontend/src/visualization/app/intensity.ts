import {
  MAP_WIDTH_KM,
  MODEL_ASPECT,
  getRoadDistanceKm,
  getRoadMultiplier,
} from "./rent";
import type { City, CropDefinition, ModelConfig, Road } from "./types";

export const INTENSITY_INPUT_MIN = 500;
export const INTENSITY_INPUT_MAX = 30000;

export interface IntensityResult {
  distanceKm: number;
  netPrice: number;
  effFreightRate: number;
  outputCapacity: number;
  optimalInput: number;
  optimalOutput: number;
  profit: number;
  roadMultiplier: number;
}

export interface IntensityProfilePoint extends IntensityResult {
  d: number;
}

export function calculateIntensity(
  crop: CropDefinition,
  city: City,
  config: Pick<ModelConfig, "freightRate" | "traffic">,
  roads: Road[],
  distanceKm: number,
  inputPrice: number,
): IntensityResult {
  const point = {
    x: city.x + distanceKm / MAP_WIDTH_KM,
    y: city.y,
  };
  const roadDistance = getRoadDistanceKm(point, roads, MODEL_ASPECT);
  const roadMultiplier = getRoadMultiplier(roadDistance, config.traffic);
  const effFreightRate = config.freightRate * roadMultiplier;
  const netPrice = Math.max(
    0,
    crop.pricePerTonne - effFreightRate * distanceKm,
  );
  const outputCapacity = crop.yieldPerHa * 1.6;
  const marginalAtZero = netPrice * outputCapacity;
  const optimalInput =
    inputPrice > 0 && marginalAtZero > inputPrice
      ? Math.min(8, Math.log(marginalAtZero / inputPrice))
      : 0;
  const optimalOutput =
    outputCapacity * (1 - Math.exp(-optimalInput));
  const profit = netPrice * optimalOutput - inputPrice * optimalInput;

  return {
    distanceKm,
    netPrice,
    effFreightRate,
    outputCapacity,
    optimalInput,
    optimalOutput,
    profit,
    roadMultiplier,
  };
}

export function buildIntensityProfile(
  crop: CropDefinition,
  city: City,
  config: Pick<ModelConfig, "freightRate" | "traffic">,
  roads: Road[],
  maxDistanceKm: number,
  inputPrice: number,
  sampleCount = 90,
): IntensityProfilePoint[] {
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const distanceKm = (index / sampleCount) * maxDistanceKm;
    return {
      d: distanceKm,
      ...calculateIntensity(
        crop,
        city,
        config,
        roads,
        distanceKm,
        inputPrice,
      ),
    };
  });
}
