"use client";

import { useCallback, useState } from "react";

export const PAGE_SIZE = 10;

/** Client-side pagination for record lists. The page is clamped to the available range. */
export function usePagination(total: number, pageSize: number = PAGE_SIZE) {
  const [requestedPage, setRequestedPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, requestedPage), pageCount);
  const start = (page - 1) * pageSize;

  const goTo = useCallback((next: number) => {
    if (!Number.isFinite(next)) return;
    setRequestedPage(Math.min(pageCount, Math.max(1, Math.trunc(next))));
  }, [pageCount]);

  const previous = useCallback(() => goTo(page - 1), [goTo, page]);
  const next = useCallback(() => goTo(page + 1), [goTo, page]);

  const pageSlice = useCallback(
    <T,>(items: T[]): T[] => items.slice(start, start + pageSize),
    [start, pageSize],
  );

  return {
    page,
    pageCount,
    total,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
    canPrevious: page > 1,
    canNext: page < pageCount,
    goTo,
    previous,
    next,
    pageSlice,
  };
}

export type PaginationState = ReturnType<typeof usePagination>;

export function PaginationControls({ pagination }: { pagination: PaginationState }) {
  if (pagination.total === 0) return null;

  return (
    <div className="pagination" aria-label="Pagination">
      <span className="pagination-summary">
        Showing {pagination.rangeStart}–{pagination.rangeEnd} of {pagination.total}
      </span>
      <div className="pagination-controls">
        <button
          className="button button-secondary row-action"
          type="button"
          onClick={pagination.previous}
          disabled={!pagination.canPrevious}
        >
          Previous
        </button>
        <span className="pagination-page">Page</span>
        <input
          className="pagination-input"
          type="number"
          min={1}
          max={pagination.pageCount}
          value={pagination.page}
          aria-label="Page number"
          onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value > 0) pagination.goTo(value);
          }}
        />
        <span className="pagination-page">of {pagination.pageCount}</span>
        <button
          className="button button-secondary row-action"
          type="button"
          onClick={pagination.next}
          disabled={!pagination.canNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default PaginationControls;
