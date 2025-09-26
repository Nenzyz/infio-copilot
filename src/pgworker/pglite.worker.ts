import { PGlite } from '@electric-sql/pglite'
// @ts-expect-error: types for '@electric-sql/pglite/worker' not resolved under current moduleResolution
import { PGliteWorkerOptions, worker } from '@electric-sql/pglite/worker'

import { migrations } from '../database/sql'

export { }

const loadPGliteResources = async (): Promise<{
	fsBundle: Blob
	wasmModule: WebAssembly.Module
	vectorExtensionBundlePath: URL
}> => {
		const [wasmRes, dataRes, vectorRes] = await Promise.all([
			fetch('https://infio.dev/postgres.wasm', { cache: 'no-store' }),
			fetch('https://infio.dev/postgres.data', { cache: 'no-store' }),
			fetch('https://infio.dev/vector.tar.gz', { cache: 'no-store' }),
		])

		if (!wasmRes.ok || !dataRes.ok || !vectorRes.ok) {
			throw new Error('Failed to download PGlite assets from infio.dev')
		}

		const wasmBuffer = await wasmRes.arrayBuffer()
		const wasmModule = await WebAssembly.compile(wasmBuffer)

		const dataBuffer = await dataRes.arrayBuffer()
		const fsBundle = new Blob([dataBuffer], {
			type: 'application/octet-stream',
		})

		const vectorBuffer = await vectorRes.arrayBuffer()
		const vectorBlob = new Blob([vectorBuffer], {
			type: 'application/gzip',
		})
		const vectorExtensionBundlePath = URL.createObjectURL(vectorBlob)

        return {
            fsBundle,
            wasmModule,
            vectorExtensionBundlePath: new URL(vectorExtensionBundlePath),
        }
}

worker({
	async init(options: PGliteWorkerOptions, filesystem: string) {
    let db: PGlite;
			const { fsBundle, wasmModule, vectorExtensionBundlePath } =
				await loadPGliteResources()
			if (filesystem === 'idb') {
				db = await PGlite.create('idb://infio-db', {
					relaxedDurability: true,
					fsBundle: fsBundle,
					wasmModule: wasmModule,
					...options,
					extensions: {
						...options.extensions,
						vector: vectorExtensionBundlePath,
					},
				})
			} else {
				db = await PGlite.create('opfs-ahp://infio-db', {
					relaxedDurability: true,
					fsBundle: fsBundle,
					wasmModule: wasmModule,
					...options,
					extensions: {
						...options.extensions,
						vector: vectorExtensionBundlePath,
					},
				})
			}

		// Execute SQL migrations
		for (const migration of Object.values(migrations)) {
			// Split SQL into individual commands and execute them one by one
			const commands = migration.sql.split('\n\n').filter(cmd => cmd.trim());
			for (const command of commands) {
				await db.exec(command);
			}
		}

		return db
	},
})
