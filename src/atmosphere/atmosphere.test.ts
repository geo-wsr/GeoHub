import { describe, expect, it } from "vitest";
import {
  coriolisParameter,
  deriveAtmosphereState,
  evaluateForces,
  magnitude,
  pressureFrame,
  pressureGradientAcceleration,
  signedAngleBetween,
} from "./forces";
import { getAtmospherePreset } from "./presets";

const CENTER = { x: 0.485, y: 0.43 };

describe("horizontal atmospheric force model", () => {
  it("converts pressure gradient to unit-mass acceleration", () => {
    expect(pressureGradientAcceleration(1.4, 1.2)).toBeCloseTo(
      0.0011666667,
      8,
    );
  });

  it("places northern-hemisphere Coriolis force to the geographic right", () => {
    const config = getAtmospherePreset("geostrophic").config;
    const velocity = { x: 10, y: 0 };
    const frame = pressureFrame(config, 212);
    const forces = evaluateForces(
      config,
      velocity,
      frame.pressureUnit,
      frame.outwardUnit,
    );
    expect(forces.coriolis.x).toBeCloseTo(0, 10);
    expect(forces.coriolis.y).toBeGreaterThan(0);

    const southern = {
      ...config,
      hemisphere: -1 as const,
    };
    const southernFrame = pressureFrame(southern, 212);
    const southernForces = evaluateForces(
      southern,
      velocity,
      southernFrame.pressureUnit,
      southernFrame.outwardUnit,
    );
    expect(southernForces.coriolis.y).toBeLessThan(0);
  });

  it("has zero Coriolis parameter at the equator", () => {
    expect(coriolisParameter(0, 1)).toBe(0);
    expect(coriolisParameter(0, -1)).toBe(0);
  });

  it("solves mid-latitude geostrophic balance", () => {
    const config = getAtmospherePreset("geostrophic").config;
    const state = deriveAtmosphereState(config, CENTER, 212);
    expect(state.balanceSolution?.converged).toBe(true);
    expect(state.netMagnitude).toBeLessThan(2e-5);
    expect(Math.abs(state.deflectionAngle)).toBeLessThan(0.2);
    expect(magnitude(state.velocity)).toBeGreaterThan(8);
  });

  it("solves low- and high-pressure gradient wind balance", () => {
    for (const presetId of ["gradient-low", "gradient-high"] as const) {
      const config = getAtmospherePreset(presetId).config;
      const state = deriveAtmosphereState(config, CENTER, 212);
      expect(state.balanceSolution?.converged).toBe(true);
      expect(state.netMagnitude).toBeLessThan(2e-5);
      expect(state.centrifugalMagnitude).toBeGreaterThan(0);
    }
  });

  it("rotates boundary-layer wind toward low pressure", () => {
    const config = getAtmospherePreset("boundary").config;
    const state = deriveAtmosphereState(config, CENTER, 212);
    const inwardComponent =
      state.velocity.x * state.pressureUnit.x +
      state.velocity.y * state.pressureUnit.y;
    expect(state.balanceSolution?.converged).toBe(true);
    expect(state.netMagnitude).toBeLessThan(2e-5);
    expect(inwardComponent).toBeGreaterThan(0.1);
    expect(Math.abs(state.deflectionAngle)).toBeGreaterThan(4);
  });

  it("keeps the force and wind relation correct when geometry is circular", () => {
    const config = getAtmospherePreset("gradient-low").config;
    const state = deriveAtmosphereState(config, CENTER, 212);
    const angleCoriolisToWind = signedAngleBetween(
      state.velocity,
      { x: state.forces.coriolis.x, y: state.forces.coriolis.y },
    );
    expect(angleCoriolisToWind).toBeGreaterThan(80);
    expect(angleCoriolisToWind).toBeLessThan(100);
  });
});
