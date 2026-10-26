import { describe, expect, it } from "vitest";
import {
  evaluatePoint,
  getCropEconomics,
  getRoadMultiplier,
  getRoadDistanceKm,
  sampleMarketCurves,
} from "./rent";
import { baseConfig, SCENE_PRESETS } from "./presets";

describe("Von Thünen rent model", () => {
  it("computes a_i, b_i and the zero-rent margin from the formula", () => {
    const economics = getCropEconomics(baseConfig.crops[0], 120);

    expect(economics.a).toBeCloseTo(10740, 6);
    expect(economics.b).toBeCloseTo(3600, 6);
    expect(economics.zeroDistanceKm).toBeCloseTo(2.983333, 5);
  });

  it("reduces effective freight on the road and restores it far away", () => {
    const traffic = {
      ...baseConfig.traffic,
      enabled: true,
      lambda: 0.7,
      sigmaKm: 1,
    };

    expect(getRoadMultiplier(0, traffic)).toBeCloseTo(0.3, 8);
    expect(getRoadMultiplier(4, traffic)).toBeGreaterThan(0.999);
    expect(getRoadMultiplier(0, { ...traffic, enabled: false })).toBe(1);
  });

  it("uses the nearest segment across freely drawn roads", () => {
    const roads = [
      {
        id: "diagonal",
        name: "斜向道路",
        points: [
          { x: 0.1, y: 0.1 },
          { x: 0.9, y: 0.9 },
        ],
      },
      {
        id: "horizontal",
        name: "水平道路",
        points: [
          { x: 0.1, y: 0.6 },
          { x: 0.9, y: 0.6 },
        ],
      },
    ];

    expect(getRoadDistanceKm({ x: 0.5, y: 0.6 }, roads, 0.72)).toBeCloseTo(
      0,
      6,
    );
  });

  it("supports an empty crop set without inventing a land-use winner", () => {
    const city = SCENE_PRESETS[0].cities[0];
    const evaluation = evaluatePoint(
      { x: city.x + 0.02, y: city.y },
      [city],
      { ...baseConfig, crops: [] },
      0.72,
    );

    expect(evaluation.winner).toBeNull();
    expect(evaluation.rawWinner).toBeNull();
  });

  it("uses the highest crop-market bid and leaves distant land uncultivated", () => {
    const city = SCENE_PRESETS[0].cities[0];
    const near = evaluatePoint(
      { x: city.x + 0.01, y: city.y },
      [city],
      baseConfig,
      0.72,
    );
    const far = evaluatePoint(
      { x: city.x + 0.47, y: city.y },
      [city],
      { ...baseConfig, freightRate: 180 },
      0.72,
    );

    expect(near.winner?.crop.id).toBe("vegetables");
    expect(far.winner).toBeNull();
  });

  it("allows a second city to win nearby locations", () => {
    const [, second] = SCENE_PRESETS[2].cities;
    const evaluation = evaluatePoint(
      { x: second.x + 0.01, y: second.y },
      SCENE_PRESETS[2].cities,
      SCENE_PRESETS[2].config,
      0.72,
    );

    expect(evaluation.winner?.city.id).toBe(second.id);
  });

  it("flattens and extends the along-road market profile", () => {
    const city = SCENE_PRESETS[0].cities[0];
    const road = {
      id: "test-road",
      name: "测试道路",
      points: [
        { x: 0.02, y: 0.52 },
        { x: 0.98, y: 0.52 },
      ],
    };
    const withoutRoad = sampleMarketCurves(
      city,
      [baseConfig.crops[0]],
      { ...baseConfig, traffic: { ...baseConfig.traffic, enabled: false } },
      0.72,
      4,
      40,
      [road],
    )[0];
    const withRoad = sampleMarketCurves(
      city,
      [baseConfig.crops[0]],
      {
        ...baseConfig,
        traffic: { ...baseConfig.traffic, enabled: true, lambda: 0.7 },
      },
      0.72,
      4,
      40,
      [road],
    )[0];

    const baselineEnd = withoutRoad.points.at(-1)?.rent ?? 0;
    const roadEnd = withRoad.points.at(-1)?.rent ?? 0;
    expect(roadEnd).toBeGreaterThan(baselineEnd);
  });
});
