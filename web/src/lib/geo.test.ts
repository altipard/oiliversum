import { describe, expect, it } from 'vitest';
import { cropToEurope, type GeoCollection, type Ring } from './geo';

function square(x: number, y: number, size = 1): Ring[] {
  return [
    [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ],
  ];
}

describe('cropToEurope', () => {
  const collection: GeoCollection = {
    type: 'FeatureCollection',
    features: [
      {
        // France: mainland plus French Guiana
        type: 'Feature',
        id: '250',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: [square(0, 45, 5), square(-53, 3, 2)] },
      },
      { type: 'Feature', id: '300', properties: {}, geometry: { type: 'Polygon', coordinates: square(22, 38) } },
      // Russia: Kaliningrad plus a far-east polygon
      {
        type: 'Feature',
        id: '643',
        properties: {},
        geometry: { type: 'MultiPolygon', coordinates: [square(20, 54.5), square(100, 60, 20)] },
      },
      // United States, entirely outside
      { type: 'Feature', id: '840', properties: {}, geometry: { type: 'Polygon', coordinates: square(-100, 40) } },
      // Kosovo has no ISO numeric id in world-atlas
      { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: square(20.5, 42.3) } },
      { type: 'Feature', id: '276', properties: {}, geometry: null },
    ],
  };

  const cropped = cropToEurope(collection);

  it('keeps European polygons and drops overseas ones', () => {
    const fr = cropped.features.find((f) => f.properties.code === 'FR')!;
    expect(fr.geometry.coordinates).toHaveLength(1);
    const ru = cropped.features.find((f) => f.properties.code === 'RU')!;
    expect(ru.geometry.coordinates).toHaveLength(1);
  });

  it('names features by alpha-2, keeps unknown European ones under a placeholder and drops the rest', () => {
    expect(cropped.features.map((f) => f.properties.name)).toEqual(['FR', 'GR', 'RU', '_4']);
    expect(cropped.features[3]!.properties.code).toBeNull();
    expect(cropped.features[1]!.geometry.type).toBe('MultiPolygon');
  });
});
