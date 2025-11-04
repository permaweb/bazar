export interface TokenSelectorProps {
	onTokenChange?: (tokenId: string) => void;
	className?: string;
	showLabel?: boolean;
	disabledTokens?: string[];
}
