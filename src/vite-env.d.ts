/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMeta {
	glob: (pattern: string, options?: { as?: 'raw' | 'url' | 'default' }) => Record<string, () => Promise<string>>;
}
