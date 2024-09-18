import React from 'react';

import { LanguageContext } from './LanguageProvider';
import * as S from './styles';

interface ErrorBoundaryState {
	hasError: boolean;
}

interface ErrorBoundaryProps {
	children: React.ReactNode;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	static contextType = LanguageContext;
	context!: React.ContextType<typeof LanguageContext>;

	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		console.log('ErrorBoundary caught an error', error);
		return { hasError: true };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
		console.log('ErrorBoundary caught an error', error, errorInfo);
	}

	render() {
		const { object, current } = this.context;

		if (this.state.hasError) {
			return (
				<S.ErrorBoundaryContainer className={'border-wrapper-alt1'}>
					<h4>{object && current ? object[current].appError : '-'}</h4>
				</S.ErrorBoundaryContainer>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
