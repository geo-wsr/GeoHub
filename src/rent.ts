import type {
  City,
  CropDefinition,
  CropEconomics,
  MarketCurvePoint,
  MarketCurveSeries,
  ModelConfig,
  NormalizedPoint,
  PointEvaluation,
  Road,
  RentCandidate,
  TrafficConfig,
} from "./types";

export const MAP_WIDTH_KM = 13.5;
export const MODEL_ASPECT = 0.72;
export const MIN_FREIGHT_RATE = 40;
export const MAX_FREIGHT_RATE = 180;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function getCropEconomics(
  crop: CropDefinition,
  freightRate: number,
): CropEconomics {
  const a = crop.yieldPerHa * (crop.pricePerTonne - crop.costPerTonne);
  const b = crop.yieldPerHa * freightRate;

  return {
    a,
    b,
    zeroDistanceKm: b > 0 ? Math.max(0, a / b) : Number.POSITIVE_INFINITY,
  };
}

export function getRoadMultiplier(
  distanceToRoadKm: number,
  traffic: TrafficConfig,
): number {
  if (!traffic.enabled) return 1;

  const lambda = clamp(traffic.lambda, 0, 0.95);
  const sigma = Math.max(0.1, traffic.sigmaKm);
  const gaussian = Math.exp(
    -(distanceToRoadKm * distanceToRoadKm) / (2 * sigma * sigma),
  );

  return clamp(1 - lambda * gaussian, 0.05, 1);
}

export function getEffectiveDistanceKm(
  distanceKm: number,
  distanceToRoadKm: number,
  traffic: TrafficConfig,
): number {
  return distanceKm * getRoadMultiplier(distanceToRoadKm, traffic);
}

export function normalizedDistanceKm(
  first: NormalizedPoint,
  second: NormalizedPoint,
  mapAspect: number,
): number {
  const dx = (first.x - second.x) * MAP_WIDTH_KM;
  const dy =
    (first.y - second.y) * MAP_WIDTH_KM * Math.max(0.1, mapAspect);
  return Math.hypot(dx, dy);
}

export function getRoadDistanceKm(
  point: NormalizedPoint,
  roads: Road[],
  mapAspect: number,
): number {
  const aspect = Math.max(0.1, mapAspect);
  const pointX = point.x;
  const pointY = point.y * aspect;
  let closest = Number.POSITIVE_INFINITY;

  for (const road of roads) {
    for (let index = 1; index < road.points.length; index += 1) {
      const start = road.points[index - 1];
      const end = road.points[index];
      const startX = start.x;
      const startY = start.y * aspect;
      const vectorX = end.x - startX;
      const vectorY = end.y * aspect - startY;
      const offsetX = pointX - startX;
      const offsetY = pointY - startY;
      const lengthSquared = vectorX * vectorX + vectorY * vectorY;
      const projection =
        lengthSquared > 1e-12
          ? Math.max(
              0,
              Math.min(
                1,
                (offsetX * vectorX + offsetY * vectorY) / lengthSquared,
              ),
            )
          : 0;
      const dx = offsetX - vectorX * projection;
      const dy = offsetY - vectorY * projection;
      const distance = Math.hypot(dx, dy) * MAP_WIDTH_KM;
      closest = Math.min(closest, distance);
    }
  }

  return closest;
}

export function getBestBidsByCrop(
  point: NormalizedPoint,
  cities: City[],
  model: Pick<ModelConfig, "freightRate" | "crops" | "traffic">,
  mapAspect: number,
  roads: Road[] = [],
): RentCandidate[] {
  if (cities.length === 0) {
    throw new Error("At least one market city is required.");
  }

  const distanceToRoadKm = getRoadDistanceKm(
    point,
    roads,
    mapAspect,
  );
  const trafficMultiplier = getRoadMultiplier(
    distanceToRoadKm,
    model.traffic,
  );

  return model.crops.map((crop) => {
    const { a, b } = getCropEconomics(crop, model.freightRate);
    let best: RentCandidate | null = null;

    for (const city of cities) {
      const distanceKm = normalizedDistanceKm(point, city, mapAspect);
      const effectiveDistanceKm = distanceKm * trafficMultiplier;
      const rent = a - b * effectiveDistanceKm;
      if (!best || rent > best.rent) {
        best = {
          city,
          crop,
          distanceKm,
          effectiveDistanceKm,
          rent,
          multiplier: trafficMultiplier,
        };
      }
    }

    return best as RentCandidate;
  });
}

