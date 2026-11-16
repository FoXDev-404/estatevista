export function parsePagination(query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const offset = (page - 1) * limit;
  return { page, limit, from: offset, to: offset + limit - 1 };
}

export function paginated(data, total, page, limit) {
  const count = Number(total || 0);
  return {
    data,
    meta: {
      page,
      limit,
      total: count,
      pages: Math.max(1, Math.ceil(count / limit)),
    },
  };
}
