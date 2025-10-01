// Browser-compatible shim for import.meta.url
const import_meta_url =
	typeof document !== 'undefined'
		? (document.currentScript && document.currentScript.src) ||
		  new URL('main.js', document.baseURI).href
		: typeof location !== 'undefined'
		? location.href
		: 'file://unknown'

export { import_meta_url }
