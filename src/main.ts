// @ts-nocheck
import { Platform, Plugin } from 'obsidian'

export default class InfioPlugin extends Plugin {
	async onload() {
		if (Platform.isMobile) {
			console.log('Infio Copilot: Mobile platform detected, skipping desktop-only features.')
			const mod = await import('./main.mobile')
			await mod.loadMobile(this)
		} else {
			console.log('Infio Copilot: Desktop platform detected, loading desktop features.')
			const mod = await import('./main.desktop')
			await mod.loadDesktop(this)
		}
	}

	onunload() {
		if (Platform.isMobile) {
			void import('./main.mobile').then((m) => m.unloadMobile?.(this)).catch(() => {})
		} else {
			void import('./main.desktop').then((m) => m.unloadDesktop?.(this)).catch(() => {})
		}
	}
}


