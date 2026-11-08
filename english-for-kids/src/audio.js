import assetUrl from './assetUrl';

let audioCtx = null;
const bufferCache = new Map();

function context() {
	const Ctx = window.AudioContext || window.webkitAudioContext;
	if (!Ctx) return null;
	if (!audioCtx) audioCtx = new Ctx();
	return audioCtx;
}

function playElement(url) {
	const audio = new Audio();
	audio.preload = 'auto';
	audio.playsInline = true;
	audio.setAttribute('playsinline', '');
	audio.src = url;
	const pending = audio.play();
	if (pending && typeof pending.catch === 'function') {
		pending.catch(() => {});
	}
}

function startBuffer(ctx, buffer) {
	const node = ctx.createBufferSource();
	node.buffer = buffer;
	node.connect(ctx.destination);
	node.start(0);
}

function loadAndStart(ctx, url) {
	if (bufferCache.has(url)) {
		startBuffer(ctx, bufferCache.get(url));
		return;
	}
	fetch(url)
		.then((response) => {
			if (!response.ok) throw new Error('audio');
			return response.arrayBuffer();
		})
		.then((data) => ctx.decodeAudioData(data))
		.then((buffer) => {
			bufferCache.set(url, buffer);
			startBuffer(ctx, buffer);
		})
		.catch(() => playElement(url));
}

// Call from the first pointerdown so iPad Safari unlocks audio inside the gesture.
export function unlockAudio() {
	const ctx = context();
	if (ctx && ctx.state === 'suspended') {
		ctx.resume().catch(() => {});
	}
}

export function playAsset(src) {
	const url = assetUrl(src);
	const root = document.documentElement;
	root.dataset.lastAudio = url;
	root.dataset.audioSeq = String(Number(root.dataset.audioSeq || 0) + 1);
	const ctx = context();
	if (!ctx) {
		playElement(url);
		return;
	}
	if (ctx.state === 'suspended') {
		ctx.resume().then(() => loadAndStart(ctx, url)).catch(() => playElement(url));
		return;
	}
	loadAndStart(ctx, url);
}
