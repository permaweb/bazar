import { spawn } from 'node:child_process';

const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;
const ANSI = /\x1B\[[0-?]*[ -/]*[@-~]/g;
const deployKey = process.env.DEPLOY_KEY?.trim();

if (!deployKey) throw new Error('DEPLOY_KEY environment variable is not set');

const encodedDeployKey = deployKey.startsWith('{')
	? Buffer.from(JSON.stringify(JSON.parse(deployKey))).toString('base64')
	: deployKey;

const output = await new Promise((resolve, reject) => {
	let combined = '';
	const upload = spawn(
		'npx',
		['--yes', 'permaweb-deploy@3.4.6', 'upload', '--deploy-folder', './dist'],
		{
			env: { ...process.env, DEPLOY_KEY: encodedDeployKey },
			stdio: ['ignore', 'pipe', 'pipe'],
		}
	);

	for (const stream of [upload.stdout, upload.stderr]) {
		stream.on('data', (data) => {
			const text = data.toString();
			combined += text;
			process.stdout.write(text);
		});
	}
	upload.on('error', reject);
	upload.on('close', (code) => {
		if (code === 0) resolve(combined);
		else reject(new Error(`permaweb-deploy exited with code ${code}`));
	});
});

const normalized = output.replace(ANSI, '');
const manifestId =
	normalized.match(/^Tx ID:\s*([A-Za-z0-9_-]{43})\s*$/m)?.[1] ??
	normalized.match(/^Arweave URL:\s*https:\/\/arweave\.net\/([A-Za-z0-9_-]{43})\s*$/m)?.[1];

if (!manifestId || !ARWEAVE_ID.test(manifestId)) {
	throw new Error('Could not find uploaded manifest ID in permaweb-deploy output');
}

console.log(`Bazar manifest ID: ${manifestId}`);
