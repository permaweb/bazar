#!/usr/bin/env node

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';

const argumentsList = process.argv.slice(2);
const rootArgumentIndex = argumentsList.indexOf('--root');
const projectRoot = path.resolve(rootArgumentIndex >= 0 ? argumentsList[rootArgumentIndex + 1] : process.cwd());
const shouldCheckPerformance = argumentsList.includes('--performance');
const configurationPath = path.join(projectRoot, '.permaweb-frontend.json');
const hasConfiguration = fs.existsSync(configurationPath);

function toPosix(filePath) {
	return filePath.split(path.sep).join('/');
}

function readJson(filePath) {
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Unknown JSON error';
		process.stderr.write(`Unable to read ${toPosix(path.relative(projectRoot, filePath))}: ${message}\n`);
		process.exit(1);
	}
}

const configuration = hasConfiguration ? readJson(configurationPath) : {};
const sourceRoot = path.resolve(projectRoot, configuration.sourceRoot ?? 'src');
const testRoot = path.resolve(projectRoot, configuration.testRoot ?? 'tests');
const sourceRootName = toPosix(path.relative(projectRoot, sourceRoot));
// Resolve the project's actual aliases as well as relative imports. Otherwise
// a repo using bare aliases (api/, providers/, etc.) silently escapes graph checks.
let resolveProjectImport;
const typescriptConfigPath = path.join(projectRoot, 'tsconfig.json');
if (fs.existsSync(typescriptConfigPath)) {
	const requireFromProject = createRequire(path.join(projectRoot, 'package.json'));
	const ts = requireFromProject('typescript');
	const parsed = ts.getParsedCommandLineOfConfigFile(
		typescriptConfigPath,
		{},
		{
			...ts.sys,
			onUnRecoverableConfigFileDiagnostic(diagnostic) {
				throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
			},
		}
	);
	const cache = ts.createModuleResolutionCache(projectRoot, (value) => value, parsed.options);
	resolveProjectImport = (specifier, sourceFile) => {
		const resolved = ts.resolveModuleName(specifier, sourceFile, parsed.options, ts.sys, cache).resolvedModule;
		if (!resolved || resolved.isExternalLibraryImport) return null;
		return path.resolve(resolved.resolvedFileName);
	};
}
const violations = [];
const knownRules = new Set([
	'api-boundary',
	'api-public-api',
	'callback-prop-name',
	'component-directory-contract',
	'dependency-cycle',
	'dependency-direction',
	'design-token',
	'feature-atom',
	'feature-public-api',
	'loose-component',
	'mega-barrel',
	'native-control-ownership',
	'navigation-ownership',
	'performance-budget',
	'performance-freshness',
	'performance-output',
	'react-default-import',
	'repository-artifact',
	'test-placement',
]);

if (!hasConfiguration) {
	violations.push({
		rule: 'invalid-configuration',
		path: '.permaweb-frontend.json',
		message: 'Create the adoption-state and performance-budget configuration before validation can pass.',
	});
}

if (configuration.status && !['adopting', 'compliant'].includes(configuration.status)) {
	violations.push({
		rule: 'invalid-configuration',
		path: '.permaweb-frontend.json',
		message: 'Status must be either "adopting" or "compliant".',
	});
}
if (configuration.status === 'compliant') {
	if (!Number.isInteger(configuration.contractVersion) || configuration.contractVersion < 1) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Compliant repositories require a positive integer contractVersion.',
		});
	}
	if (!configuration.performanceBudgets?.directories?.length) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Compliant repositories require at least one production-output performance budget.',
		});
	}
	if (configuration.exceptions?.length) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Compliant status does not allow active architecture exceptions.',
		});
	}
}

