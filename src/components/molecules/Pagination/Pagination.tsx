import { ArrowLeft, ArrowRight } from 'lucide-react';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';

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

export default function Pagination(props: {
	ariaLabel: string;
	className?: string;
	nextLabel: string;
	onPageChange(page: number): void;
	page: number;
	pageCount: number;
	pageLabel(page: number): string;
	previousLabel: string;
}) {
	if (props.pageCount <= 1) return null;
	return (
		<nav aria-label={props.ariaLabel} className={['pagination', props.className ?? ''].filter(Boolean).join(' ')}>
			<Button disabled={props.page === 1} onClick={() => props.onPageChange(props.page - 1)} size="small">
				<Icon icon={ArrowLeft} size="xs" />
				{props.previousLabel}
			</Button>
			<div className="pagination-pages">
				{paginationItems(props.page, props.pageCount).map((item) => {
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
							aria-current={itemPage === props.page ? 'page' : undefined}
							aria-label={props.pageLabel(itemPage)}
							key={itemPage}
							onClick={() => props.onPageChange(itemPage)}
							size="small"
						>
							{itemPage}
						</Button>
					);
				})}
			</div>
			<Button
				disabled={props.page === props.pageCount}
				onClick={() => props.onPageChange(props.page + 1)}
				size="small"
			>
				{props.nextLabel}
				<Icon icon={ArrowRight} size="xs" />
			</Button>
		</nav>
	);
}
