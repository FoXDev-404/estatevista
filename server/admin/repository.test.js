import { describe, expect, it } from 'vitest';
import { SupabaseAdminRepository } from './repository.js';

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const BUILDING_ID = 'b1111111-1111-4111-8111-111111111111';
const FLOOR_ID = 'c1111111-1111-4111-8111-111111111111';

/**
 * Minimal fake of the supabase-js query builder. It stores rows in memory,
 * applies the filters the repository uses, and mimics the composite foreign
 * keys from migration 002: deleting a building or floor still referenced by a
 * unit fails with a 23503 error.
 */
function createFakeClient({ units = [], buildings = [], floors = [] } = {}) {
  const state = {
    units: units.map((row) => ({ ...row })),
    buildings: buildings.map((row) => ({ ...row })),
    floors: floors.map((row) => ({ ...row })),
  };

  function matches(row, filters) {
    return filters.every(([column, operator, value]) => {
      if (operator === 'eq') return row[column] === value;
      if (operator === 'is') return row[column] === value;
      if (operator === 'notIs') return row[column] !== value;
      throw new Error(`Unsupported filter ${operator}`);
    });
  }

  function from(table) {
    const filters = [];
    const builder = {
      operation: 'select',
      payload: null,
      eq(column, value) {
        filters.push([column, 'eq', value]);
        return builder;
      },
      is(column, value) {
        filters.push([column, 'is', value]);
        return builder;
      },
      not(column, operator, value) {
        if (operator !== 'is') throw new Error(`Unsupported not operator ${operator}`);
        filters.push([column, 'notIs', value]);
        return builder;
      },
      update(payload) {
        builder.operation = 'update';
        builder.payload = payload;
        return builder;
      },
      delete() {
        builder.operation = 'delete';
        return builder;
      },
      select() {
        return builder;
      },
      single() {
        return builder;
      },
      maybeSingle() {
        return builder;
      },
      then(resolve) {
        return Promise.resolve(execute()).then(resolve);
      },
    };

    function execute() {
      const rows = state[table] || [];
      const targets = rows.filter((row) => matches(row, filters));

      if (builder.operation === 'update') {
        targets.forEach((row) => Object.assign(row, builder.payload));
        return { data: targets, error: null };
      }

      if (builder.operation === 'delete') {
        if (table === 'buildings') {
          const id = filters.find(([column]) => column === 'id')?.[2];
          if (state.units.some((row) => row.building_id === id)) {
            return {
              data: null,
              error: {
                code: '23503',
                message:
                  'update or delete on table "buildings" violates foreign key constraint "units_building_id_company_id_fkey" on table "units"',
              },
            };
          }
          state.buildings = state.buildings.filter((row) => !targets.includes(row));
          state.floors = state.floors.filter((row) => row.building_id !== id);
          return { data: targets, error: null };
        }
        if (table === 'floors') {
          const id = filters.find(([column]) => column === 'id')?.[2];
          if (state.units.some((row) => row.floor_id === id)) {
            return {
              data: null,
              error: {
                code: '23503',
                message:
                  'update or delete on table "floors" violates foreign key constraint "units_floor_id_company_id_fkey" on table "units"',
              },
            };
          }
          state.floors = state.floors.filter((row) => !targets.includes(row));
          return { data: targets, error: null };
        }
        state[table] = rows.filter((row) => !targets.includes(row));
        return { data: targets, error: null };
      }

      return { data: targets, error: null };
    }

    return builder;
  }

  return { from, state };
}

function unitRow(overrides) {
  return {
    id: 'e1111111-1111-4111-8111-111111111111',
    company_id: COMPANY_ID,
    building_id: BUILDING_ID,
    floor_id: FLOOR_ID,
    deleted_at: null,
    ...overrides,
  };
}

describe('SupabaseAdminRepository inventory deletes', () => {
  it('detaches soft-deleted units before deleting their building', async () => {
    const client = createFakeClient({
      buildings: [{ id: BUILDING_ID, company_id: COMPANY_ID, code: 'A' }],
      floors: [{ id: FLOOR_ID, company_id: COMPANY_ID, building_id: BUILDING_ID, number: 1 }],
      units: [unitRow({ deleted_at: '2026-11-16T12:00:00.000Z' })],
    });
    const repository = new SupabaseAdminRepository(client);

    await repository.deleteBuilding(COMPANY_ID, BUILDING_ID);

    expect(client.state.buildings).toHaveLength(0);
    expect(client.state.floors).toHaveLength(0);
    expect(client.state.units[0].building_id).toBeNull();
    expect(client.state.units[0].floor_id).toBeNull();
  });

  it('detaches soft-deleted units before deleting their floor', async () => {
    const client = createFakeClient({
      buildings: [{ id: BUILDING_ID, company_id: COMPANY_ID, code: 'A' }],
      floors: [{ id: FLOOR_ID, company_id: COMPANY_ID, building_id: BUILDING_ID, number: 1 }],
      units: [unitRow({ deleted_at: '2026-11-16T12:00:00.000Z' })],
    });
    const repository = new SupabaseAdminRepository(client);

    await repository.deleteFloor(COMPANY_ID, BUILDING_ID, FLOOR_ID);

    expect(client.state.floors).toHaveLength(0);
    expect(client.state.units[0].floor_id).toBeNull();
  });

  it('still refuses to delete a building that has a live unit', async () => {
    const client = createFakeClient({
      buildings: [{ id: BUILDING_ID, company_id: COMPANY_ID, code: 'A' }],
      floors: [{ id: FLOOR_ID, company_id: COMPANY_ID, building_id: BUILDING_ID, number: 1 }],
      units: [unitRow()],
    });
    const repository = new SupabaseAdminRepository(client);

    await expect(repository.deleteBuilding(COMPANY_ID, BUILDING_ID)).rejects.toMatchObject({
      status: 500,
    });
    expect(client.state.units[0].building_id).toBe(BUILDING_ID);
  });
});
