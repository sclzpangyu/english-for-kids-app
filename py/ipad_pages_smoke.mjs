/**
 * Touch-emulated smoke test for the GitHub Pages subpath.
 * Chromium + system Chrome. This is not iPad Safari.
 *
 * Usage:
 *   npm install --prefix /tmp/pwtest puppeteer-core@23.11.1
 *   node py/ipad_pages_smoke.mjs
 */
import { createRequire } from 'node:module';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire('/tmp/pwtest/package.json');
const puppeteer = require('puppeteer-core');

const ROOT = 'http://127.0.0.1:8765/english-for-kids-app/';
const CHROME = '/usr/local/bin/google-chrome';
const OUT = path.resolve('py/output');
const ARTIFACTS = '/opt/cursor/artifacts';
const UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const CUES = new Set(['correct', 'error', 'success', 'failure']);

const log = [];
const note = (line) => {
	log.push(line);
	console.log(line);
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function audioName(url) {
	const file = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
	return file.replace(/\.mp3$/i, '');
}

async function waitImages(page) {
	await page.waitForFunction(() => {
		const imgs = [...document.querySelectorAll('.scene img')];
		return imgs.length >= 8 && imgs.every((img) => img.complete && img.naturalWidth > 0);
	}, { timeout: 8000 });
}

async function layout(page) {
	return page.evaluate(() => {
		const scenes = [...document.querySelectorAll('.scene')];
		const boxes = scenes.map((el) => {
			const r = el.getBoundingClientRect();
			return {
				id: el.querySelector('.card')?.getAttribute('data-id') || '',
				top: Math.round(r.top),
				left: Math.round(r.left),
				right: Math.round(r.right),
				bottom: Math.round(r.bottom),
				w: Math.round(r.width),
				h: Math.round(r.height),
			};
		});
		const button = document.querySelector('.button-start');
		const buttonBox = button ? button.getBoundingClientRect() : null;
		return {
			vw: window.innerWidth,
			vh: window.innerHeight,
			scrollWidth: document.documentElement.scrollWidth,
			scrollHeight: document.documentElement.scrollHeight,
			cards: scenes.length,
			boxes,
			button: buttonBox ? {
				top: Math.round(buttonBox.top),
				bottom: Math.round(buttonBox.bottom),
				w: Math.round(buttonBox.width),
				h: Math.round(buttonBox.height),
			} : null,
			broken: [...document.images]
				.filter((img) => !img.complete || img.naturalWidth === 0)
				.map((img) => img.getAttribute('src')),
		};
	});
}

function assertInView(metrics, label, { requireButton = false } = {}) {
	if (metrics.cards !== 8) {
		throw new Error(`${label}: expected 8 cards, got ${metrics.cards}`);
	}
	if (metrics.scrollWidth > metrics.vw + 1) {
		throw new Error(`${label}: horizontal overflow ${metrics.scrollWidth} > ${metrics.vw}`);
	}
	if (metrics.scrollHeight > metrics.vh + 1) {
		throw new Error(`${label}: vertical scroll ${metrics.scrollHeight} > ${metrics.vh}`);
	}
	if (metrics.broken.length) {
		throw new Error(`${label}: broken images ${metrics.broken.join(', ')}`);
	}
	const bottoms = metrics.boxes.map((b) => b.bottom);
	const rights = metrics.boxes.map((b) => b.right);
	const maxBottom = Math.max(...bottoms);
	const maxRight = Math.max(...rights);
	if (maxRight > metrics.vw + 1) {
		throw new Error(`${label}: card past right edge ${maxRight} > ${metrics.vw}`);
	}
	if (maxBottom > metrics.vh + 1) {
		throw new Error(`${label}: card past bottom ${maxBottom} > ${metrics.vh} scrollHeight ${metrics.scrollHeight}`);
	}
	const tiny = metrics.boxes.filter((b) => b.w < 80 || b.h < 80);
	if (tiny.length) {
		throw new Error(`${label}: card too small ${JSON.stringify(tiny[0])}`);
	}
	if (requireButton) {
		if (!metrics.button) throw new Error(`${label}: start button missing`);
		if (metrics.button.bottom > metrics.vh + 1) {
			throw new Error(`${label}: start button past bottom ${metrics.button.bottom} > ${metrics.vh}`);
		}
		if (metrics.button.h < 40) {
			throw new Error(`${label}: start button shorter than 40px`);
		}
	}
}

async function shot(page, name) {
	const file = path.join(OUT, name);
	await page.screenshot({ path: file, fullPage: false });
	note(`screenshot ${name}`);
	return file;
}

async function openApp(browser, width, height) {
	const page = await browser.newPage();
	const failed = [];
	const audios = [];
	page.on('pageerror', (err) => failed.push(`pageerror ${err.message}`));
	page.on('response', (res) => {
		const url = res.url();
		let pathname = '';
		try {
			pathname = new URL(url).pathname;
		} catch (err) {
			return;
		}
		if (pathname === '/favicon.ico') return;
		if (res.status() >= 400) failed.push(`${res.status()} ${pathname}`);
		if (pathname.includes('/assets/') && !pathname.startsWith('/english-for-kids-app/assets/')) {
			failed.push(`escaped ${pathname}`);
		}
		if (pathname.endsWith('.mp3')) audios.push(url);
	});
	await page.setUserAgent(UA);
	await page.setViewport({
		width,
		height,
		deviceScaleFactor: 1,
		isMobile: true,
		hasTouch: true,
	});
	await page.goto(ROOT, { waitUntil: 'networkidle0', timeout: 30000 });
	await page.waitForFunction(() => document.querySelectorAll('.scene').length === 8);
	await waitImages(page);
	return { page, failed, audios };
}

async function tapSelector(page, selector) {
	const handle = await page.$(selector);
	if (!handle) throw new Error(`missing ${selector}`);
	const box = await handle.boundingBox();
	if (!box) throw new Error(`no box ${selector}`);
	await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function audioState(page) {
	return page.evaluate(() => ({
		seq: document.documentElement.dataset.audioSeq || '0',
		url: document.documentElement.dataset.lastAudio || '',
	}));
}

async function waitSpokenWord(page, previousSeq) {
	const start = Date.now();
	while (Date.now() - start < 8000) {
		const state = await audioState(page);
		const name = state.url ? audioName(state.url) : '';
		if (state.seq !== previousSeq && name && !CUES.has(name)) {
			if (!state.url.includes('/english-for-kids-app/assets/audio/')) {
				throw new Error(`audio left the Pages subpath: ${state.url}`);
			}
			return name;
		}
		await sleep(30);
	}
	const state = await audioState(page);
	throw new Error(`no spoken word after seq ${previousSeq}; last ${state.url}`);
}

async function tapWord(page, word) {
	const point = await page.evaluate((wanted) => {
		const img = [...document.querySelectorAll('.card__face--front img')].find((el) => el.alt === wanted);
		if (!img) return null;
		const rect = img.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
	}, word);
	if (!point) throw new Error(`word card not found: ${word}`);
	await page.touchscreen.tap(point.x, point.y);
}

async function playRound(page, audios) {
	const hit = await page.evaluate(() => {
		const el = document.querySelector('button.button-start');
		const rect = el.getBoundingClientRect();
		const x = rect.x + rect.width / 2;
		const y = rect.y + rect.height / 2;
		const top = document.elementFromPoint(x, y);
		return { x, y, tag: top && top.tagName };
	});
	if (hit.tag !== 'BUTTON') throw new Error(`start button covered by ${hit.tag}`);
	let previous = await audioState(page);
	await page.touchscreen.tap(hit.x, hit.y);
	let word = await waitSpokenWord(page, previous.seq);
	const heard = [word];
	for (let step = 1; step <= 8; step += 1) {
		previous = await audioState(page);
		await tapWord(page, word);
		if (step < 8) {
			word = await waitSpokenWord(page, previous.seq);
			heard.push(word);
		}
	}
	await page.waitForFunction(() => {
		const el = document.querySelector('.finish-round-succes');
		return el && getComputedStyle(el).visibility !== 'hidden';
	}, { timeout: 8000 });
	if (new Set(heard).size !== 8) throw new Error(`round words ${heard.join(',')}`);
	const cueSeen = async (name) => {
		const start = Date.now();
		while (!audios.some((url) => audioName(url) === name && url.includes('/english-for-kids-app/assets/audio/'))) {
			if (Date.now() - start > 4000) return false;
			await sleep(30);
		}
		return true;
	};
	if (!(await cueSeen('correct'))) throw new Error('correct.mp3 was not fetched from the Pages subpath');
	if (!(await cueSeen('success'))) throw new Error('success.mp3 was not fetched from the Pages subpath');
	return heard;
}

async function runViewport(browser, spec) {
	note(`--- ${spec.name} ${spec.width}x${spec.height} ---`);
	const { page, failed, audios } = await openApp(browser, spec.width, spec.height);
	try {
		let metrics = await layout(page);
		note(`home ${JSON.stringify({ vw: metrics.vw, vh: metrics.vh, cards: metrics.cards, box0: metrics.boxes[0], scrollHeight: metrics.scrollHeight })}`);
		assertInView(metrics, `${spec.name} home`);
		await shot(page, spec.homeShot);

		await tapSelector(page, '.card[data-id="1"]');
		await page.waitForFunction(() => {
			const alt = document.querySelector('.card__face--front img')?.alt;
			return alt && alt !== 'Action (set A)';
		});
		await waitImages(page);
		metrics = await layout(page);
		assertInView(metrics, `${spec.name} train`);
		const before = audios.length;
		const beforeState = await audioState(page);
		await tapWord(page, 'cry');
		const trainWord = await waitSpokenWord(page, beforeState.seq);
		const fetchedAt = Date.now();
		while (!audios.slice(before).some((url) => audioName(url) === 'cry' && url.includes('/english-for-kids-app/assets/audio/'))) {
			if (Date.now() - fetchedAt > 4000) {
				throw new Error(`cry.mp3 was not fetched from the Pages subpath; saw ${audios.slice(before).join(' ')}`);
			}
			await sleep(30);
		}
		if (trainWord !== 'cry') throw new Error(`train audio was ${trainWord}`);
		await page.waitForFunction(() => document.querySelector('.card.is-flipped'));
		await sleep(1000);
		const flipText = await page.$eval('.card.is-flipped .card__face--back span', (el) => el.textContent);
		if (flipText !== 'плакать') throw new Error(`flip back text ${flipText}`);
		const arrow = await page.$eval('.arrow', (el) => el.getAttribute('src'));
		if (!arrow.includes('/english-for-kids-app/assets/img/rotate.svg')) {
			throw new Error(`rotate src ${arrow}`);
		}
		note(`train flip+audio cry; rotate ${arrow}`);
		await shot(page, spec.trainShot);
		await tapSelector(page, '.logo');
		await sleep(100);
		const still = await page.$('.card.is-flipped');
		if (still) throw new Error('card stayed flipped after tap outside');

		await tapSelector(page, 'input.toggle');
		await page.waitForFunction(() => document.querySelector('.image-link.play') && document.querySelector('button.button-start'));
		await sleep(450);
		const wordLeak = await page.evaluate(() => {
			const span = document.querySelector('.card__face--front.play span');
			if (!span) return 'missing';
			const rect = span.getBoundingClientRect();
			if (rect.width > 8 && rect.height > 8) return `visible ${span.textContent}`;
			return 'hidden';
		});
		if (wordLeak !== 'hidden') throw new Error(`play mode shows the word: ${wordLeak}`);
		metrics = await layout(page);
		note(`play board ${JSON.stringify({ button: metrics.button, card: metrics.boxes[0], scrollHeight: metrics.scrollHeight, vh: metrics.vh })}`);
		assertInView(metrics, `${spec.name} play`, { requireButton: true });
		await shot(page, spec.playShot);

		const heard = await playRound(page, audios);
		note(`play round ${heard.join(' > ')}`);
		metrics = await layout(page);
		await shot(page, spec.winShot);

		await page.waitForFunction(() => {
			const el = document.querySelector('.finish-round-succes');
			return el && getComputedStyle(el).visibility === 'hidden';
		}, { timeout: 5000 });
		await page.waitForFunction(() => document.querySelector('.card__face--front img')?.alt === 'Action (set A)');

		await tapSelector(page, '.hamburger');
		await page.waitForFunction(() => document.querySelector('.header__navigation').style.left === '0%');
		await sleep(600);
		await tapSelector(page, '#statistic__link');
		await page.waitForSelector('#tbody tr');
		const statOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
		if (statOverflow) throw new Error(`${spec.name} statistics horizontal overflow`);
		note(`statistics rows visible, no horizontal overflow`);

		if (failed.length) throw new Error(failed.join(' | '));
		note(`PASS ${spec.name} audios ${audios.length}`);
	} finally {
		await page.close();
	}
}

async function main() {
	await mkdir(OUT, { recursive: true });
	await mkdir(ARTIFACTS, { recursive: true });
	note(`browser Google Chrome headless via puppeteer-core; NOT a real iPad Safari`);
	note(`origin ${ROOT}`);
	const browser = await puppeteer.launch({
		executablePath: CHROME,
		headless: true,
		args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'],
	});
	const version = await browser.version();
	note(`chrome ${version}`);
	try {
		await runViewport(browser, {
			name: 'landscape-1180x820',
			width: 1180,
			height: 820,
			homeShot: 'ipad_landscape_1180x820_home.png',
			trainShot: 'ipad_landscape_1180x820_train_flip.png',
			playShot: 'ipad_landscape_1180x820_play.png',
			winShot: 'ipad_landscape_1180x820_play_win.png',
		});
		await runViewport(browser, {
			name: 'portrait-820x1180',
			width: 820,
			height: 1180,
			homeShot: 'ipad_portrait_820x1180_home.png',
			trainShot: 'ipad_portrait_820x1180_train_flip.png',
			playShot: 'ipad_portrait_820x1180_play.png',
			winShot: 'ipad_portrait_820x1180_play_win.png',
		});
		await runViewport(browser, {
			name: 'ipad-1024x768',
			width: 1024,
			height: 768,
			homeShot: 'ipad_1024x768_home.png',
			trainShot: 'ipad_1024x768_train_flip.png',
			playShot: 'ipad_1024x768_play.png',
			winShot: 'ipad_1024x768_play_win.png',
		});
	} finally {
		await browser.close();
	}
	const text = `${log.join('\n')}\n`;
	await writeFile(path.join(OUT, 'ipad-pages-test-log.txt'), text);
	await copyFile(path.join(OUT, 'ipad-pages-test-log.txt'), path.join(ARTIFACTS, 'ipad_pages_test_log.txt'));
	const keep = [
		'ipad_landscape_1180x820_home.png',
		'ipad_landscape_1180x820_train_flip.png',
		'ipad_landscape_1180x820_play.png',
		'ipad_landscape_1180x820_play_win.png',
		'ipad_portrait_820x1180_home.png',
		'ipad_portrait_820x1180_play.png',
		'ipad_1024x768_home.png',
		'ipad_1024x768_play.png',
	];
	for (const name of keep) {
		await copyFile(path.join(OUT, name), path.join(ARTIFACTS, name));
	}
	note('artifacts copied');
}

main().catch(async (err) => {
	console.error(err);
	try {
		await mkdir(OUT, { recursive: true });
		await writeFile(path.join(OUT, 'ipad-pages-test-log.txt'), `${log.join('\n')}\n${err.stack || err}\n`);
	} catch (writeErr) {
		console.error(writeErr);
	}
	process.exit(1);
});
