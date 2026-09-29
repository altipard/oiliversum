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

function polygonCenter(polygon: Ring[]): [number, number] | null {
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
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function insideBox([x, y]: [number, number], box: readonly [number, number, number, number]): boolean {
  return x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
}

/**
 * Keeps only polygons whose bounding-box centre lies in `box`, so France loses
 * French Guiana but keeps Corsica. Features are named by ISO alpha-2 where known.
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
      const c = polygonCenter(poly);
      return c != null && insideBox(c, box);
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
