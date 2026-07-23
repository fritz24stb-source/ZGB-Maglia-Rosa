export const ADMIN_ACTIVITY_PAGE_SIZE = 1000;

type PageResult<Row> = {
  data: Row[] | null;
  error: unknown;
};

export async function loadAllPages<Row>({
  fetchPage,
  pageSize = ADMIN_ACTIVITY_PAGE_SIZE,
}: {
  fetchPage: (range: { from: number; to: number }) => Promise<PageResult<Row>>;
  pageSize?: number;
}): Promise<Row[]> {
  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize muss eine positive ganze Zahl sein.");
  }

  const rows: Row[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage({
      from,
      to: from + pageSize - 1,
    });

    if (error) {
      throw error;
    }

    const page = data ?? [];
    rows.push(...page);

    if (page.length < pageSize) {
      return rows;
    }
  }
}
