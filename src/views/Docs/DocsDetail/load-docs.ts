const readDirectory = (ctx: any) => {
	const dir = {};
	ctx.keys().forEach((key: any) => {
		const parts = key.slice(2).split('/');
		let currentLevel: any = dir;
		parts.forEach((part: any) => {
			const isFile = /\.md$/.test(part);
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

const docsContext: any = (require as any).context('./MD', true, /\.md$/);

export const getDocTree = () => {
	return readDirectory(docsContext);
};

export const loadDoc = (docPath: any) => {
	return docsContext(`./${docPath}.md`).default;
};
