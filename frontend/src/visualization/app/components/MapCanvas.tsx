import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useElementSize } from "../hooks/useElementSize";
import {
  MAP_WIDTH_KM,
  MODEL_ASPECT,
  evaluatePoint,
  formatRent,
  getCropEconomics,
  getRoadMultiplier,
  getRoadDistanceKm,
  normalizedDistanceKm,
} from "../rent";
import type {
  City,
  CropDefinition,
  MapTool,
  ModelConfig,
  NormalizedPoint,
  PointEvaluation,
  Road,
} from "../types";

export interface MapProbe {
  point: NormalizedPoint;
  evaluation: PointEvaluation;
  selectedMarketDistanceKm: number;
}

interface MapCanvasProps {
  cities: City[];
  roads: Road[];
  config: ModelConfig;
  selectedMarketId: string;
  mapTool: MapTool;
  viewResetKey: number;
  onCitiesChange: (cities: City[]) => void;
  onRoadsChange: (roads: Road[]) => void;
  onAddRoad: (points: NormalizedPoint[]) => void;
  onDeleteRoad: (id: string) => void;
  onDeleteCity: (id: string) => void;
  onSelectMarket: (id: string) => void;
  onAddCity: (point: NormalizedPoint) => void;
  onProbeChange: (probe: MapProbe | null) => void;
}

interface ContourPath {
  crop: CropDefinition;
  d: string;
}

interface LandUseGeometry {
  paths: ContourPath[];
}

interface EdgePoint {
  x: number;
  y: number;
}

interface MapCamera {
  scale: number;
  offsetX: number;
  offsetY: number;
}

interface CityDragState {
  id: string;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
}

interface RoadDragState {
  id: string;
  startClientX: number;
  startClientY: number;
  originPoints: NormalizedPoint[];
  camera: MapCamera;
}

interface PanState {
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
}

type Segment = [string, string];

function projectPoint(point: NormalizedPoint, camera: MapCamera): EdgePoint {
  return {
    x: camera.offsetX + point.x * camera.scale,
    y: camera.offsetY + point.y * camera.scale * MODEL_ASPECT,
  };
}

function unprojectPoint(point: EdgePoint, camera: MapCamera): NormalizedPoint {
  return {
    x: (point.x - camera.offsetX) / camera.scale,
    y: (point.y - camera.offsetY) / (camera.scale * MODEL_ASPECT),
  };
}

function buildMapCamera(
  width: number,
  height: number,
  cities: City[],
  roads: Road[],
  config: ModelConfig,
): MapCamera {
  const maxCropRadius = Math.max(
    4,
    ...config.crops.map(
      (crop) => getCropEconomics(crop, config.freightRate).zeroDistanceKm,
    ),
  );
  const baseRadius = Math.max(8.45, maxCropRadius + 0.78);
  const roadMultiplier = config.traffic.enabled
    ? Math.max(0.05, 1 - config.traffic.lambda)
    : 1;
  const horizontalRadius = Math.max(baseRadius, baseRadius / roadMultiplier);
  const horizontalPad = horizontalRadius / MAP_WIDTH_KM;
  const verticalPad = baseRadius / (MAP_WIDTH_KM * MODEL_ASPECT);

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const city of cities) {
    minX = Math.min(minX, city.x - horizontalPad);
    maxX = Math.max(maxX, city.x + horizontalPad);
    minY = Math.min(minY, city.y - verticalPad);
    maxY = Math.max(maxY, city.y + verticalPad);
  }

  for (const road of roads) {
    for (const point of road.points) {
      minX = Math.min(minX, point.x - 0.035);
      maxX = Math.max(maxX, point.x + 0.035);
      minY = Math.min(minY, point.y - 0.035);
      maxY = Math.max(maxY, point.y + 0.035);
    }
  }

  const horizontalSpan = Math.max(0.2, maxX - minX);
  const verticalSpan = Math.max(0.2, maxY - minY);
  const padding = 26;
  const scale = Math.max(
    1,
    Math.min(
      Math.max(1, width - padding * 2) / horizontalSpan,
      Math.max(1, height - padding * 2) /
        (verticalSpan * MODEL_ASPECT),
    ),
  );

  return {
    scale,
    offsetX: (width - horizontalSpan * scale) / 2 - minX * scale,
    offsetY:
      (height - verticalSpan * scale * MODEL_ASPECT) / 2 -
      minY * scale * MODEL_ASPECT,
  };
}

