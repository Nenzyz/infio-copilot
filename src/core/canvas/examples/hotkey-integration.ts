/**
 * Example: Integrating Canvas Graph Service with Obsidian Hotkeys
 *
 * This demonstrates how to use the canvas service with hotkey triggers
 * or command palette commands for graph operations.
 */

import { Plugin, Notice, TFile } from 'obsidian';
import { CanvasOperations } from '../canvas-operations';
import type { CanvasData } from '../types/canvas-types';

export class CanvasGraphPlugin extends Plugin {

	async onload() {
		console.log('Loading Canvas Graph Plugin');

		// Example 1: Add node to the right of selected node
		this.addCommand({
			id: 'add-node-right',
			name: 'Add node to the right',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.addNodeRelative('right');
				}
				return true;
			}
		});

		// Example 2: Add node below selected node
		this.addCommand({
			id: 'add-node-below',
			name: 'Add node below',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.addNodeRelative('below');
				}
				return true;
			}
		});

		// Example 3: Connect selected nodes
		this.addCommand({
			id: 'connect-nodes',
			name: 'Connect selected nodes',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.connectSelectedNodes();
				}
				return true;
			}
		});

		// Example 4: Create group from selected nodes
		this.addCommand({
			id: 'group-nodes',
			name: 'Create group from selection',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.groupSelectedNodes();
				}
				return true;
			}
		});

		// Example 5: Auto-layout selected nodes in a row
		this.addCommand({
			id: 'layout-horizontal',
			name: 'Layout nodes horizontally',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.layoutNodesHorizontally();
				}
				return true;
			}
		});

		// Example 6: Traverse and select connected nodes
		this.addCommand({
			id: 'select-connected',
			name: 'Select all connected nodes',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.selectConnectedNodes();
				}
				return true;
			}
		});

		// Example 7: Duplicate node with connections
		this.addCommand({
			id: 'duplicate-node',
			name: 'Duplicate node with connections',
			checkCallback: (checking: boolean) => {
				const canvasFile = this.getActiveCanvasFile();
				if (!canvasFile) return false;

				if (!checking) {
					this.duplicateNode();
				}
				return true;
			}
		});
	}

	/**
	 * Get the currently active canvas file
	 */
	private getActiveCanvasFile(): TFile | null {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile || activeFile.extension !== 'canvas') {
			return null;
		}
		return activeFile;
	}

	/**
	 * Get selected nodes from the active canvas
	 */
	private getSelectedNodes(): string[] {
		const canvasView = this.app.workspace.getActiveViewOfType(ItemView as any);
		if (!canvasView || canvasView.getViewType() !== 'canvas') {
			return [];
		}

		const canvas = (canvasView as any).canvas;
		if (!canvas || !canvas.selection) {
			return [];
		}

		return Array.from(canvas.selection)
			.filter((item: any) => item.type !== 'edge')
			.map((node: any) => node.id);
	}

	/**
	 * Load canvas data from file
	 */
	private async loadCanvasData(file: TFile): Promise<CanvasData> {
		const content = await this.app.vault.read(file);
		return JSON.parse(content) as CanvasData;
	}

	/**
	 * Save canvas data to file
	 */
	private async saveCanvasData(file: TFile, data: CanvasData): Promise<void> {
		await this.app.vault.modify(file, JSON.stringify(data, null, '\t'));

		// Refresh canvas UI if open
		const canvasView = this.app.workspace.getActiveViewOfType(ItemView as any);
		if (canvasView && canvasView.getViewType() === 'canvas') {
			const canvas = (canvasView as any).canvas;
			if (canvas) {
				canvas.setData(data);
				canvas.requestSave();
			}
		}
	}

	/**
	 * Add a node relative to selected node
	 */
	private async addNodeRelative(direction: 'right' | 'below' | 'left' | 'above') {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length !== 1) {
			new Notice('Please select exactly one node');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);

		const result = ops.createTextNode({
			text: `New ${direction} node`,
			position: {
				type: 'relative',
				nodeId: selectedNodes[0],
				direction,
				offset: 50
			}
		});

		if (result.ok) {
			await this.saveCanvasData(file, ops.getData());
			new Notice(`Node added ${direction}`);
		} else {
			new Notice(`Failed to add node: ${result.error.message}`);
		}
	}

	/**
	 * Connect selected nodes in sequence
	 */
	private async connectSelectedNodes() {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length < 2) {
			new Notice('Please select at least 2 nodes');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);

		const operations = [];
		for (let i = 0; i < selectedNodes.length - 1; i++) {
			operations.push({
				type: 'createEdge' as const,
				params: {
					fromNode: selectedNodes[i],
					toNode: selectedNodes[i + 1],
					toEnd: 'arrow' as const
				}
			});
		}

		const result = ops.executeBatch(operations);
		const successCount = result.edges.filter(e => e.success).length;

		await this.saveCanvasData(file, ops.getData());
		new Notice(`Connected ${successCount} of ${operations.length} nodes`);
	}

	/**
	 * Create a group around selected nodes
	 */
	private async groupSelectedNodes() {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length === 0) {
			new Notice('Please select nodes to group');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);
		const graph = ops.getGraph();

		// Calculate bounding box
		const bbox = graph.calculateBoundingBox(selectedNodes);
		if (!bbox) {
			new Notice('Failed to calculate bounds');
			return;
		}

		// Add padding
		const padding = 50;
		const groupResult = ops.createGroupNode({
			label: 'Group',
			position: {
				type: 'absolute',
				x: bbox.x - padding,
				y: bbox.y - padding
			},
			size: {
				width: bbox.width + padding * 2,
				height: bbox.height + padding * 2
			},
			color: '4'
		});

		if (groupResult.ok) {
			await this.saveCanvasData(file, ops.getData());
			new Notice('Group created');
		} else {
			new Notice(`Failed: ${groupResult.error.message}`);
		}
	}

	/**
	 * Layout selected nodes horizontally with equal spacing
	 */
	private async layoutNodesHorizontally() {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length < 2) {
			new Notice('Please select at least 2 nodes');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);
		const graph = ops.getGraph();

		const spacing = 350;
		let currentX = 0;

		const operations = selectedNodes.map((nodeId, index) => {
			const node = graph.getNode(nodeId);
			if (!node) return null;

			const x = currentX;
			const y = 0;

			currentX += node.width + spacing;

			return {
				type: 'updateNode' as const,
				params: {
					id: nodeId,
					position: { x, y }
				}
			};
		}).filter(Boolean);

		const result = ops.executeBatch(operations as any);
		const successCount = result.nodes.filter(n => n.success).length;

		await this.saveCanvasData(file, ops.getData());
		new Notice(`Arranged ${successCount} nodes`);
	}

	/**
	 * Select all nodes connected to the current selection
	 */
	private async selectConnectedNodes() {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length !== 1) {
			new Notice('Please select exactly one node');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);
		const graph = ops.getGraph();

		const { nodes } = graph.traverse(selectedNodes[0], {
			direction: 'both',
			maxDepth: 1
		});

		// This would require Canvas API to actually select the nodes
		// For now, just show a notice
		new Notice(`Found ${nodes.length} connected nodes`);

		// In a real implementation, you would:
		// const canvas = (canvasView as any).canvas;
		// canvas.selectNodes(nodes.map(n => n.id));
	}

	/**
	 * Duplicate a node and its connections
	 */
	private async duplicateNode() {
		const file = this.getActiveCanvasFile();
		if (!file) return;

		const selectedNodes = this.getSelectedNodes();
		if (selectedNodes.length !== 1) {
			new Notice('Please select exactly one node');
			return;
		}

		const canvasData = await this.loadCanvasData(file);
		const ops = new CanvasOperations(canvasData);
		const graph = ops.getGraph();

		const originalNode = graph.getNode(selectedNodes[0]);
		if (!originalNode) return;

		// Create duplicate node
		let createResult;
		switch (originalNode.type) {
			case 'text':
				createResult = ops.createTextNode({
					text: originalNode.text,
					position: {
						type: 'relative',
						nodeId: originalNode.id,
						direction: 'right',
						offset: 50
					},
					size: { width: originalNode.width, height: originalNode.height },
					color: originalNode.color
				});
				break;

			case 'file':
				createResult = ops.createFileNode({
					file: originalNode.file,
					subpath: originalNode.subpath,
					position: {
						type: 'relative',
						nodeId: originalNode.id,
						direction: 'right',
						offset: 50
					},
					size: { width: originalNode.width, height: originalNode.height },
					color: originalNode.color
				});
				break;

			case 'link':
				createResult = ops.createLinkNode({
					url: originalNode.url,
					position: {
						type: 'relative',
						nodeId: originalNode.id,
						direction: 'right',
						offset: 50
					},
					size: { width: originalNode.width, height: originalNode.height },
					color: originalNode.color
				});
				break;

			case 'group':
				createResult = ops.createGroupNode({
					label: originalNode.label,
					background: originalNode.background,
					backgroundStyle: originalNode.backgroundStyle,
					position: {
						type: 'relative',
						nodeId: originalNode.id,
						direction: 'right',
						offset: 50
					},
					size: { width: originalNode.width, height: originalNode.height },
					color: originalNode.color
				});
				break;
		}

		if (createResult?.ok) {
			await this.saveCanvasData(file, ops.getData());
			new Notice('Node duplicated');
		} else {
			new Notice('Failed to duplicate node');
		}
	}
}
