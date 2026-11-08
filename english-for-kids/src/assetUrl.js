// Resolve picture and audio URLs against the page that loaded the app.
// Root-absolute "/assets/..." breaks GitHub Pages project sites
// (https://<user>.github.io/<repo>/) because the browser fetches from the domain root.
export default function assetUrl(src) {
	if (!src) return src;
	const value = String(src);
	if (/^(https?:|data:|blob:)/i.test(value)) return value;
	const clean = value.replace(/^(?:\.\.\/)+/, '').replace(/^\/+/, '');
	let base = document.baseURI || window.location.href;
	if (!base.endsWith('/')) {
		const url = new URL(base);
		if (!/\/[^/]+\.[^/]+$/.test(url.pathname)) {
			url.pathname = `${url.pathname}/`;
		}
		base = url.href;
	}
	return new URL(clean, base).href;
}