function paddedField(
  values: number[],
  columns: number,
  rows: number,
): { values: number[]; columns: number; rows: number } {
  const paddedColumns = columns + 2;
  const paddedRows = rows + 2;
  const padded = new Array<number>(paddedColumns * paddedRows).fill(-1);

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      padded[(row + 1) * paddedColumns + column + 1] =
        values[row * columns + column];
    }
  }

  return {
    values: padded,
    columns: paddedColumns,
    rows: paddedRows,
  };
}

function contourPathFromField(
  rawValues: number[],
  rawColumns: number,
  rawRows: number,
  x0: number,
  y0: number,
  dx: number,
  dy: number,
): string {
  const field = paddedField(rawValues, rawColumns, rawRows);
  const { values, columns, rows } = field;
  const segmentMap = new Map<string, Segment>();
  const pointMap = new Map<string, EdgePoint>();

  const valueAt = (column: number, row: number) =>
    values[row * columns + column];
  const crossingPoint = (
    key: string,
    first: [number, number],
    second: [number, number],
  ): EdgePoint => {
    if (pointMap.has(key)) return pointMap.get(key) as EdgePoint;

    const firstValue = valueAt(first[0], first[1]);
    const secondValue = valueAt(second[0], second[1]);
    const denominator = firstValue - secondValue;
    const ratio =
      Math.abs(denominator) < 1e-9 ? 0.5 : firstValue / denominator;
    const t = Math.max(0, Math.min(1, ratio));
    const point = {
      x: x0 + (first[0] + (second[0] - first[0]) * t - 1) * dx,
      y: y0 + (first[1] + (second[1] - first[1]) * t - 1) * dy,
    };
    pointMap.set(key, point);
    return point;
  };

  const horizontal = (column: number, row: number): Segment => {
    const key = `h:${column}:${row}`;
    crossingPoint(key, [column, row], [column + 1, row]);
    return [key, key];
  };
  const vertical = (column: number, row: number): Segment => {
    const key = `v:${column}:${row}`;
    crossingPoint(key, [column, row], [column, row + 1]);
    return [key, key];
  };

  const addSegment = (first: Segment, second: Segment) => {
    segmentMap.set(`${first[0]}|${second[0]}`, [first[0], second[0]]);
  };

  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const tl = valueAt(column, row) > 0;
      const tr = valueAt(column + 1, row) > 0;
      const br = valueAt(column + 1, row + 1) > 0;
      const bl = valueAt(column, row + 1) > 0;
      const index = Number(tl) + Number(tr) * 2 + Number(br) * 4 + Number(bl) * 8;

      if (index === 0 || index === 15) continue;

      const top = horizontal(column, row);
      const right = vertical(column + 1, row);
      const bottom = horizontal(column, row + 1);
      const left = vertical(column, row);

      switch (index) {
        case 1:
          addSegment(left, top);
          break;
        case 2:
          addSegment(top, right);
          break;
        case 3:
          addSegment(left, right);
          break;
        case 4:
          addSegment(right, bottom);
          break;
        case 6:
          addSegment(top, bottom);
          break;
        case 7:
          addSegment(left, bottom);
          break;
        case 8:
          addSegment(bottom, left);
          break;
        case 9:
          addSegment(bottom, top);
          break;
        case 11:
          addSegment(right, bottom);
          break;
        case 12:
          addSegment(right, left);
          break;
        case 13:
          addSegment(top, right);
          break;
        case 14:
          addSegment(left, top);
          break;
        case 5: {
          const centerPositive =
            (valueAt(column, row) +
              valueAt(column + 1, row) +
              valueAt(column + 1, row + 1) +
              valueAt(column, row + 1)) /
              4 >
            0;
          if (centerPositive) {
            addSegment(top, right);
            addSegment(bottom, left);
          } else {
            addSegment(left, top);
            addSegment(right, bottom);
          }
          break;
        }
        case 10: {
          const centerPositive =
            (valueAt(column, row) +
              valueAt(column + 1, row) +
              valueAt(column + 1, row + 1) +
              valueAt(column, row + 1)) /
              4 >
            0;
          if (centerPositive) {
            addSegment(top, left);
            addSegment(right, bottom);
          } else {
            addSegment(top, right);
            addSegment(bottom, left);
          }
          break;
        }
      }
    }
  }

  const adjacency = new Map<string, string[]>();
  for (const [first, second] of segmentMap.values()) {
    adjacency.set(first, [...(adjacency.get(first) ?? []), second]);
    adjacency.set(second, [...(adjacency.get(second) ?? []), first]);
  }

  const visited = new Set<string>();
  const loops: string[] = [];

  for (const start of adjacency.keys()) {
    if (visited.has(start)) continue;
    const path: string[] = [];
    let previous: string | null = null;
    let current = start;

    for (let guard = 0; guard < adjacency.size + 2; guard += 1) {
      if (visited.has(current) && current !== start) break;
      visited.add(current);
      const point = pointMap.get(current);
      if (point) {
        path.push(`${point.x.toFixed(2)},${point.y.toFixed(2)}`);
      }

      const neighbors = adjacency.get(current) ?? [];
      const next =
        neighbors.find((candidate) => candidate !== previous && !visited.has(candidate)) ??
        neighbors.find((candidate) => candidate === start);
      if (!next || next === start) break;
      previous = current;
      current = next;
    }

    if (path.length >= 3) loops.push(`M${path.join("L")}Z`);
  }

  return loops.join("");
}

