import { alpha2FromNumeric } from './countries';

// Minimal GeoJSON shapes; only (Multi)Polygon geometries matter for the map.
export type Position = number[];
export type Ring = Position[];

export interface PolygonGeometry {
  type: 'Polygon';
  coordinates: Ring[];
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon';
  coordinates: Ring[][];
}

export interface GeoFeature {
  type: 'Feature';
  id?: string | number;
  properties: Record<string, unknown> | null;
  geometry: PolygonGeometry | MultiPolygonGeometry | { type: string } | null;
}

export interface GeoCollection {
  type: 'FeatureCollection';
  features: GeoFeature[];
}

export interface MapFeature {
  type: 'Feature';
  properties: { name: string; code: string | null };
  geometry: MultiPolygonGeometry;
}

export interface MapCollection {
  type: 'FeatureCollection';
  features: MapFeature[];
}

/** [west, south, east, north]; drops overseas territories, Svalbard, Canaries, Azores, Asian Russia. */
export const EUROPE_BOX = [-25, 34.5, 36, 72] as const;

type Bounds = [west: number, south: number, east: number, north: number];

function polygonBounds(polygon: Ring[]): Bounds | null {
  const outer = polygon[0];
  if (!outer || outer.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of outer) {
    const x = p[0]!;
    const y = p[1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/**
 * A polygon belongs to the window if its bounding-box centre lies inside and it
 * is not wider than the window. The width check drops rings that run across the
 * antimeridian (Russian mainland, Wrangel Island: -180..180): their centre falls
 * near 0° E and would otherwise be drawn as a band across the whole map.
 */
function belongsToBox(b: Bounds, box: readonly [number, number, number, number]): boolean {
  const cx = (b[0] + b[2]) / 2;
  const cy = (b[1] + b[3]) / 2;
  const fitsWidth = b[2] - b[0] <= box[2] - box[0];
  return fitsWidth && cx >= box[0] && cx <= box[2] && cy >= box[1] && cy <= box[3];
}

/**
 * Keeps only polygons that belong to `box`, so France loses French Guiana but
 * keeps Corsica. Features are named by ISO alpha-2 where known.
 */
export function cropToEurope(
  collection: GeoCollection,
  box: readonly [number, number, number, number] = EUROPE_BOX,
): MapCollection {
  const features: MapFeature[] = [];
  collection.features.forEach((f, i) => {
    const g = f.geometry;
    if (!g) return;
    let polygons: Ring[][];
    if (g.type === 'Polygon') polygons = [(g as PolygonGeometry).coordinates];
    else if (g.type === 'MultiPolygon') polygons = (g as MultiPolygonGeometry).coordinates;
    else return;
    const kept = polygons.filter((poly) => {
      const b = polygonBounds(poly);
      return b != null && belongsToBox(b, box);
    });
    if (kept.length === 0) return;
    const code = alpha2FromNumeric(f.id);
    features.push({
      type: 'Feature',
      properties: { name: code ?? `_${i}`, code },
      geometry: { type: 'MultiPolygon', coordinates: kept },
    });
  });
  return { type: 'FeatureCollection', features };
}
