import { describe, expect, it } from "vitest";
import { calculateIntensity } from "./intensity";
import { SCENE_PRESETS, baseConfig } from "./presets";

describe("intensity optimization", () => {
  it("decreases optimal input intensity with market distance", () => {
    const city = SCENE_PRESETS[0].cities[0];
    const near = calculateIntensity(
      baseConfig.crops[0],
      city,
      baseConfig,
      [],
      0.5,
      5000,
    );
    const far = calculateIntensity(
      baseConfig.crops[0],
      city,
      baseConfig,
      [],
      6,
      5000,
    );

    expect(near.optimalInput).toBeGreaterThan(far.optimalInput);
    expect(far.optimalInput).toBeGreaterThanOrEqual(0);
  });

  it("raises intensity when an effective transport corridor lowers freight", () => {
    const city = SCENE_PRESETS[0].cities[0];
    const road = {
      id: "road-test",
      name: "测试道路",
      points: [
        { x: 0.02, y: city.y },
        { x: 0.98, y: city.y },
      ],
    };
    const base = calculateIntensity(
      baseConfig.crops[0],
      city,
      baseConfig,
      [],
      4,
      5000,
    );
    const corridor = calculateIntensity(
      baseConfig.crops[0],
      city,
      {
        freightRate: baseConfig.freightRate,
        traffic: { ...baseConfig.traffic, enabled: true, lambda: 0.5 },
      },
      [road],
      4,
      5000,
    );

    expect(corridor.effFreightRate).toBeLessThan(base.effFreightRate);
    expect(corridor.optimalInput).toBeGreaterThan(base.optimalInput);
  });
});