function buildLandUseGeometry(
  width: number,
  height: number,
  cities: City[],
  roads: Road[],
  config: ModelConfig,
  camera: MapCamera,
): LandUseGeometry {
  if (width < 100 || height < 100 || cities.length === 0) {
    return { paths: [] };
  }
  if (config.crops.length === 0) {
    return { paths: [] };
  }

  const mapAspect = MODEL_ASPECT;
  const maxCropRadius = Math.max(
    ...config.crops.map(
      (crop) => getCropEconomics(crop, config.freightRate).zeroDistanceKm,
    ),
    1,
  );
  const roadMultiplier =
    config.traffic.enabled
      ? Math.max(0.05, 1 - config.traffic.lambda)
      : 1;
  const fieldRadiusPx =
    ((maxCropRadius / roadMultiplier + 0.75) * camera.scale) /
    MAP_WIDTH_KM;
  const projectedCities = cities.map((city) => projectPoint(city, camera));
  const fieldX0 = Math.min(
    -24,
    ...projectedCities.map((city) => city.x - fieldRadiusPx - 24),
  );
  const fieldX1 = Math.max(
    width + 24,
    ...projectedCities.map((city) => city.x + fieldRadiusPx + 24),
  );
  const fieldY0 = Math.min(
    -24,
    ...projectedCities.map((city) => city.y - fieldRadiusPx - 24),
  );
  const fieldY1 = Math.max(
    height + 24,
    ...projectedCities.map((city) => city.y + fieldRadiusPx + 24),
  );
  const fieldWidth = fieldX1 - fieldX0;
  const fieldHeight = fieldY1 - fieldY0;
  const columns = Math.max(80, Math.min(260, Math.ceil(fieldWidth / 7)));
  const rows = Math.max(70, Math.min(240, Math.ceil(fieldHeight / 7)));
  const dx = fieldWidth / (columns - 1);
  const dy = fieldHeight / (rows - 1);
  const cropCount = config.crops.length;
  const margins = config.crops.map(() => new Array<number>(columns * rows));

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const point = unprojectPoint(
        { x: fieldX0 + column * dx, y: fieldY0 + row * dy },
        camera,
      );
      const bids = config.crops.map((crop) => {
        let bestRent = Number.NEGATIVE_INFINITY;

        const roadDistance = getRoadDistanceKm(
          point,
          roads,
          mapAspect,
        );
        const roadMultiplier = getRoadMultiplier(
          roadDistance,
          config.traffic,
        );

        for (const city of cities) {
          const distanceKm = normalizedDistanceKm(point, city, mapAspect);
          const economics = getCropEconomics(crop, config.freightRate);
          const rent =
            economics.a - economics.b * distanceKm * roadMultiplier;
          bestRent = Math.max(bestRent, rent);
        }

        return { rent: bestRent };
      });

      for (let cropIndex = 0; cropIndex < cropCount; cropIndex += 1) {
        let otherMaximum = 0;
        for (let other = 0; other < cropCount; other += 1) {
          if (other !== cropIndex) {
            otherMaximum = Math.max(otherMaximum, bids[other].rent);
          }
        }
        margins[cropIndex][row * columns + column] =
          bids[cropIndex].rent - otherMaximum;
      }
    }
  }

  const paths = config.crops
    .map((crop, index) => ({
      crop,
      d: contourPathFromField(
        margins[index],
        columns,
        rows,
        fieldX0,
        fieldY0,
        dx,
        dy,
      ),
    }))
    .filter((item) => item.d.length > 0);

  return { paths };
}

function mapCoordinates(
  event: ReactPointerEvent<SVGElement>,
  camera: MapCamera,
): NormalizedPoint {
  const svg =
    event.currentTarget.ownerSVGElement ??
    (event.currentTarget as SVGSVGElement);
  const rect = svg.getBoundingClientRect();
  return unprojectPoint(
    {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    },
    camera,
  );
}