export function evaluatePoint(
  point: NormalizedPoint,
  cities: City[],
  model: Pick<ModelConfig, "freightRate" | "crops" | "traffic">,
  mapAspect: number,
  roads: Road[] = [],
): PointEvaluation {
  if (cities.length === 0) {
    throw new Error("At least one market city is required.");
  }

  const bids = getBestBidsByCrop(point, cities, model, mapAspect, roads);
  const distanceToRoadKm = getRoadDistanceKm(
    point,
    roads,
    mapAspect,
  );
  const trafficMultiplier = getRoadMultiplier(
    distanceToRoadKm,
    model.traffic,
  );

  let nearestCity = cities[0];
  let nearestDistanceKm = normalizedDistanceKm(point, nearestCity, mapAspect);

  for (const city of cities) {
    const distanceKm = normalizedDistanceKm(point, city, mapAspect);
    if (distanceKm < nearestDistanceKm) {
      nearestCity = city;
      nearestDistanceKm = distanceKm;
    }
  }

  let rawWinner: RentCandidate | null = null;
  for (const bid of bids) {
    if (!rawWinner || bid.rent > rawWinner.rent) {
      rawWinner = bid;
    }
  }

  return {
    winner: rawWinner && rawWinner.rent > 0 ? rawWinner : null,
    rawWinner,
    nearestCity,
    nearestDistanceKm,
    distanceToRoadKm,
    trafficMultiplier,
    point,
  };
}

export function getCropRentAtMarket(
  point: NormalizedPoint,
  city: City,
  crop: CropDefinition,
  model: Pick<ModelConfig, "freightRate" | "traffic">,
  mapAspect: number,
  roads: Road[] = [],
): RentCandidate {
  const distanceKm = normalizedDistanceKm(point, city, mapAspect);
  const distanceToRoadKm = getRoadDistanceKm(
    point,
    roads,
    mapAspect,
  );
  const multiplier = getRoadMultiplier(distanceToRoadKm, model.traffic);
  const effectiveDistanceKm = distanceKm * multiplier;
  const { a, b } = getCropEconomics(crop, model.freightRate);

  return {
    city,
    crop,
    distanceKm,
    effectiveDistanceKm,
    rent: a - b * effectiveDistanceKm,
    multiplier,
  };
}

/**
 * Samples a due-east profile from one market. With a horizontal road this is
 * also the "along the road" profile whenever the market lies on the road.
 */
export function sampleMarketCurves(
  city: City,
  crops: CropDefinition[],
  model: Pick<ModelConfig, "freightRate" | "traffic">,
  mapAspect: number,
  maxDistanceKm: number,
  sampleCount = 120,
  roads: Road[] = [],
): MarketCurveSeries[] {
  return crops.map((crop) => {
    const points: MarketCurvePoint[] = [];

    for (let index = 0; index <= sampleCount; index += 1) {
      const distanceKm = (index / sampleCount) * maxDistanceKm;
      const point = {
        x: city.x + distanceKm / MAP_WIDTH_KM,
        y: city.y,
      };
      const result = getCropRentAtMarket(
        point,
        city,
        crop,
        model,
        mapAspect,
        roads,
      );

      points.push({
        distanceKm,
        cropId: crop.id,
        rent: result.rent,
        effectiveDistanceKm: result.effectiveDistanceKm,
      });
    }

    return { crop, points };
  });
}

export function getEnvelopeAtDistance(
  series: MarketCurveSeries[],
  distanceKm: number,
): { rent: number; crop: CropDefinition | null } {
  let winner: CropDefinition | null = null;
  let rent = 0;

  for (const item of series) {
    const point =
      item.points.reduce((closest, candidate) =>
        Math.abs(candidate.distanceKm - distanceKm) <
        Math.abs(closest.distanceKm - distanceKm)
          ? candidate
          : closest,
      );

    if (!winner || point.rent > rent) {
      winner = item.crop;
      rent = point.rent;
    }
  }

  return rent > 0 ? { rent, crop: winner } : { rent: 0, crop: null };
}

export function findFarmableDistance(
  series: MarketCurveSeries[],
): number {
  if (series.length === 0 || series[0].points.length === 0) return 0;

  let farthest = 0;
  const points = series[0].points;

  for (const point of points) {
    const envelope = getEnvelopeAtDistance(series, point.distanceKm);
    if (envelope.rent > 0) farthest = Math.max(farthest, point.distanceKm);
  }

  return farthest;
}

export function interpolateModel(
  from: ModelConfig,
  to: ModelConfig,
  progress: number,
): ModelConfig {
  const t = clamp(progress, 0, 1);
  const mix = (start: number, end: number) => start + (end - start) * t;

  return {
    freightRate: mix(from.freightRate, to.freightRate),
    crops: to.crops.map((crop, index) => {
      const previous =
        from.crops.find((candidate) => candidate.id === crop.id) ??
        from.crops[index] ??
        crop;
      return {
        ...crop,
        yieldPerHa: mix(previous.yieldPerHa, crop.yieldPerHa),
        pricePerTonne: mix(previous.pricePerTonne, crop.pricePerTonne),
        costPerTonne: mix(previous.costPerTonne, crop.costPerTonne),
      };
    }),
    traffic: {
      ...to.traffic,
      lambda: mix(from.traffic.lambda, to.traffic.lambda),
      sigmaKm: mix(from.traffic.sigmaKm, to.traffic.sigmaKm),
      lineWidth: mix(from.traffic.lineWidth, to.traffic.lineWidth),
    },
    animation: to.animation,
  };
}

export function formatRent(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}

export function formatDecimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}
