import { describe, expect, it } from 'vitest';
import { fetchAllPages } from './paging';

describe('fetchAllPages', () => {
  it('requests consecutive ranges until a short page arrives', async () => {
    const total = Array.from({ length: 7 }, (_, i) => i);
    const calls: [number, number][] = [];
    const rows = await fetchAllPages<number>(async (from, to) => {
      calls.push([from, to]);
      return { data: total.slice(from, to + 1), error: null };
    }, 3);
    expect(rows).toEqual(total);
    expect(calls).toEqual([
      [0, 2],
      [3, 5],
      [6, 8],
    ]);
  });

  it('stops after an exactly full last page with one empty request', async () => {
    let calls = 0;
    const rows = await fetchAllPages<number>(async (from) => {
      calls++;
      return { data: from < 4 ? [from, from + 1] : [], error: null };
    }, 2);
    expect(rows).toEqual([0, 1, 2, 3]);
    expect(calls).toBe(3);
  });

  it('throws the PostgREST error message', async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom');
  });

  it('refuses to loop forever', async () => {
    await expect(fetchAllPages<number>(async () => ({ data: [1], error: null }), 1, 3)).rejects.toThrow();
  });
});