function roadPathData(road: Road, camera: MapCamera): string {
  return road.points
    .map((point, index) => {
      const projected = projectPoint(point, camera);
      return `${index === 0 ? "M" : "L"}${projected.x.toFixed(2)},${projected.y.toFixed(2)}`;
    })
    .join("");
}

export function MapCanvas({
  cities,
  roads,
  config,
  selectedMarketId,
  mapTool,
  viewResetKey,
  onCitiesChange,
  onRoadsChange,
  onAddRoad,
  onDeleteRoad,
  onDeleteCity,
  onSelectMarket,
  onAddCity,
  onProbeChange,
}: MapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const size = useElementSize(wrapperRef, { width: 860, height: 560 });
  const [hoverPoint, setHoverPoint] = useState<NormalizedPoint | null>(null);
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ x: 0, y: 0 });
  const [frozenCamera, setFrozenCamera] = useState<MapCamera | null>(null);
  const [panning, setPanning] = useState<PanState | null>(null);
  const panningRef = useRef<PanState | null>(null);
  const [draftRoad, setDraftRoad] = useState<NormalizedPoint[]>([]);
  const [hoveredRoadId, setHoveredRoadId] = useState<string | null>(null);
  const [hoveredCityId, setHoveredCityId] = useState<string | null>(null);
  const draftRoadRef = useRef<NormalizedPoint[]>([]);
  const lastDrawClientRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<CityDragState | null>(null);
  const draggingRef = useRef<CityDragState | null>(null);
  const [draggingRoad, setDraggingRoad] = useState<RoadDragState | null>(null);
  const draggingRoadRef = useRef<RoadDragState | null>(null);
  const movedRef = useRef(false);
  const keyboardStateRef = useRef({
    cities,
    mapTool,
    onCitiesChange,
    onDeleteCity,
    onSelectMarket,
  });
  keyboardStateRef.current = {
    cities,
    mapTool,
    onCitiesChange,
    onDeleteCity,
    onSelectMarket,
  };

  const baseCamera = useMemo(
    () => buildMapCamera(size.width, size.height, cities, roads, config),
    [cities, config, roads, size.height, size.width],
  );
  const fittedCamera = useMemo<MapCamera>(
    () => ({
      scale: baseCamera.scale * viewZoom,
      offsetX:
        size.width / 2 +
        (baseCamera.offsetX - size.width / 2) * viewZoom +
        viewPan.x,
      offsetY:
        size.height / 2 +
        (baseCamera.offsetY - size.height / 2) * viewZoom +
        viewPan.y,
    }),
    [baseCamera, size.height, size.width, viewPan.x, viewPan.y, viewZoom],
  );
  const camera = frozenCamera ?? fittedCamera;
  const geometry = useMemo(
    () =>
      buildLandUseGeometry(
        size.width,
        size.height,
        cities,
        roads,
        config,
        camera,
      ),
    [camera, cities, config, roads, size.height, size.width],
  );
  const evaluation = useMemo(
    () =>
      hoverPoint
        ? evaluatePoint(hoverPoint, cities, config, MODEL_ASPECT, roads)
        : null,
    [cities, config, hoverPoint, roads],
  );

  useEffect(() => {
    setViewZoom(1);
    setViewPan({ x: 0, y: 0 });
    setHoverPoint(null);
    setHoveredRoadId(null);
    setHoveredCityId(null);
    panningRef.current = null;
    setPanning(null);
    draggingRef.current = null;
    setDragging(null);
    draggingRoadRef.current = null;
    setDraggingRoad(null);
    setFrozenCamera(null);
    draftRoadRef.current = [];
    lastDrawClientRef.current = null;
    setDraftRoad([]);
  }, [viewResetKey]);

  const wheelHandlerRef = useRef<(event: WheelEvent) => void>(() => undefined);
  wheelHandlerRef.current = (event: WheelEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const screenPoint = {
      x: ((event.clientX - rect.left) / rect.width) * size.width,
      y: ((event.clientY - rect.top) / rect.height) * size.height,
    };
    const modelPoint = unprojectPoint(screenPoint, camera);
    const factor = Math.exp(-event.deltaY * 0.0014);
    const nextZoom = Math.min(4, Math.max(0.65, viewZoom * factor));
    const nextScale = baseCamera.scale * nextZoom;
    const centeredOffsetX =
      size.width / 2 +
      (baseCamera.offsetX - size.width / 2) * nextZoom;
    const centeredOffsetY =
      size.height / 2 +
      (baseCamera.offsetY - size.height / 2) * nextZoom;
    setViewZoom(nextZoom);
    setViewPan({
      x:
        screenPoint.x -
        modelPoint.x * nextScale -
        centeredOffsetX,
      y:
        screenPoint.y -
        modelPoint.y * nextScale * MODEL_ASPECT -
        centeredOffsetY,
    });
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => wheelHandlerRef.current(event);
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.target instanceof Element)) return;
      const marker = event.target.closest<SVGGElement>(".city-marker");
      const cityId = marker?.dataset.cityId;
      if (!cityId) return;

      const current = keyboardStateRef.current;
      const city = current.cities.find((item) => item.id === cityId);
      if (!city) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setHoverPoint(city);
        current.onSelectMarket(city.id);
        return;
      }

      if (
        (event.key === "Delete" || event.key === "Backspace") &&
        current.mapTool === "delete"
      ) {
        event.preventDefault();
        current.onDeleteCity(city.id);
        return;
      }

      if (current.mapTool !== "move") return;
      const step = event.shiftKey ? 0.04 : 0.012;
      const delta = {
        x:
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0,
        y:
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0,
      };
      if (delta.x === 0 && delta.y === 0) return;

      event.preventDefault();
      const nextPoint = {
        x: Math.max(0.045, Math.min(0.955, city.x + delta.x)),
        y: Math.max(0.045, Math.min(0.955, city.y + delta.y)),
      };
      setHoverPoint(nextPoint);
      current.onCitiesChange(
        current.cities.map((item) =>
          item.id === city.id ? { ...item, ...nextPoint } : item,
        ),
      );
      current.onSelectMarket(city.id);
    };

    svg.addEventListener("keydown", onKeyDown);
    return () => svg.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const selected =
      cities.find((city) => city.id === selectedMarketId) ?? cities[0];
    if (!hoverPoint || !evaluation || !selected) {
      onProbeChange(null);
      return;
    }
    onProbeChange({
      point: hoverPoint,
      evaluation,
      selectedMarketDistanceKm: normalizedDistanceKm(
        hoverPoint,
        selected,
        MODEL_ASPECT,
      ),
    });
  }, [
    cities,
    evaluation,
    hoverPoint,
    onProbeChange,
    selectedMarketId,
  ]);

  const updateHover = (point: NormalizedPoint) => setHoverPoint(point);

  const finishDraftRoad = () => {
    const points = draftRoadRef.current;
    if (points.length >= 2) onAddRoad(points);
    draftRoadRef.current = [];
    lastDrawClientRef.current = null;
    setDraftRoad([]);
  };

  const handlePointerDown = (
    event: ReactPointerEvent<SVGElement>,
  ) => {
    const position = mapCoordinates(event, camera);
    updateHover(position);
    if (event.button !== 0) return;
    const target = event.target as Element;
    if (
      mapTool === "move" &&
      target.closest(".city-marker, .road-item")
    ) {
      return;
    }

    if (mapTool === "drawRoad") {
      event.currentTarget.setPointerCapture(event.pointerId);
      draftRoadRef.current = [position];
      setDraftRoad([position]);
      lastDrawClientRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      return;
    }

    if (mapTool === "move") {
      event.currentTarget.setPointerCapture(event.pointerId);
      const nextPan = {
        startClientX: event.clientX,
        startClientY: event.clientY,
        originX: viewPan.x,
        originY: viewPan.y,
      };
      panningRef.current = nextPan;
      setPanning(nextPan);
    }
  };

  const handlePointerMove = (
    event: ReactPointerEvent<SVGElement>,
  ) => {
    const position = mapCoordinates(event, camera);
    updateHover(position);

    const activePan = panningRef.current ?? panning;
    if (activePan) {
      setViewPan({
        x: activePan.originX + event.clientX - activePan.startClientX,
        y: activePan.originY + event.clientY - activePan.startClientY,
      });
      return;
    }

    const activeRoadDrag = draggingRoadRef.current ?? draggingRoad;
    if (activeRoadDrag) {
      const cameraAtStart = activeRoadDrag.camera;
      const deltaX =
        (event.clientX - activeRoadDrag.startClientX) / cameraAtStart.scale;
      const deltaY =
        (event.clientY - activeRoadDrag.startClientY) /
        (cameraAtStart.scale * MODEL_ASPECT);
      onRoadsChange(
        roads.map((road) =>
          road.id === activeRoadDrag.id
            ? {
                ...road,
                points: activeRoadDrag.originPoints.map((point) => ({
                  x: Math.max(-0.15, Math.min(1.15, point.x + deltaX)),
                  y: Math.max(-0.15, Math.min(1.15, point.y + deltaY)),
                })),
              }
            : road,
        ),
      );
      return;
    }

    if (mapTool === "drawRoad" && lastDrawClientRef.current) {
      const previousClient = lastDrawClientRef.current;
      if (
        Math.hypot(
          event.clientX - previousClient.x,
          event.clientY - previousClient.y,
        ) >= 3 &&
        draftRoadRef.current.length < 420
      ) {
        const next = [...draftRoadRef.current, position];
        draftRoadRef.current = next;
        setDraftRoad(next);
        lastDrawClientRef.current = {
          x: event.clientX,
          y: event.clientY,
        };
      }
      return;
    }

    const activeCityDrag = draggingRef.current ?? dragging;
    if (!activeCityDrag) return;
    const delta = Math.hypot(
      event.clientX - activeCityDrag.startClientX,
      event.clientY - activeCityDrag.startClientY,
    );
    if (delta > 3) movedRef.current = true;

    onCitiesChange(
      cities.map((city) =>
        city.id === activeCityDrag.id
          ? {
              ...city,
              x: Math.max(
                0.045,
                Math.min(
                  0.955,
                  activeCityDrag.originX +
                    (event.clientX - activeCityDrag.startClientX) / camera.scale,
                ),
              ),
              y: Math.max(
                0.045,
                Math.min(
                  0.955,
                  activeCityDrag.originY +
                    (event.clientY - activeCityDrag.startClientY) /
                      (camera.scale * MODEL_ASPECT),
                ),
              ),
            }
          : city,
      ),
    );
  };

  const handlePointerUp = (
    event: ReactPointerEvent<SVGElement>,
  ) => {
    if (panningRef.current ?? panning) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      panningRef.current = null;
      setPanning(null);
      return;
    }

    if (mapTool === "drawRoad" && draftRoadRef.current.length > 0) {
      finishDraftRoad();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    const activeRoadDrag = draggingRoadRef.current ?? draggingRoad;
    if (activeRoadDrag) {
      draggingRoadRef.current = null;
      setDraggingRoad(null);
      setFrozenCamera(null);
      return;
    }

    const activeCityDrag = draggingRef.current ?? dragging;
    if (activeCityDrag) {
      if (!movedRef.current) onSelectMarket(activeCityDrag.id);
      draggingRef.current = null;
      setDragging(null);
      setFrozenCamera(null);
      movedRef.current = false;
      return;
    }

    if (mapTool === "addCity") {
      onAddCity(mapCoordinates(event, camera));
    }
  };

  const handleCityPointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    city: City,
  ) => {
    if (mapTool === "delete") {
      event.stopPropagation();
      onDeleteCity(city.id);
      return;
    }
    if (mapTool !== "move") return;
    event.stopPropagation();
    setPanning(null);
    panningRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    setFrozenCamera(camera);
    const nextDrag: CityDragState = {
      id: city.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: city.x,
      originY: city.y,
    };
    draggingRef.current = nextDrag;
    setDragging(nextDrag);
  };

  const handleRoadPointerDown = (
    event: ReactPointerEvent<SVGPathElement>,
    road: Road,
  ) => {
    if (mapTool === "delete") {
      event.stopPropagation();
      onDeleteRoad(road.id);
      return;
    }
    if (mapTool !== "move") return;
    event.stopPropagation();
    setPanning(null);
    panningRef.current = null;
    event.currentTarget.setPointerCapture(event.pointerId);
    setHoveredRoadId(road.id);
    setFrozenCamera(camera);
    const nextDrag: RoadDragState = {
      id: road.id,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originPoints: road.points.map((point) => ({ ...point })),
      camera,
    };
    draggingRoadRef.current = nextDrag;
    setDraggingRoad(nextDrag);
  };

  const hoverScreen = hoverPoint ? projectPoint(hoverPoint, camera) : null;
  const hoverX = hoverScreen?.x ?? 0;
  const hoverY = hoverScreen?.y ?? 0;
  const hoveredCity = cities.find((city) => city.id === hoveredCityId);
  const hoveredRoad = roads.find((road) => road.id === hoveredRoadId);
  let noteTitle = "";
  let noteDetail = "";

  if (hoveredCity) {
    noteTitle = hoveredCity.name;
    noteDetail =
      mapTool === "delete"
        ? "点击删除此市场"
        : `${hoveredCity.role === "primary" ? "主市场" : "竞争市场"} · 拖动改变位置`;
  } else if (hoveredRoad) {
    noteTitle = hoveredRoad.name;
    noteDetail =
      mapTool === "delete"
        ? "点击删除此道路"
        : config.traffic.enabled
          ? "交通折减开启 · 拖动平移"
          : "交通折减关闭 · 拖动平移";
  } else if (evaluation?.winner) {
    noteTitle = evaluation.winner.crop.name;
    noteDetail = `${evaluation.winner.city.name} · ${formatRent(evaluation.winner.rent)} 元/ha`;
  } else if (hoverPoint) {
    noteTitle = "未耕作";
    noteDetail = "所有作物最高竞租 ≤ 0";
  }

  const noteWidth = 196;
  const noteHeight = 49;
  const noteX =
    hoverX + 14 + noteWidth > size.width - 8
      ? hoverX - noteWidth - 14
      : hoverX + 14;
  const noteY =
    hoverY - noteHeight - 14 < 8
      ? hoverY + 14
      : hoverY - noteHeight - 14;
  const toolHint =
    mapTool === "drawRoad"
      ? "按住鼠标拖动绘制道路；松开后自动启用交通折减"
      : mapTool === "addCity"
        ? "点击地图放置新市场"
        : mapTool === "delete"
          ? "点击道路或竞争城市删除"
          : "";

  return (
    <div className="map-module">
      <div
        className={`map-scene map-tool-${mapTool} ${panning ? "is-panning" : ""} ${dragging ? "is-dragging-city" : ""} ${draggingRoad ? "is-dragging-road" : ""}`}
        ref={wrapperRef}
      >
        <svg
          ref={svgRef}
          className="map-svg"
          viewBox={`0 0 ${size.width} ${size.height}`}
          role="img"
          aria-labelledby="map-title map-description"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            if (
              !dragging &&
              !draggingRoad &&
              draftRoadRef.current.length === 0
            ) {
              setHoverPoint(null);
              setHoveredCityId(null);
              setHoveredRoadId(null);
            }
          }}
        >
          <title id="map-title">杜能农业圈层交互地图</title>
          <desc id="map-description">
            地图展示不同市场与作物在最高地租规则下形成的土地利用圈层，可绘制、移动和删除交通线，并拖动市场位置。
          </desc>
          <defs>
            <pattern
              id="survey-grid"
              width="42"
              height="42"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 42 0 L 0 0 0 42"
                fill="none"
                stroke="var(--border)"
                strokeWidth="0.55"
                opacity="0.56"
              />
            </pattern>
            <pattern
              id="hatch"
              width="7"
              height="7"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(35)"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="7"
                stroke="var(--ochre)"
                strokeWidth="0.6"
                opacity="0.18"
              />
            </pattern>
            <clipPath id="map-frame-clip">
              <rect
                x="0"
                y="0"
                width={size.width}
                height={size.height}
              />
            </clipPath>
          </defs>

          <rect
            width={size.width}
            height={size.height}
            rx="16"
            fill="var(--map-paper)"
          />
          <rect
            width={size.width}
            height={size.height}
            rx="16"
            fill="url(#survey-grid)"
            clipPath="url(#map-frame-clip)"
          />
          <rect
            width={size.width}
            height={size.height}
            rx="16"
            fill="url(#hatch)"
            opacity="0.18"
            clipPath="url(#map-frame-clip)"
          />

          <g
            className="map-clipped-content"
            clipPath="url(#map-frame-clip)"
          >
          <g clipPath="url(#map-frame-clip)">
            {geometry.paths.map((path) => (
              <path
                key={path.crop.id}
                className="land-use-path"
                d={path.d}
                fill={path.crop.fill}
                fillRule="evenodd"
                stroke={path.crop.color}
                strokeOpacity="0.34"
                strokeWidth="1.15"
                strokeLinejoin="round"
              />
            ))}
          </g>

          <g
            className="road-layer"
            aria-label="可编辑交通线"
            clipPath="url(#map-frame-clip)"
          >
            {roads.map((road) => {
              const pathData = roadPathData(road, camera);
              const interactive =
                mapTool === "move" || mapTool === "delete";
              return (
                <g
                  key={road.id}
                  className="road-item"
                  onPointerEnter={() => setHoveredRoadId(road.id)}
                  onPointerLeave={() =>
                    setHoveredRoadId((current) =>
                      current === road.id ? null : current,
                    )
                  }
                >
                  <path
                    className="road-stroke"
                    d={pathData}
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth={Math.max(
                      1.4,
                      config.traffic.enabled
                        ? config.traffic.lineWidth
                        : Math.min(2.2, config.traffic.lineWidth),
                    )}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={config.traffic.enabled ? 0.84 : 0.58}
                    pointerEvents="none"
                  />
                  <path
                    className="road-hit"
                    data-road-id={road.id}
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={Math.max(26, config.traffic.lineWidth + 16)}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents={interactive ? "stroke" : "none"}
                    onPointerDown={(event) =>
                      handleRoadPointerDown(event, road)
                    }
                    onPointerMove={(event) => {
                      event.stopPropagation();
                      handlePointerMove(event);
                    }}
                    onPointerUp={(event) => {
                      event.stopPropagation();
                      handlePointerUp(event);
                    }}
                  >
                    <title>
                      {road.name}；鼠标悬停查看，移动模式拖动，删除模式点击移除
                    </title>
                  </path>
                </g>
              );
            })}
            {draftRoad.length > 1 && (
              <path
                d={roadPathData(
                  { id: "draft", name: "draft", points: draftRoad },
                  camera,
                )}
                fill="none"
                stroke="var(--ink)"
                strokeWidth={Math.max(1.5, config.traffic.lineWidth)}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.9"
                pointerEvents="none"
              />
            )}
          </g>

          <g className="city-layer" clipPath="url(#map-frame-clip)">
            {cities.map((city) => {
              const cityScreen = projectPoint(city, camera);
              return (
                <g
                  key={city.id}
                  className="city-marker"
                  data-city-id={city.id}
                  transform={`translate(${cityScreen.x} ${cityScreen.y})`}
                  onPointerDown={(event) => handleCityPointerDown(event, city)}
                  onPointerMove={(event) => {
                    event.stopPropagation();
                    handlePointerMove(event);
                  }}
                  onPointerUp={(event) => {
                    event.stopPropagation();
                    handlePointerUp(event);
                  }}
                  onPointerEnter={() => setHoveredCityId(city.id)}
                  onPointerLeave={() =>
                    setHoveredCityId((current) =>
                      current === city.id ? null : current,
                    )
                  }
                  onFocus={() => setHoveredCityId(city.id)}
                  onBlur={() =>
                    setHoveredCityId((current) =>
                      current === city.id ? null : current,
                    )
                  }
                  role="button"
                  aria-label={`${city.name}，方向键移动，回车选择，删除模式按 Delete 移除`}
                  aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Delete"
                  tabIndex={0}
                  focusable="true"
                >
                  <circle r="24" fill="transparent" />
                  <circle
                    className="city-keyboard-focus-ring"
                    r="21"
                    fill="none"
                    stroke="var(--road)"
                    strokeWidth="1.8"
                  />
                  <circle
                    r="10"
                    fill="var(--paper)"
                    stroke={city.color}
                    strokeWidth="2"
                  />
                  <circle r="5.7" fill={city.color} />
                </g>
              );
            })}
          </g>

          {hoverPoint && (
            <g className="map-crosshair" pointerEvents="none">
              <line
                x1={hoverX}
                x2={hoverX}
                y1="14"
                y2={size.height - 14}
                stroke="#C65D3B"
                strokeWidth="0.7"
                strokeDasharray="3 5"
                opacity="0.52"
              />
              <line
                x1="14"
                x2={size.width - 14}
                y1={hoverY}
                y2={hoverY}
                stroke="#C65D3B"
                strokeWidth="0.7"
                strokeDasharray="3 5"
                opacity="0.52"
              />
              <circle
                cx={hoverX}
                cy={hoverY}
                r="9"
                fill="none"
                stroke="#C65D3B"
                strokeWidth="1.5"
              />
              <circle cx={hoverX} cy={hoverY} r="2.5" fill="#C65D3B" />
            </g>
          )}

          {hoverPoint && noteTitle && (
            <g
              className="map-hover-note"
              transform={`translate(${noteX} ${noteY})`}
              pointerEvents="none"
            >
              <line
                x1={hoverX < noteX ? -8 : noteWidth + 8}
                y1={hoverY < noteY ? -8 : noteHeight + 8}
                x2={hoverX < noteX ? 0 : noteWidth}
                y2={noteHeight / 2}
                stroke="var(--ink)"
                strokeOpacity="0.28"
              />
              <rect
                width={noteWidth}
                height={noteHeight}
                rx="10"
                fill="var(--paper)"
                fillOpacity="0.96"
                stroke="var(--border)"
                strokeWidth="0.8"
              />
              <text
                x="12"
                y="19"
                fill="var(--ink)"
                fontSize="12.5"
                fontWeight="700"
              >
                {noteTitle.length > 14 ? `${noteTitle.slice(0, 14)}…` : noteTitle}
              </text>
              <text x="12" y="35" fill="var(--muted)" fontSize="11">
                {noteDetail.length > 24
                  ? `${noteDetail.slice(0, 24)}…`
                  : noteDetail}
              </text>
            </g>
          )}
          </g>

        </svg>
        {toolHint && (
          <div className="add-mode-hint">
            <span aria-hidden="true">
              {mapTool === "drawRoad" ? "╱" : mapTool === "delete" ? "×" : "＋"}
            </span>{" "}
            {toolHint}
          </div>
        )}
      </div>

    </div>
  );
}
