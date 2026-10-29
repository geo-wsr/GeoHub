import {
  add,
  coriolisParameter,
  evaluateForces,
  fromAngle,
  magnitude,
  normalizeAngle,
  angleOf,
} from "./forces";
import type {
  AtmosphereConfig,
  BalanceSolution,
  Vector2,
} from "./types";

interface Matrix2 {
  a: number;
  b: number;
  c: number;
  d: number;
}

function solve2(matrix: Matrix2, vector: Vector2): Vector2 | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-12) return null;
  return {
    x: (vector.x * matrix.d - matrix.b * vector.y) / determinant,
    y: (matrix.a * vector.y - vector.x * matrix.c) / determinant,
  };
}

/**
 * Solves F_p + f k x V + F_c - kV = 0 with a damped 2D Newton step.
 * The first guess follows the geostrophic tangent for the selected pressure
 * centre and hemisphere; friction then rotates the root toward low pressure.
 */
export function solveBalance(
  config: AtmosphereConfig,
  pressureUnit: Vector2,
  outwardUnit: Vector2,
): BalanceSolution | null {
  const f = coriolisParameter(config.latitude, config.hemisphere);
  const radius =
    config.geometry === "circular" ? config.curvatureKm * 1_000 : Infinity;
  const tangent = {
    x: -config.hemisphere * pressureUnit.y,
    y: config.hemisphere * pressureUnit.x,
  };
  const gradientScale = Math.max(
    1e-9,
    config.friction + Math.abs(f),
  );
  const firstSpeed = Math.min(
    60,
    Math.max(
      0.25,
      Math.hypot(
        config.pressureGradientHpa100km * 100 / 100_000 / config.density,
        0,
      ) / gradientScale,
    ),
  );
  let velocity = {
    x: tangent.x * firstSpeed,
    y: tangent.y * firstSpeed,
  };

  for (let iteration = 0; iteration < 36; iteration += 1) {
    const forces = evaluateForces(
      config,
      velocity,
      pressureUnit,
      outwardUnit,
    );
    const residual = { x: forces.net.x, y: forces.net.y };
    const residualMagnitude = magnitude(residual);
    if (residualMagnitude < 2e-7) {
      return {
        velocity,
        windSpeed: magnitude(velocity),
        windAngle: normalizeAngle(angleOf(velocity)),
        iterations: iteration,
        residual: residualMagnitude,
        converged: true,
      };
    }

    const coriolisJacobian = {
      a: 0,
      b: -f,
      c: f,
      d: 0,
    };
    const centrifugalDerivative = Number.isFinite(radius)
      ? {
          a: (2 * outwardUnit.x * velocity.x) / radius,
          b: (2 * outwardUnit.x * velocity.y) / radius,
          c: (2 * outwardUnit.y * velocity.x) / radius,
          d: (2 * outwardUnit.y * velocity.y) / radius,
        }
      : { a: 0, b: 0, c: 0, d: 0 };
    const jacobian: Matrix2 = {
      a: coriolisJacobian.a + centrifugalDerivative.a - config.friction,
      b: coriolisJacobian.b + centrifugalDerivative.b,
      c: coriolisJacobian.c + centrifugalDerivative.c,
      d: coriolisJacobian.d + centrifugalDerivative.d - config.friction,
    };
    const step = solve2(jacobian, { x: -residual.x, y: -residual.y });
    if (!step) break;

    let accepted = false;
    let damping = 1;
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const candidate = add(velocity, {
        x: step.x * damping,
        y: step.y * damping,
      });
      const candidateSpeed = magnitude(candidate);
      if (candidateSpeed > 100) {
        damping *= 0.5;
        continue;
      }
      const candidateForces = evaluateForces(
        config,
        candidate,
        pressureUnit,
        outwardUnit,
      );
      if (candidateForces.net.magnitude < residualMagnitude) {
        velocity = candidate;
        accepted = true;
        break;
      }
      damping *= 0.5;
    }
    if (!accepted) break;
  }

  const finalForces = evaluateForces(
    config,
    velocity,
    pressureUnit,
    outwardUnit,
  );
  return {
    velocity,
    windSpeed: magnitude(velocity),
    windAngle: normalizeAngle(angleOf(velocity)),
    iterations: 36,
    residual: finalForces.net.magnitude,
    converged: finalForces.net.magnitude < 2e-5,
  };
}

export function geostrophicWindSpeed(
  pressureGradientHpa100km: number,
  density: number,
  latitude: number,
): number | null {
  const f = Math.abs(
    coriolisParameter(latitude, 1),
  );
  if (f < 1e-8) return null;
  return pressureGradientHpa100km * 100 / 100_000 / density / f;
}

export function initialWindAtAngle(
  angle: number,
  speed: number,
): Vector2 {
  return fromAngle(angle, speed);
}
