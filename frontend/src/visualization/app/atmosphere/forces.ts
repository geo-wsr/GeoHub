import type {
  AtmosphereConfig,
  AtmosphereState,
  ForceSet,
  ForceVector,
  NormalizedPoint,
  Vector2,
} from "./types";
import { solveBalance } from "./balance";

export const EARTH_OMEGA = 7.2921159e-5;

export function add(a: Vector2, b: Vector2): Vector2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function scale(vector: Vector2, factor: number): Vector2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

export function magnitude(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalize(vector: Vector2): Vector2 {
  const length = magnitude(vector);
  return length > 1e-12
    ? { x: vector.x / length, y: vector.y / length }
    : { x: 0, y: 0 };
}

export function rotate(vector: Vector2, degrees: number): Vector2 {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return {
    x: vector.x * cosine - vector.y * sine,
    y: vector.x * sine + vector.y * cosine,
  };
}

export function fromAngle(degrees: number, length = 1): Vector2 {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Math.cos(radians) * length,
    y: Math.sin(radians) * length,
  };
}

export function angleOf(vector: Vector2): number {
  return (Math.atan2(vector.y, vector.x) * 180) / Math.PI;
}

export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

export function signedAngleBetween(from: Vector2, to: Vector2): number {
  return (
    (Math.atan2(from.x * to.y - from.y * to.x, from.x * to.x + from.y * to.y) *
      180) /
    Math.PI
  );
}

export function toForceVector(vector: Vector2): ForceVector {
  return { ...vector, magnitude: magnitude(vector) };
}

export function coriolisParameter(
  latitude: number,
  hemisphere: 1 | -1,
): number {
  const value =
    2 * EARTH_OMEGA * Math.sin((latitude * Math.PI) / 180) * hemisphere;
  return Math.abs(value) < 1e-15 ? 0 : value;
}

export function pressureGradientAcceleration(
  pressureGradientHpa100km: number,
  density: number,
): number {
  const pressureGradientPaPerMeter =
    (pressureGradientHpa100km * 100) / 100_000;
  return pressureGradientPaPerMeter / density;
}

export function pressureFrame(
  config: AtmosphereConfig,
  parcelAngle: number,
): {
  pressureUnit: Vector2;
  outwardUnit: Vector2;
  tangentUnit: Vector2;
} {
  if (config.geometry === "parallel") {
    const pressureUnit = { x: 0, y: 1 };
    const tangentUnit = rotate(pressureUnit, config.hemisphere * 90);
    return {
      pressureUnit,
      outwardUnit: { x: 0, y: 0 },
      tangentUnit,
    };
  }

  const angle = (parcelAngle * Math.PI) / 180;
  const outwardUnit = { x: Math.cos(angle), y: Math.sin(angle) };
  const pressureUnit =
    config.pressureCenter === "low"
      ? scale(outwardUnit, -1)
      : outwardUnit;
  const tangentUnit = rotate(pressureUnit, config.hemisphere * 90);
  return { pressureUnit, outwardUnit, tangentUnit };
}

export function evaluateForces(
  config: AtmosphereConfig,
  velocity: Vector2,
  pressureUnit: Vector2,
  outwardUnit: Vector2,
): ForceSet {
  const gradient = pressureGradientAcceleration(
    config.pressureGradientHpa100km,
    config.density,
  );
  const pressure = toForceVector(scale(pressureUnit, gradient));
  const f = coriolisParameter(config.latitude, config.hemisphere);

  // Screen coordinates: x east, y south. This rotation points to the
  // geographic right in the northern hemisphere and left in the south.
  const coriolisVector = {
    x: -f * velocity.y,
    y: f * velocity.x,
  };
  const coriolis = toForceVector(coriolisVector);

  const speed = magnitude(velocity);
  const radiusMeters =
    config.geometry === "circular" ? config.curvatureKm * 1_000 : Infinity;
  const centrifugalVector =
    Number.isFinite(radiusMeters) && radiusMeters > 0
      ? scale(outwardUnit, (speed * speed) / radiusMeters)
      : { x: 0, y: 0 };
  const centrifugal = toForceVector(centrifugalVector);
  const friction = toForceVector(scale(velocity, -config.friction));

  const netVector = add(
    add(pressure, coriolis),
    add(centrifugal, friction),
  );
  return {
    pressure,
    coriolis,
    centrifugal,
    friction,
    net: toForceVector(netVector),
  };
}

export function deriveAtmosphereState(
  config: AtmosphereConfig,
  center: NormalizedPoint,
  parcelAngle: number,
): AtmosphereState {
  const frame = pressureFrame(config, parcelAngle);
  const balanceSolution =
    config.windMode === "balance"
      ? solveBalance(config, frame.pressureUnit, frame.outwardUnit)
      : null;
  const velocity =
    balanceSolution?.velocity ??
    fromAngle(config.windAngle, config.windSpeed);
  const forces = evaluateForces(
    config,
    velocity,
    frame.pressureUnit,
    frame.outwardUnit,
  );
  const speed = magnitude(velocity);
  const f = coriolisParameter(config.latitude, config.hemisphere);
  return {
    config,
    ...frame,
    pressureOrigin: center,
    velocity,
    windSpeed: speed,
    windAngle: normalizeAngle(angleOf(velocity)),
    coriolisParameter: f,
    coriolisMagnitude: Math.abs(f) * speed,
    centrifugalMagnitude: forces.centrifugal.magnitude,
    frictionMagnitude: forces.friction.magnitude,
    forces,
    netMagnitude: forces.net.magnitude,
    deflectionAngle: signedAngleBetween(frame.tangentUnit, velocity),
    balanceSolution,
  };
}

export function forceScaleValue(force: ForceVector): number {
  return force.magnitude;
}

export function toDisplayForce(value: number): string {
  return (value * 1_000).toFixed(2);
}

export function toDisplayF(value: number): string {
  return (Math.abs(value) * 10_000).toFixed(2);
}
