export enum WalletEnum {
	arConnect = 'arconnect',
	othent = 'othent',
}

export type ProfileType = {
	txId: string;
	displayName: string | null;
	handle: string | null;
	avatar: string | null;
	walletAddress: string;
	profileIndex: string | null;
	banner: string | null;
};