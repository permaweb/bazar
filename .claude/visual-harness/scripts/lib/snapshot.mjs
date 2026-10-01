// The in-page DOM + computed-style collector.
//
// Runs inside Chromium via page.evaluate. Returns a JSON string using an interned layout
// (shared property list, string table, deduplicated style vectors) because a raw dump of every
// computed property for every element is two orders of magnitude larger.

export function collectSnapshot(options) {
	const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT', 'TITLE', 'BASE']);

	// ---- styled-components class and keyframe detection -------------------------------------
	const styledClasses = new Set();
	const globalClasses = new Set();
	// Classes that appear as a selector of exactly one class inside a style[data-styled] sheet.
	const styledStandalone = new Set();
	const styledKeyframes = new Set();
	// name -> token derived from the keyframe's BODY. The refactor renames global keyframes to
	// styled-components hashes, so comparing names would flag every animation as changed. Comparing
	// a hash of the body instead means an unchanged animation matches across builds, while a genuine
	// change to the animation still shows up.
	const keyframeToken = new Map();

	function hashText(text) {
		let hash = 0x811c9dc5;
		for (let i = 0; i < text.length; i += 1) {
			hash ^= text.charCodeAt(i);
			hash = Math.imul(hash, 0x01000193) >>> 0;
		}
		return hash.toString(36);
	}

	function harvest(rules, classSink, isStyled) {
		for (const rule of rules) {
			if (rule.selectorText) {
				const matches = rule.selectorText.match(/\.(-?[_a-zA-Z][\w-]*)/g);
				if (matches) for (const match of matches) classSink.add(match.slice(1));
				// styled-components emits its per-component hash as a selector that is exactly one
				// class and nothing else (`.kkqpfe{…}`). Authored classes only ever appear compounded
				// with or descended from that hash (`.kkqpfe.active`, `.kkqpfe .foo`). That position
				// is the reliable signal — far more so than the shape of the name.
				if (isStyled) {
					for (const selector of rule.selectorText.split(',')) {
						const trimmed = selector.trim();
						if (/^\.[-_a-zA-Z][\w-]*$/.test(trimmed)) styledStandalone.add(trimmed.slice(1));
					}
				}
			}
			if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name) {
				if (isStyled) styledKeyframes.add(rule.name);
				const body = rule.cssText.replace(/^@[-a-zA-Z]*keyframes\s+[^{\s]+/, '@keyframes').replace(/\s+/g, ' ');
				keyframeToken.set(rule.name, `<kf:${hashText(body)}>`);
			}
			if (rule.cssRules) harvest(rule.cssRules, classSink, isStyled);
		}
	}

	for (const sheet of document.styleSheets) {
		let rules;
		try {
			rules = sheet.cssRules;
		} catch {
			continue;
		}
		const owner = sheet.ownerNode;
		const isStyled = Boolean(owner && owner.tagName === 'STYLE' && owner.hasAttribute('data-styled'));
		harvest(rules, isStyled ? styledClasses : globalClasses, isStyled);
	}

	// styled-components emits a RUN of N `sc-<componentId>` markers followed by a run of N hashes,
	// then whatever className the caller passed. One styled component gives
	// `class="sc-jBeBSR eOkXho bazar-mark"`; a wrapped one — styled(Component) — gives
	// `class="sc-iXzfSG sc-eulNck iDLeHH bIZpwN asset-page …"`, i.e. two markers and then two hashes.
	// Taking only the single class after each marker therefore leaks the second hash of every wrapped
	// component, which is precisely how the lazily-loaded page roots (`bIZpwN`, `hMREI`, `dvXCnC`)
	// stayed in their keys. Match the run length instead.
	const positionalCandidates = new Set();
	for (const element of document.querySelectorAll('*')) {
		const classes = [...element.classList];
		let index = 0;
		while (index < classes.length) {
			if (!classes[index].startsWith('sc-')) {
				index += 1;
				continue;
			}
			let end = index;
			while (end < classes.length && classes[end].startsWith('sc-')) end += 1;
			const markerCount = end - index;
			for (let offset = 0; offset < markerCount && end + offset < classes.length; offset += 1) {
				positionalCandidates.add(classes[end + offset]);
			}
			index = end + markerCount;
		}
	}

	// A class is generated when styled-components minted it. Two independent signals are needed,
	// because neither alone is complete:
	//   * position — the class immediately following an `sc-` marker;
	//   * a standalone single-class selector (`.kkqpfe{…}`) in a style[data-styled] sheet.
	// A component whose CSS is entirely nested emits no standalone rule (`eOkXho`), while a hash can
	// appear standalone on an element the positional scan did not reach. Using only one of the two
	// leaves hashes in element keys, and a leaked class re-keys every element beneath it — which
	// reads in the report exactly like a removed element plus an added one, not like a bug.
	//
	// Name shape is NOT a primary signal. An earlier version required a mixed-case name and so missed
	// all-lowercase hashes such as `kkqpfe` (745 false missing/added pairs on the activity scenarios).
	// The shape test and global-sheet guard survive only as a safety net against authored classes
	// that legitimately appear standalone in a data-styled sheet — `createGlobalStyle` produces
	// these, and this app has two: `inline-error` and `collection-source-notice`.
	const generatedCache = new Map();
	function isGenerated(name) {
		let known = generatedCache.get(name);
		if (known !== undefined) return known;
		known =
			name.startsWith('sc-') ||
			((positionalCandidates.has(name) || styledStandalone.has(name)) &&
				!globalClasses.has(name) &&
				/^[A-Za-z][A-Za-z0-9]{3,11}$/.test(name));
		generatedCache.set(name, known);
		return known;
	}

	// ---- value normalization -----------------------------------------------------------------
	const origin = options.appOrigin;
	const blobIds = new Map();
	// Longest name first, so one keyframe name cannot be partially matched inside another.
	const keyframeNames = [...keyframeToken.keys()].sort((left, right) => right.length - left.length);
	const keyframePattern = keyframeNames.length
		? new RegExp(
				`(?<![\\w-])(${keyframeNames
					.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
					.join('|')})(?![\\w-])`,
				'g'
		  )
		: null;

	function normalize(value) {
		if (!value || typeof value !== 'string') return value;
		let out = value;
		if (origin) out = out.split(origin).join('APP');
		// Hashed build assets: /assets/index-B8Bz0YU2.js -> /assets/index-<hash>.js
		out = out.replace(/\/assets\/([A-Za-z0-9_.-]+?)-[A-Za-z0-9_-]{8,}(\.[a-z0-9]+)/g, '/assets/$1-<hash>$2');
		out = out.replace(/blob:[^"')\s]+/g, (match) => {
			if (!blobIds.has(match)) blobIds.set(match, `blob:<${blobIds.size}>`);
			return blobIds.get(match);
		});
		if (keyframePattern) out = out.replace(keyframePattern, (name) => keyframeToken.get(name) ?? name);
		// Any generated class that leaks into a value (e.g. via content or a url fragment).
		out = out.replace(/\bsc-[A-Za-z0-9]+\b/g, '<sc>');
		return out;
	}

	// ---- interning ----------------------------------------------------------------------------
	const stringTable = [];
	const stringIndex = new Map();
	function intern(value) {
		let index = stringIndex.get(value);
		if (index === undefined) {
			index = stringTable.length;
			stringTable.push(value);
			stringIndex.set(value, index);
		}
		return index;
	}

	// The column list must be the UNION of property names across every element and pseudo, not just
	// the document element: getComputedStyle enumerates the custom properties DECLARED on the element
	// it is called with, so a `--foo` set on a component would be invisible if we only probed :root.
	const propertyNames = new Set();
	const addNames = (declaration) => {
		for (let i = 0; i < declaration.length; i += 1) propertyNames.add(declaration.item(i));
	};
	addNames(getComputedStyle(document.documentElement));
	addNames(getComputedStyle(document.body));
	for (const element of document.body.querySelectorAll('*')) {
		if (SKIP_TAGS.has(element.tagName)) continue;
		addNames(getComputedStyle(element));
		for (const pseudo of ['::before', '::after']) {
			const declaration = getComputedStyle(element, pseudo);
			const content = declaration.getPropertyValue('content');
			if (content && content !== 'none' && content !== 'normal') addNames(declaration);
		}
	}
	const properties = [...propertyNames].sort();

	const styleSets = [];
	const styleIndex = new Map();
	function internStyle(declaration) {
		const vector = new Array(properties.length);
		for (let i = 0; i < properties.length; i += 1) {
			vector[i] = intern(normalize(declaration.getPropertyValue(properties[i])));
		}
		const signature = vector.join(',');
		let index = styleIndex.get(signature);
		if (index === undefined) {
			index = styleSets.length;
			styleSets.push(vector);
			styleIndex.set(signature, index);
		}
		return index;
	}

	function pseudoStyle(element, pseudo) {
		const declaration = getComputedStyle(element, pseudo);
		const content = declaration.getPropertyValue('content');
		if (!content || content === 'none' || content === 'normal') return null;
		return internStyle(declaration);
	}

	// ---- walk ---------------------------------------------------------------------------------
	const elements = [];
	const scrollX = window.scrollX;
	const scrollY = window.scrollY;

	function round(value) {
		return Math.round(value * 100) / 100;
	}

	function ownText(element) {
		let text = '';
		for (const child of element.childNodes) if (child.nodeType === 3) text += child.nodeValue;
		return text.replace(/\s+/g, ' ').trim();
	}

	function walk(element, parentKey) {
		const counters = new Map();
		for (const child of element.children) {
			if (SKIP_TAGS.has(child.tagName)) continue;
			const tag = child.tagName.toLowerCase();
			const nth = (counters.get(child.tagName) ?? 0) + 1;
			counters.set(child.tagName, nth);
			const stable = [];
			for (const name of child.classList) if (!isGenerated(name)) stable.push(name);
			stable.sort();
			const segment = `${tag}:${nth}${stable.length ? `.${stable.join('.')}` : ''}`;
			const key = parentKey ? `${parentKey}>${segment}` : segment;

			const rect = child.getBoundingClientRect();
			const declaration = getComputedStyle(child);
			const record = {
				k: key,
				b: [round(rect.left + scrollX), round(rect.top + scrollY), round(rect.width), round(rect.height)],
				s: internStyle(declaration),
			};
			const text = ownText(child);
			if (text) record.t = intern(normalize(text));
			const before = pseudoStyle(child, '::before');
			if (before !== null) record.pb = before;
			const after = pseudoStyle(child, '::after');
			if (after !== null) record.pa = after;
			elements.push(record);
			walk(child, key);
		}
	}

	const body = document.body;
	const bodyRect = body.getBoundingClientRect();
	elements.push({
		k: 'body:1',
		b: [
			round(bodyRect.left + scrollX),
			round(bodyRect.top + scrollY),
			round(bodyRect.width),
			round(bodyRect.height),
		],
		s: internStyle(getComputedStyle(body)),
	});
	walk(body, 'body:1');

	return JSON.stringify({
		properties,
		strings: stringTable,
		styleSets,
		elements,
		meta: {
			elementCount: elements.length,
			styleSetCount: styleSets.length,
			stringCount: stringTable.length,
			generatedClasses: [...generatedCache.entries()]
				.filter(([, value]) => value)
				.map(([name]) => name)
				.sort(),
			styledKeyframes: [...styledKeyframes].sort(),
			keyframeTokens: Object.fromEntries([...keyframeToken.entries()].sort()),
			documentHeight: document.documentElement.scrollHeight,
			documentWidth: document.documentElement.scrollWidth,
			theme: document.documentElement.dataset.theme ?? null,
			title: document.title,
		},
	});
}

/** Expand an interned snapshot into { key -> { box, styles, text, before, after } }. */
export function expandSnapshot(snapshot) {
	const { properties, strings, styleSets, elements } = snapshot;
	const byKey = new Map();
	const duplicates = [];
	const styleFor = (index) => {
		const vector = styleSets[index];
		const out = {};
		for (let i = 0; i < properties.length; i += 1) out[properties[i]] = strings[vector[i]];
		return out;
	};
	for (const element of elements) {
		if (byKey.has(element.k)) {
			duplicates.push(element.k);
			continue;
		}
		byKey.set(element.k, {
			box: element.b,
			styleRef: element.s,
			text: element.t === undefined ? '' : strings[element.t],
			beforeRef: element.pb,
			afterRef: element.pa,
		});
	}
	return { byKey, duplicates, styleFor, properties };
}
