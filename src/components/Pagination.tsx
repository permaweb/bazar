import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from './Button';

export function paginationItems(page: number, pageCount: number) {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => String(index + 1));
  const visible = new Set([1, pageCount, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((item) => visible.add(item));
  if (page >= pageCount - 2) [pageCount - 3, pageCount - 2, pageCount - 1].forEach((item) => visible.add(item));
  const pages = [...visible].filter((item) => item > 0 && item <= pageCount).sort((left, right) => left - right);
  return pages.flatMap((item, index) => {
    const previous = pages[index - 1];
    return previous && item - previous > 1 ? [`ellipsis-${previous}`, String(item)] : [String(item)];
  });
}

export function Pagination({
  ariaLabel,
  className,
  onPageChange,
  page,
  pageCount,
}: {
  ariaLabel: string;
  className?: string;
  onPageChange(page: number): void;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={ariaLabel} className={['pagination', className ?? ''].filter(Boolean).join(' ')}>
      <Button disabled={page === 1} onClick={() => onPageChange(page - 1)} size="small">
        <ArrowLeft className="ui-icon ui-icon--xs" aria-hidden="true" />
        Previous
      </Button>
      <div className="pagination-pages">
        {paginationItems(page, pageCount).map((item) => {
          if (item.startsWith('ellipsis-')) {
            return (
              <span aria-hidden="true" className="pagination-ellipsis" key={item}>
                …
              </span>
            );
          }
          const itemPage = Number(item);
          return (
            <Button
              aria-current={itemPage === page ? 'page' : undefined}
              aria-label={`Page ${itemPage}`}
              key={itemPage}
              onClick={() => onPageChange(itemPage)}
              size="small"
            >
              {itemPage}
            </Button>
          );
        })}
      </div>
      <Button disabled={page === pageCount} onClick={() => onPageChange(page + 1)} size="small">
        Next
        <ArrowRight className="ui-icon ui-icon--xs" aria-hidden="true" />
      </Button>
    </nav>
  );
}