for (const budget of configuration.performanceBudgets?.directories ?? []) {
	if (typeof budget.path !== 'string' || !Number.isFinite(budget.maxBytes) || budget.maxBytes <= 0) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Directory budgets require a path and positive maxBytes.',
		});
	}
}
for (const budget of configuration.performanceBudgets?.extensions ?? []) {
	if (
		typeof budget.path !== 'string' ||
		typeof budget.extension !== 'string' ||
		!budget.extension.startsWith('.') ||
		!Number.isFinite(budget.maxFileBytes) ||
		budget.maxFileBytes <= 0
	) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Extension budgets require a path, dotted extension, and positive maxFileBytes.',
		});
	}
}
if (
	configuration.collectionThresholds?.virtualizeAfter !== undefined &&
	(!Number.isInteger(configuration.collectionThresholds.virtualizeAfter) ||
		configuration.collectionThresholds.virtualizeAfter <= 0)
) {
	violations.push({
		rule: 'invalid-configuration',
		path: '.permaweb-frontend.json',
		message: 'collectionThresholds.virtualizeAfter must be a positive integer.',
	});
}
for (const [fieldName, fieldValue] of [
	['designTokenPaths', configuration.designTokenPaths],
	['externalSdkPackages', configuration.externalSdkPackages],
	['performanceInputs', configuration.performanceInputs],
]) {
	if (
		fieldValue !== undefined &&
		(!Array.isArray(fieldValue) || fieldValue.some((value) => typeof value !== 'string' || !value))
	) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: `${fieldName} must be an array of non-empty paths or package names.`,
		});
	}
}

function relativePath(filePath) {
	return toPosix(path.relative(projectRoot, filePath));
}

function matchesException(rule, filePath) {
	const relative = relativePath(filePath);
	return (configuration.exceptions ?? []).some((exception) => {
		if (exception.rule !== rule || typeof exception.path !== 'string') return false;
		const doubleStarMarker = '__DOUBLE_STAR__';
		const escaped = exception.path
			.replaceAll('**', doubleStarMarker)
			.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
			.replaceAll('*', '[^/]*')
			.replaceAll(doubleStarMarker, '.*');
		return new RegExp(`^${escaped}$`).test(relative);
	});
}

function report(rule, filePath, message) {
	if (matchesException(rule, filePath)) return;
	violations.push({ rule, path: relativePath(filePath), message });
}

function walk(directory, options = {}) {
	if (!fs.existsSync(directory)) return [];
	const excluded = new Set(options.excluded ?? []);
	return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		if (excluded.has(entry.name)) return [];
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return walk(entryPath, options);
		return [entryPath];
	});
}

function directories(directory) {
	if (!fs.existsSync(directory)) return [];
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => path.join(directory, entry.name));
}

if (!fs.existsSync(sourceRoot)) {
	process.stderr.write(`Source root does not exist: ${sourceRootName}\n`);
	process.exit(1);
}
if (configuration.status === 'compliant' && !fs.existsSync(testRoot)) {
	violations.push({
		rule: 'invalid-configuration',
		path: '.permaweb-frontend.json',
		message: `Compliant repositories require the configured ${relativePath(testRoot)} test root.`,
	});
}

for (const exception of configuration.exceptions ?? []) {
	if (!knownRules.has(exception.rule)) {
		violations.push({
			rule: 'invalid-exception',
			path: '.permaweb-frontend.json',
			message: `Unknown exception rule: ${String(exception.rule)}.`,
		});
		continue;
	}
	if (!exception.reason || !exception.expires) {
		violations.push({
			rule: 'invalid-exception',
			path: '.permaweb-frontend.json',
			message: 'Every exception requires a reason and ISO expiration date.',
		});
		continue;
	}
	const expiration = Date.parse(`${exception.expires}T23:59:59Z`);
	if (!Number.isFinite(expiration) || expiration < Date.now()) {
		violations.push({
			rule: 'expired-exception',
			path: '.permaweb-frontend.json',
			message: `Exception ${exception.rule}:${exception.path} is invalid or expired.`,
		});
	}
}

const sourceFiles = walk(sourceRoot).filter((filePath) => /\.(?:js|jsx|ts|tsx)$/.test(filePath));
const sourceTexts = new Map(sourceFiles.map((filePath) => [filePath, fs.readFileSync(filePath, 'utf8')]));

