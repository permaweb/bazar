import React from 'react';
import { ReactSVG } from 'react-svg';

import { ASSETS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';

import * as S from './styles';
import { IProps } from './types';

export default function EbookRenderer(props: IProps) {
	const [content, setContent] = React.useState<string>('');
	const [loading, setLoading] = React.useState<boolean>(true);
	const [error, setError] = React.useState<string | null>(null);
	const [currentPage, setCurrentPage] = React.useState<number>(1);
	const [pages, setPages] = React.useState<string[]>([]);
	const [wordsPerPage, setWordsPerPage] = React.useState<number>(300);
	const [isPdf, setIsPdf] = React.useState<boolean>(false);
	const [pdfUrl, setPdfUrl] = React.useState<string | null>(null);

	// Check if asset is PDF by fetching headers first
	React.useEffect(() => {
		async function checkContentType() {
			try {
				const endpoint = getTxEndpoint(props.assetId);
				const response = await fetch(endpoint, { method: 'HEAD' });
				const contentType = response.headers.get('content-type') || '';

				if (contentType.includes('application/pdf')) {
					setIsPdf(true);
					setPdfUrl(endpoint);
					setLoading(false);
					return;
				}

				// If not PDF, fetch as text
				setIsPdf(false);
				await fetchTextContent(endpoint);
			} catch (e: any) {
				console.error('[EbookRenderer] Error checking content type:', e);
				// Fallback: try to fetch as text
				await fetchTextContent(getTxEndpoint(props.assetId));
			}
		}

		async function fetchTextContent(endpoint: string) {
			try {
				setLoading(true);
				setError(null);
				console.log('[EbookRenderer] Fetching text ebook from:', endpoint);

				const response = await fetch(endpoint);
				console.log('[EbookRenderer] Response status:', response.status, response.statusText);

				if (!response.ok) {
					throw new Error(`Failed to fetch ebook: ${response.status} ${response.statusText}`);
				}

				const text = await response.text();
				console.log('[EbookRenderer] Fetched text length:', text.length);

				if (!text || text.trim().length === 0) {
					throw new Error('Ebook content is empty');
				}

				setContent(text);
				parseIntoPages(text);
			} catch (e: any) {
				console.error('[EbookRenderer] Error fetching text ebook:', e);
				setError(e.message || 'Failed to load ebook');
			} finally {
				setLoading(false);
			}
		}

		if (props.assetId) {
			checkContentType();
		}
	}, [props.assetId]);

	// Parse content into pages
	function parseIntoPages(text: string) {
		if (!text || text.trim().length === 0) {
			console.warn('[EbookRenderer] No text to parse');
			setPages([]);
			return;
		}

		// Split by paragraphs first, but also handle single-line breaks
		const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);

		// If no double-line breaks, split by single line breaks
		if (paragraphs.length === 1 && paragraphs[0].includes('\n')) {
			const lines = paragraphs[0].split('\n').filter((l) => l.trim().length > 0);
			paragraphs.length = 0;
			paragraphs.push(...lines);
		}

		const pageContent: string[] = [];
		let currentPageContent = '';

		paragraphs.forEach((paragraph) => {
			const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
			const currentWords = currentPageContent.split(/\s+/).filter((w) => w.length > 0);

			if (currentWords.length + words.length > wordsPerPage && currentPageContent) {
				pageContent.push(currentPageContent.trim());
				currentPageContent = paragraph + '\n\n';
			} else {
				currentPageContent += (currentPageContent ? '\n\n' : '') + paragraph;
			}
		});

		if (currentPageContent.trim()) {
			pageContent.push(currentPageContent.trim());
		}

		console.log('[EbookRenderer] Parsed into', pageContent.length, 'pages');
		setPages(pageContent);
		if (pageContent.length > 0 && currentPage > pageContent.length) {
			setCurrentPage(1);
		}
	}

	// Re-parse when words per page changes
	React.useEffect(() => {
		if (content) {
			parseIntoPages(content);
		}
	}, [wordsPerPage]);

	function handlePreviousPage() {
		if (currentPage > 1) {
			setCurrentPage(currentPage - 1);
		}
	}

	function handleNextPage() {
		if (currentPage < pages.length) {
			setCurrentPage(currentPage + 1);
		}
	}

	function handlePageInput(e: React.ChangeEvent<HTMLInputElement>) {
		const page = parseInt(e.target.value, 10);
		if (!isNaN(page) && page >= 1 && page <= pages.length) {
			setCurrentPage(page);
		}
	}

	if (loading) {
		return (
			<S.Wrapper>
				<S.Loader>Loading ebook...</S.Loader>
			</S.Wrapper>
		);
	}

	if (error) {
		return (
			<S.Wrapper>
				<S.Error>Error: {error}</S.Error>
			</S.Wrapper>
		);
	}

	// Render PDF using iframe
	if (isPdf && pdfUrl) {
		return (
			<S.Wrapper>
				<S.PdfContainer>
					<S.PdfFrame src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`} title="PDF Viewer" />
				</S.PdfContainer>
				<S.PdfInfo>
					<span>PDF Document - Use browser controls to navigate</span>
				</S.PdfInfo>
			</S.Wrapper>
		);
	}

	if (pages.length === 0 && content) {
		// Fallback: if pagination failed but we have content, show it all
		return (
			<S.Wrapper>
				<S.BookContainer>
					<S.Page>
						<S.PageContent>
							<S.PageText>{content}</S.PageText>
						</S.PageContent>
					</S.Page>
				</S.BookContainer>
			</S.Wrapper>
		);
	}

	if (pages.length === 0) {
		return (
			<S.Wrapper>
				<S.Error>No content to display</S.Error>
			</S.Wrapper>
		);
	}

	return (
		<S.Wrapper>
			<S.BookContainer>
				<S.Page>
					<S.PageContent>
						<S.PageText>{pages[currentPage - 1] || 'No content'}</S.PageText>
					</S.PageContent>
					<S.PageNumber>
						Page {currentPage} of {pages.length}
					</S.PageNumber>
				</S.Page>
			</S.BookContainer>
			<S.Controls>
				<S.ControlButton onClick={handlePreviousPage} disabled={currentPage === 1}>
					<ReactSVG src={ASSETS.arrowPrevious} />
					<span>Previous</span>
				</S.ControlButton>
				<S.PageInputWrapper>
					<input type="number" min="1" max={pages.length} value={currentPage} onChange={handlePageInput} />
					<span> / {pages.length}</span>
				</S.PageInputWrapper>
				<S.ControlButton onClick={handleNextPage} disabled={currentPage === pages.length}>
					<span>Next</span>
					<ReactSVG src={ASSETS.arrowNext} />
				</S.ControlButton>
			</S.Controls>
		</S.Wrapper>
	);
}
