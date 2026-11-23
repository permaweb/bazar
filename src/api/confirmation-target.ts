/**
 * Arweave confirmation depth that listing, cancel, transfer and mint
 * transactions are watched to before Bazar waits for live process state.
 *
 * Kept in this dependency-free module so the eagerly loaded app shell can read
 * it without pulling the lazily loaded transaction runtime into the main chunk.
 */
export const ASSET_TRANSACTION_CONFIRMATION_TARGET = 5;
