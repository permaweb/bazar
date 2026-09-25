// Returns a copy of `props` without the listed keys, for components that forward remaining
// attributes to a DOM element while reading their own props through `props.name`.
export function omitProps<T extends object, K extends keyof T>(props: T, keys: readonly K[]): Omit<T, K> {
	const rest = { ...props };
	for (const key of keys) delete rest[key];
	return rest;
}
