export type CityRole = "primary" | "secondary";
export type MapTool = "move" | "drawRoad" | "addCity" | "delete";

export interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  role: CityRole;
  color: string;
}

export interface CropDefinition {
  id: string;
  name: string;
  shortName: string;
  color: string;
  fill: string;
  dash: string;
  yieldPerHa: number;
  pricePerTonne: number;
  costPerTonne: number;
  visible: boolean;
}

export interface TrafficConfig {
  enabled: boolean;
  lambda: number;
  sigmaKm: number;
  lineWidth: number;
}

export interface Road {
  id: string;
  name: string;
  points: NormalizedPoint[];
}

export interface ModelConfig {
  freightRate: number;
  crops: CropDefinition[];
  traffic: TrafficConfig;
  animation: boolean;
}

export interface CropEconomics {
  a: number;
  b: number;
  zeroDistanceKm: number;
}

export interface RentCandidate {
  city: City;
  crop: CropDefinition;
  distanceKm: number;
  effectiveDistanceKm: number;
  rent: number;
  multiplier: number;
}

export interface PointEvaluation {
  winner: RentCandidate | null;
  rawWinner: RentCandidate | null;
  nearestCity: City;
  nearestDistanceKm: number;
  distanceToRoadKm: number;
  trafficMultiplier: number;
  point: { x: number; y: number };
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface MarketCurvePoint {
  distanceKm: number;
  cropId: string;
  rent: number;
  effectiveDistanceKm: number;
}

export interface MarketCurveSeries {
  crop: CropDefinition;
  points: MarketCurvePoint[];
}