function checkStandardDirectory(directory) {
	const componentName = path.basename(directory);
	for (const fileName of [`${componentName}.tsx`, 'styles.ts', 'index.ts']) {
		const requiredPath = path.join(directory, fileName);
		if (!fs.existsSync(requiredPath)) {
			report('component-directory-contract', requiredPath, `Missing ${fileName}.`);
		}
	}
	const barrelPath = path.join(directory, 'index.ts');
	if (fs.existsSync(barrelPath)) {
		const barrelSource = fs.readFileSync(barrelPath, 'utf8');
		const escapedName = componentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const namedDefaultExport = new RegExp(
			`export\\s*{[^}]*\\bdefault\\s+as\\s+${escapedName}\\b[^}]*}\\s*from\\s*['"]\\./${escapedName}['"]`
		);
		if (!namedDefaultExport.test(barrelSource)) {
			report(
				'component-directory-contract',
				barrelPath,
				`Export ${componentName} as a named default re-export from ./${componentName}.`
			);
		}
	}
}

function checkComponentTierRoot(directory) {
	for (const componentDirectory of directories(directory)) checkStandardDirectory(componentDirectory);
	for (const filePath of walk(directory).filter(
		(candidate) => path.dirname(candidate) === directory && /\.(?:jsx|tsx)$/.test(candidate)
	)) {
		report('loose-component', filePath, 'Move the component into its standard named directory.');
	}
}

for (const tier of ['atoms', 'molecules', 'organisms']) {
	checkComponentTierRoot(path.join(sourceRoot, 'components', tier));
}
const sharedComponentsRoot = path.join(sourceRoot, 'components');
for (const entry of fs.existsSync(sharedComponentsRoot)
	? fs.readdirSync(sharedComponentsRoot, { withFileTypes: true })
	: []) {
	if (entry.isDirectory() && !['atoms', 'molecules', 'organisms'].includes(entry.name)) {
		report(
			'loose-component',
			path.join(sharedComponentsRoot, entry.name),
			'Move shared components into the appropriate atom, molecule, or organism tier.'
		);
	}
	if (entry.isFile() && /\.(?:jsx|tsx)$/.test(entry.name)) {
		report('loose-component', path.join(sharedComponentsRoot, entry.name), 'Move the component into a tier.');
	}
}
for (const featureDirectory of directories(path.join(sourceRoot, 'features'))) {
	const publicEntryPoint = path.join(featureDirectory, 'index.ts');
	if (!fs.existsSync(publicEntryPoint)) {
		report('feature-public-api', publicEntryPoint, 'Every feature requires a root index.ts public API.');
	}
	const featureAtoms = path.join(featureDirectory, 'components', 'atoms');
	if (fs.existsSync(featureAtoms)) {
		report('feature-atom', featureAtoms, 'Feature UI must compose shared root atoms instead of owning primitives.');
	}
	const featureComponentsRoot = path.join(featureDirectory, 'components');
	for (const filePath of walk(featureComponentsRoot).filter(
		(candidate) => path.dirname(candidate) === featureComponentsRoot && /\.(?:jsx|tsx)$/.test(candidate)
	)) {
		report('loose-component', filePath, 'Move the feature component into a molecule or organism tier.');
	}
	for (const tier of ['molecules', 'organisms']) {
		checkComponentTierRoot(path.join(featureDirectory, 'components', tier));
	}
}
for (const layer of ['navigation', 'providers', 'views']) {
	checkComponentTierRoot(path.join(sourceRoot, layer));
}
for (const appDirectory of directories(path.join(sourceRoot, 'apps'))) {
	const appComponentsRoot = path.join(appDirectory, 'components');
	for (const filePath of walk(appComponentsRoot).filter(
		(candidate) => path.dirname(candidate) === appComponentsRoot && /\.(?:jsx|tsx)$/.test(candidate)
	)) {
		report('loose-component', filePath, 'Move the app-owned component into an explicit tier.');
	}
	for (const tier of ['atoms', 'molecules', 'organisms']) {
		checkComponentTierRoot(path.join(appDirectory, 'components', tier));
	}
}

