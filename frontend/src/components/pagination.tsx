"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pages,
  onPageChange,
}: {
  page: number;
  pages: number;
  onPageChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  const visible = Array.from(new Set([
    1,
    pages,
    page - 1,
    page,
    page + 1,
  ].filter((item) => item >= 1 && item <= pages))).sort((a, b) => a - b);

  return (
    <nav className="pagination" aria-label="List pages">
      <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
        <ChevronLeft size={15} />
      </button>
      {visible.map((item, index) => (
        <span key={item}>
          {index > 0 && item - visible[index - 1]! > 1 && <i>…</i>}
          <button
            type="button"
            className={item === page ? "active" : ""}
            aria-current={item === page ? "page" : undefined}
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        </span>
      ))}
      <button type="button" disabled={page === pages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
        <ChevronRight size={15} />
      </button>
    </nav>
  );
}
