import { App, ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { Canvas, CanvasView } from '../types/canvas-api';

export class CanvasHelper {
	/**
	 * Get the currently active canvas view
	 */
	static getCurrentCanvasView(app: App): CanvasView | null {
		const activeView = app.workspace.getActiveViewOfType(ItemView);
		if (activeView?.getViewType() === 'canvas') {
			return activeView as CanvasView;
		}
		return null;
	}

	/**
	 * Get the currently active canvas instance
	 */
	static getCurrentCanvas(app: App): Canvas | null {
		const canvasView = this.getCurrentCanvasView(app);
		return canvasView?.canvas || null;
	}

	/**
	 * Find a canvas view for a specific file
	 */
	static getCanvasViewForFile(app: App, file: TFile): CanvasView | null {
		const leaves = app.workspace.getLeavesOfType('canvas');
		for (const leaf of leaves) {
			const view = leaf.view as CanvasView;
			if (view.file === file) {
				return view;
			}
		}
		return null;
	}

	/**
	 * Open a canvas file and return the canvas instance
	 * @param app Obsidian app instance
	 * @param filePath Path to the canvas file
	 * @param inNewLeaf Whether to open in a new leaf (default: true)
	 * @returns Canvas instance or null if failed
	 */
	static async openCanvas(app: App, filePath: string, inNewLeaf: boolean = true): Promise<Canvas | null> {

		let file = app.vault.getAbstractFileByPath(filePath);

		// If file not found, wait a bit for vault to update and try again
		if (!file) {
			await new Promise(resolve => setTimeout(resolve, 200));
			file = app.vault.getAbstractFileByPath(filePath);
		}

		if (!file || !(file instanceof TFile)) {
			return null;
		}


		// Check if already open
		const existingView = this.getCanvasViewForFile(app, file);
		if (existingView) {
			return existingView.canvas;
		}

		// Open the canvas file
		let leaf: WorkspaceLeaf;
		if (inNewLeaf) {
			leaf = app.workspace.getLeaf('tab');
		} else {
			leaf = app.workspace.getLeaf(false);
		}

		await leaf.openFile(file);

		// Wait for canvas to initialize - poll until canvas object exists

		let canvas = null;
		let attempts = 0;
		const maxAttempts = 20; // 2 seconds total

		while (attempts < maxAttempts && !canvas) {
			await new Promise(resolve => setTimeout(resolve, 100));
			attempts++;

			const canvasView = leaf.view as any;

			if (canvasView.getViewType() !== 'canvas') {
				return null;
			}

			// Try to access canvas object
			canvas = canvasView.canvas;

			if (canvas) {
			} else {
			}
		}

		if (!canvas) {
			return null;
		}

		return canvas;
	}

	/**
	 * Get or create canvas for a file
	 */
	static async getOrOpenCanvas(app: App, filePath: string): Promise<Canvas | null> {

		// Check if file exists using adapter (more reliable than getAbstractFileByPath)
		const fileExists = await app.vault.adapter.exists(filePath);

		// If file doesn't exist, create it
		if (!fileExists) {
			try {
				const emptyCanvas = {
					nodes: [],
					edges: []
				};
				await app.vault.create(filePath, JSON.stringify(emptyCanvas, null, '\t'));
			} catch (error) {
				// If it fails because file already exists (race condition), that's okay - continue to open
				if (error instanceof Error && !error.message.includes('already exists')) {
					throw error;
				}
			}
		}

		// Open the canvas
		const canvas = await this.openCanvas(app, filePath, true);
		return canvas;
	}
}
