export type Hemisphere = 1 | -1;
export type IsobarGeometry = "parallel" | "circular";
export type PressureCenter = "low" | "high";
export type WindMode = "free" | "balance";

export interface Vector2 {
  x: number;
  y: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface AtmosphereConfig {
  geometry: IsobarGeometry;
  pressureCenter: PressureCenter;
  pressureGradientHpa100km: number;
  density: number;
  latitude: number;
  hemisphere: Hemisphere;
  curvatureKm: number;
  friction: number;
  isobarSpacing: number;
  windMode: WindMode;
  windSpeed: number;
  windAngle: number;
}

export interface ForceVector {
  x: number;
  y: number;
  magnitude: number;
}

export interface ForceSet {
  pressure: ForceVector;
  coriolis: ForceVector;
  centrifugal: ForceVector;
  friction: ForceVector;
  net: ForceVector;
}

export interface BalanceSolution {
  velocity: Vector2;
  windSpeed: number;
  windAngle: number;
  iterations: number;
  residual: number;
  converged: boolean;
}

export interface AtmosphereState {
  config: AtmosphereConfig;
  pressureUnit: Vector2;
  outwardUnit: Vector2;
  tangentUnit: Vector2;
  pressureOrigin: Vector2;
  velocity: Vector2;
  windSpeed: number;
  windAngle: number;
  coriolisParameter: number;
  coriolisMagnitude: number;
  centrifugalMagnitude: number;
  frictionMagnitude: number;
  forces: ForceSet;
  netMagnitude: number;
  deflectionAngle: number;
  balanceSolution: BalanceSolution | null;
}

export interface AtmospherePreset {
  id: "geostrophic" | "gradient-low" | "gradient-high" | "boundary";
  name: string;
  shortName: string;
  description: string;
  config: AtmosphereConfig;
}
