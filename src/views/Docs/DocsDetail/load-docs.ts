// Import all markdown files using Vite's glob import
const docsModules = import.meta.glob('./MD/**/*.md', { as: 'raw' });

const buildDirectory = () => {
	const dir = {};
	Object.keys(docsModules).forEach((key: string) => {
		// Remove './MD/' prefix and split by '/'
		const parts = key.replace('./MD/', '').split('/');
		let currentLevel: any = dir;
		parts.forEach((part: string, index: number) => {
			const isFile = index === parts.length - 1 && /\.md$/.test(part);
			const name = isFile ? part.slice(0, -3) : part;
			if (isFile) {
				if (!currentLevel.files) {
					currentLevel.files = [];
				}
				currentLevel.files.push(name);
			} else {
				if (!currentLevel[name]) {
					currentLevel[name] = {};
				}
				currentLevel = currentLevel[name];
			}
		});
	});
	return dir;
};

export const getDocTree = () => {
	return buildDirectory();
};

export const loadDoc = async (docPath: string) => {
	const path = `./MD/${docPath}.md`;
	const loader = docsModules[path];
	if (loader) {
		return await loader();
	}
	return '';
};
