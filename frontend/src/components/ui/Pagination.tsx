import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  lastPage: number;
  total: number;
  perPage: number;
  from: number;
  to: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  lastPage,
  total,
  perPage: _perPage,
  from,
  to,
  onPageChange,
  className = '',
}: PaginationProps) {
  if (lastPage <= 1) return null;

  /**
   * Build a compact page number list with ellipsis.
   * Always shows: first, last, current ± 1, and fills gaps with "...".
   */
  const buildPages = (): (number | '...')[] => {
    const range = new Set<number>();
    range.add(1);
    range.add(lastPage);
    for (let i = Math.max(1, currentPage - 1); i <= Math.min(lastPage, currentPage + 1); i++) {
      range.add(i);
    }

    const sorted = Array.from(range).sort((a, b) => a - b);
    const result: (number | '...')[] = [];

    for (let i = 0; i < sorted.length; i++) {
      result.push(sorted[i]);
      if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) {
        result.push('...');
      }
    }

    return result;
  };

  const pages = buildPages();

  const btnBase =
    'inline-flex items-center justify-center w-8 h-8 rounded text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1';
  const btnActive = 'bg-blue-600 text-white';
  const btnNormal = 'text-gray-600 hover:bg-gray-100';
  const btnDisabled = 'text-gray-300 cursor-not-allowed';

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 ${className}`}>
      {/* Result count */}
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium text-gray-700">{from}</span>–<span className="font-medium text-gray-700">{to}</span> of{' '}
        <span className="font-medium text-gray-700">{total}</span> results
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnNormal}`}
          aria-label="First page"
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`${btnBase} ${currentPage === 1 ? btnDisabled : btnNormal}`}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {pages.map((page, idx) =>
          page === '...' ? (
            <span key={`ellipsis-${idx}`} className="w-8 text-center text-gray-400 text-sm select-none">
              …
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} ${page === currentPage ? btnActive : btnNormal}`}
              aria-current={page === currentPage ? 'page' : undefined}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === lastPage}
          className={`${btnBase} ${currentPage === lastPage ? btnDisabled : btnNormal}`}
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Last */}
        <button
          onClick={() => onPageChange(lastPage)}
          disabled={currentPage === lastPage}
          className={`${btnBase} ${currentPage === lastPage ? btnDisabled : btnNormal}`}
          aria-label="Last page"
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
