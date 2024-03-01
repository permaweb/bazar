export function checkWindowCutoff(width: number): boolean {
	return window.innerWidth > width;
}

export function hideDocumentBody(): void {
	document.body.style.overflow = 'hidden';
}

export function showDocumentBody(): void {
	document.body.style.overflow = 'auto';
}

export function checkWindowResize(fn: () => void): void {
	window.addEventListener('resize', fn);
}

export function scrollTo(x: number, y: number, behavior?: 'smooth') {
	setTimeout(function () {
		const obj = behavior ? { left: x, top: y, behavior: behavior } : { left: x, top: y };
		window.scrollTo(obj);
	}, 0);
}

export function scrollIntoView(elementId: string) {
	const element = document.getElementById(elementId);
	if (element) {
		element.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}