const navigationNamePattern =
	/(?:Header|Footer|Sidebar|NavigationRail|NavigationDrawer|NavRail|NavDrawer|TopBar|AppNav)$/;
for (const filePath of sourceFiles.filter((candidate) => /\.(?:jsx|tsx)$/.test(candidate))) {
	const componentName = path.basename(filePath).replace(/\.(?:jsx|tsx)$/, '');
	const isNavigationFile = filePath.startsWith(`${path.join(sourceRoot, 'navigation')}${path.sep}`);
	if (navigationNamePattern.test(componentName) && !isNavigationFile) {
		report('navigation-ownership', filePath, `${componentName} must live under ${sourceRootName}/navigation/.`);
	}
}

for (const [filePath, sourceText] of sourceTexts) {
	const reactImports = [...sourceText.matchAll(/^\s*import\s+([^;]+?)\s+from\s+['"]react['"]\s*;/gms)];
	for (const reactImport of reactImports) {
		if (reactImport[1].trim() !== 'React') {
			report('react-default-import', filePath, "Import React only as `import React from 'react';`.");
		}
	}
	if (/^\s*import\s+['"]react['"]\s*;/gm.test(sourceText)) {
		report('react-default-import', filePath, "Import React only as `import React from 'react';`.");
	}
	if (/\bReact\./.test(sourceText) && !reactImports.some((reactImport) => reactImport[1].trim() === 'React')) {
		report('react-default-import', filePath, "React namespace usage requires `import React from 'react';`.");
	}
	if (/^\s*handle[A-Z]\w*\??\s*(?::\s*(?:\([^;]*?\)\s*=>|[\w.<>]+Handler\b)|\([^)]*\)\s*:)/gm.test(sourceText)) {
		report(
			'callback-prop-name',
			filePath,
			'Name callback props with `on...`; reserve `handle...` for local handlers.'
		);
	}

	const isSharedAtom = filePath.startsWith(`${path.join(sourceRoot, 'components', 'atoms')}${path.sep}`);
	if (!isSharedAtom && /<(?:button|input|select|textarea)(?=[\s>])/.test(sourceText)) {
		report(
			'native-control-ownership',
			filePath,
			'Native primitive controls may appear only inside atom implementations.'
		);
	}
	if (!isSharedAtom && /styled\.(?:button|input|select|textarea)\b/.test(sourceText)) {
		report(
			'native-control-ownership',
			filePath,
			'Locally styled primitive controls may appear only inside atom implementations.'
		);
	}

	const configuredTokenPaths = configuration.designTokenPaths ?? [`${sourceRootName}/helpers/theme.ts`];
	const isTokenFile = configuredTokenPaths.some(
		(tokenPath) => relativePath(filePath) === tokenPath || relativePath(filePath).startsWith(`${tokenPath}/`)
	);
	const isVisualSource = /(?:styles\.(?:js|jsx|ts|tsx)|\.(?:jsx|tsx))$/.test(filePath);
	if (isVisualSource && !isTokenFile && !toPosix(filePath).includes('/assets/')) {
		if (/(?:#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla)\()/.test(sourceText)) {
			report('design-token', filePath, 'Move raw colors into the shared theme/design tokens.');
		}
	}

	const isApi = filePath.startsWith(`${path.join(sourceRoot, 'api')}${path.sep}`);
	const executableSourceText = sourceText.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
	const usesExternalCapability =
		/\b(?:fetch|window\.fetch|globalThis\.fetch|axios|ky)\s*\(/.test(executableSourceText) ||
		/\b(?:new\s+)?(?:WebSocket|XMLHttpRequest)\b/.test(executableSourceText) ||
		/\b(?:window|globalThis)\.arweaveWallet\b/.test(executableSourceText) ||
		/\b(?:chrome|browser)\.(?:alarms|notifications|runtime|scripting|storage|tabs|windows)\b/.test(
			executableSourceText
		);
	if (!isApi && usesExternalCapability) {
		report('api-boundary', filePath, 'Remote requests and browser extension APIs belong under src/api/.');
	}
	for (const packageName of configuration.externalSdkPackages ?? [
		'arweave',
		'@permaweb/aoconnect',
		'@ardrive/turbo-sdk',
	]) {
		const escapedPackage = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const sdkImportPattern = new RegExp(
			`(?:from\\s+|import\\s*\\(|require\\s*\\(|import\\s+)['"]${escapedPackage}(?:/[^'"]*)?['"]`
		);
		if (!isApi && sdkImportPattern.test(sourceText)) {
			report('api-boundary', filePath, `${packageName} imports belong under src/api/.`);
		}
	}
}

const projectFiles = walk(projectRoot, {
	excluded: ['.agents', '.git', 'coverage', 'dist', 'node_modules'],
});
for (const filePath of projectFiles) {
	const isInsideTestRoot = filePath.startsWith(`${testRoot}${path.sep}`);
	if (
		!isInsideTestRoot &&
		/(?:^|\/)(?:__tests__|e2e|fixtures|mocks|test)(?:\/|$)|\.(?:test|spec)\.[^.]+$/.test(toPosix(filePath))
	) {
		report('test-placement', filePath, `Move test-only artifacts under ${relativePath(testRoot)}/.`);
	}
}

for (const filePath of projectFiles) {
	if (path.basename(filePath) === '.DS_Store') {
		report('repository-artifact', filePath, 'Remove operating-system metadata from the repository.');
	}
}

for (const megaBarrel of [
	path.join(sourceRoot, 'components', 'index.ts'),
	path.join(sourceRoot, 'features', 'index.ts'),
]) {
	if (fs.existsSync(megaBarrel))
		report('mega-barrel', megaBarrel, 'Remove root mega barrels; use component or feature public boundaries.');
}

function sourceRelative(filePath) {
	return toPosix(path.relative(sourceRoot, filePath));
}

function classify(filePath) {
	// Locale dictionaries and other static JSON are pure data, not a UI layer.
	if (filePath.endsWith('.json')) return 'helpers';
	const relative = sourceRelative(filePath);
	if (relative.startsWith('apps/')) return 'apps';
	if (relative.startsWith('views/')) return 'views';
	if (relative.startsWith('navigation/')) return 'navigation';
	if (relative.startsWith('features/')) return 'features';
	if (relative.startsWith('components/atoms/')) return 'atoms';
	if (relative.startsWith('components/molecules/')) return 'molecules';
	if (relative.startsWith('components/organisms/')) return 'organisms';
	if (relative.startsWith('hooks/')) return 'hooks';
	if (relative.startsWith('providers/')) return 'providers';
	if (relative.startsWith('api/')) return 'api';
	if (relative.startsWith('helpers/')) return 'helpers';
	if (relative.startsWith('types/')) return 'types';
	if (relative.startsWith('assets/')) return 'assets';
	return 'unknown';
}

const allowedDependencies = {
	apps: new Set(['apps', 'views', 'navigation', 'features', 'providers', 'api', 'helpers', 'types']),
	views: new Set([
		'views',
		'navigation',
		'features',
		'atoms',
		'molecules',
		'organisms',
		'hooks',
		'providers',
		'api',
		'helpers',
		'types',
		'assets',
	]),
	navigation: new Set([
		'navigation',
		'atoms',
		'molecules',
		'organisms',
		'hooks',
		'providers',
		'api',
		'helpers',
		'types',
		'assets',
	]),
	features: new Set([
		'features',
		'atoms',
		'molecules',
		'organisms',
		'hooks',
		'providers',
		'api',
		'helpers',
		'types',
		'assets',
	]),
	organisms: new Set(['organisms', 'molecules', 'atoms', 'hooks', 'providers', 'helpers', 'types', 'assets']),
	molecules: new Set(['molecules', 'atoms', 'helpers', 'types', 'assets']),
	atoms: new Set(['atoms', 'helpers', 'types', 'assets']),
	hooks: new Set(['hooks', 'providers', 'api', 'helpers', 'types']),
	providers: new Set(['providers', 'hooks', 'api', 'helpers', 'types']),
	api: new Set(['api', 'helpers', 'types']),
	helpers: new Set(['helpers', 'types']),
	types: new Set(['types', 'helpers']),
	assets: new Set(['assets']),
	unknown: new Set(['unknown']),
};

function resolveInternalImport(sourceFile, specifier) {
	const projectTarget = resolveProjectImport?.(specifier, sourceFile);
	if (projectTarget) return projectTarget;
	let candidate;
	if (specifier.startsWith('@/')) candidate = path.join(sourceRoot, specifier.slice(2));
	else if (specifier.startsWith('.')) candidate = path.resolve(path.dirname(sourceFile), specifier);
	else return null;

	for (const resolved of [
		candidate,
		`${candidate}.js`,
		`${candidate}.jsx`,
		`${candidate}.ts`,
		`${candidate}.tsx`,
		path.join(candidate, 'index.js'),
		path.join(candidate, 'index.jsx'),
		path.join(candidate, 'index.ts'),
		path.join(candidate, 'index.tsx'),
	]) {
		if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) return path.resolve(resolved);
	}
	return null;
}

function parseImports(sourceText) {
	const imports = [];
	for (const match of sourceText.matchAll(/^\s*(import|export)\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gms)) {
		const clause = match[2].trim();
		const namedSpecifiers =
			clause.startsWith('{') && clause.endsWith('}')
				? clause
						.slice(1, -1)
						.split(',')
						.map((specifier) => specifier.trim())
						.filter(Boolean)
				: [];
		const isTypeOnly =
			clause.startsWith('type ') ||
			(namedSpecifiers.length > 0 && namedSpecifiers.every((specifier) => specifier.startsWith('type ')));
		imports.push({ specifier: match[3], isTypeOnly });
	}
	for (const match of sourceText.matchAll(/\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
		imports.push({ specifier: match[1], isTypeOnly: false });
	}
	for (const match of sourceText.matchAll(/^\s*import\s+['"]([^'"]+)['"]\s*;?/gm)) {
		imports.push({ specifier: match[1], isTypeOnly: false });
	}
	return imports;
}

const graph = new Map(sourceFiles.map((filePath) => [filePath, []]));
for (const [filePath, sourceText] of sourceTexts) {
	for (const imported of parseImports(sourceText)) {
		const target = resolveInternalImport(filePath, imported.specifier);
		if (!target) continue;

		const sourceLayer = classify(filePath);
		const targetLayer = classify(target);
		if (target.startsWith(`${testRoot}${path.sep}`)) {
			report('test-placement', filePath, 'Production source must not import test-only artifacts.');
		}
		if (!allowedDependencies[sourceLayer]?.has(targetLayer)) {
			report(
				'dependency-direction',
				filePath,
				`${sourceLayer} must not depend on ${targetLayer} (${sourceRelative(target)}).`
			);
		}
		const apiTarget = sourceRelative(target);
		const isApiPublicEntry = /^api\/(?:index|[^/]+\/index)\.(?:js|ts)$/.test(apiTarget);
		if (targetLayer === 'api' && !['api', 'apps'].includes(sourceLayer) && !isApiPublicEntry) {
			report(
				'api-public-api',
				filePath,
				`Import API capability ${apiTarget.split('/')[1]} through its public index.`
			);
		}

		const featureMatch = sourceRelative(target).match(/^features\/([^/]+)\/(.+)$/);
		const sourceFeatureMatch = sourceRelative(filePath).match(/^features\/([^/]+)\//);
		if (featureMatch && sourceFeatureMatch?.[1] !== featureMatch[1] && featureMatch[2] !== 'index.ts') {
			report(
				'feature-public-api',
				filePath,
				`Import feature ${featureMatch[1]} through @/features/${featureMatch[1]}.`
			);
		}

		if (!imported.isTypeOnly) graph.get(filePath)?.push(target);
	}
}

const visitState = new Map();
const visitStack = [];
function visit(filePath) {
	visitState.set(filePath, 'visiting');
	visitStack.push(filePath);
	for (const target of graph.get(filePath) ?? []) {
		if (!graph.has(target)) continue;
		if (visitState.get(target) === 'visiting') {
			const cycleStart = visitStack.indexOf(target);
			const cycle = [...visitStack.slice(cycleStart), target].map(sourceRelative).join(' -> ');
			report('dependency-cycle', filePath, cycle);
		} else if (!visitState.has(target)) visit(target);
	}
	visitStack.pop();
	visitState.set(filePath, 'visited');
}
for (const filePath of graph.keys()) if (!visitState.has(filePath)) visit(filePath);

function directorySize(directory) {
	return walk(directory).reduce((total, filePath) => total + fs.statSync(filePath).size, 0);
}

function newestModification(filePaths) {
	return filePaths.reduce((newest, filePath) => Math.max(newest, fs.statSync(filePath).mtimeMs), 0);
}

if (shouldCheckPerformance) {
	const directoryBudgets = configuration.performanceBudgets?.directories ?? [];
	if (!directoryBudgets.length) {
		violations.push({
			rule: 'invalid-configuration',
			path: '.permaweb-frontend.json',
			message: 'Performance validation requires at least one production-output directory budget.',
		});
	}
	const performanceInputPaths = configuration.performanceInputs ?? [
		sourceRootName,
		'public',
		'html',
		'client',
		'package.json',
		'vite.config.ts',
		'vite.classic.config.ts',
	];
	const performanceInputFiles = performanceInputPaths.flatMap((inputPath) => {
		const absoluteInput = path.resolve(projectRoot, inputPath);
		if (!fs.existsSync(absoluteInput)) return [];
		return fs.statSync(absoluteInput).isDirectory()
			? walk(absoluteInput, { excluded: ['dist', 'node_modules'] })
			: [absoluteInput];
	});
	const newestInput = newestModification(performanceInputFiles);

	for (const budget of directoryBudgets) {
		const outputPath = path.resolve(projectRoot, budget.path);
		if (!fs.existsSync(outputPath)) {
			report('performance-output', outputPath, 'Run the current production build before checking budgets.');
			continue;
		}
		const outputFiles = walk(outputPath);
		if (!outputFiles.length || newestModification(outputFiles) < newestInput) {
			report('performance-freshness', outputPath, 'Production output is older than a configured build input.');
		}
		const bytes = directorySize(outputPath);
		if (bytes > budget.maxBytes)
			report('performance-budget', outputPath, `${bytes} bytes exceeds ${budget.maxBytes}.`);
	}
	for (const budget of configuration.performanceBudgets?.extensions ?? []) {
		const outputPath = path.resolve(projectRoot, budget.path);
		if (!fs.existsSync(outputPath)) {
			report('performance-output', outputPath, 'Run the current production build before checking budgets.');
			continue;
		}
		for (const filePath of walk(outputPath).filter((candidate) => candidate.endsWith(budget.extension))) {
			const bytes = fs.statSync(filePath).size;
			if (bytes > budget.maxFileBytes) {
				report('performance-budget', filePath, `${bytes} bytes exceeds ${budget.maxFileBytes}.`);
			}
		}
	}
}

if (violations.length) {
	violations
		.sort((left, right) => `${left.rule}:${left.path}`.localeCompare(`${right.rule}:${right.path}`))
		.forEach((violation) => process.stderr.write(`[${violation.rule}] ${violation.path}: ${violation.message}\n`));
	process.stderr.write(`Frontend architecture validation failed with ${violations.length} violation(s).\n`);
	process.exit(1);
}

const status = configuration.status ?? 'adopting';
process.stdout.write(
	`Frontend architecture validation passed (${status}${shouldCheckPerformance ? ', performance checked' : ''}).\n`
);
