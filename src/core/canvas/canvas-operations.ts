import type {
	CanvasData,
	AllCanvasNodeData,
	CanvasEdgeData,
	CanvasTextData,
	CanvasFileData,
	CanvasLinkData,
	CanvasGroupData,
	CreateTextNodeParams,
	CreateFileNodeParams,
	CreateLinkNodeParams,
	CreateGroupNodeParams,
	UpdateNodeParams,
	CreateEdgeParams,
	UpdateEdgeParams,
	NodeOperationResult,
	EdgeOperationResult,
	BatchOperationResult,
	Result,
	RelativePosition
} from './types/canvas-types';
import { CanvasGraph } from './canvas-graph';

/**
 * Canvas Operations Service - High-level CRUD operations
 */
export class CanvasOperations {
	private graph: CanvasGraph;
	private refMap: Map<string, string>; // ref -> actual node ID

	constructor(canvasData: CanvasData) {
		this.graph = new CanvasGraph(canvasData);
		this.refMap = new Map();
	}

	/**
	 * Get the canvas graph
	 */
	getGraph(): CanvasGraph {
		return this.graph;
	}

	/**
	 * Get current canvas data
	 */
	getData(): CanvasData {
		return this.graph.getData();
	}

	/**
	 * Get the mapped ID for a ref (for resolving in external code)
	 */
	getRefMapping(ref: string): string | undefined {
		return this.refMap.get(ref);
	}

	/**
	 * Update a ref mapping to point to a new actual ID
	 * Used when Canvas API generates different IDs than internal IDs
	 */
	updateRefMapping(oldId: string, newId: string): void {
		// Find all refs that point to oldId and update them to newId
		for (const [ref, id] of this.refMap.entries()) {
			if (id === oldId) {
				this.refMap.set(ref, newId);
			}
		}
		// Also allow direct ref update
		if (this.refMap.has(oldId)) {
			const mappedId = this.refMap.get(oldId)!;
			this.refMap.set(oldId, newId);
			// If it was pointing to something else, chain the update
			if (mappedId !== oldId) {
				this.updateRefMapping(mappedId, newId);
			}
		}
	}

	/**
	 * Get the entire ref map for external ID resolution
	 * Used by CanvasAdapter to resolve AI placeholder IDs to actual node IDs
	 */
	getRefMap(): ReadonlyMap<string, string> {
		return this.refMap;
	}

	/**
	 * Resolve a node reference to actual ID
	 * Returns the input if it's already an actual ID (exists in graph)
	 */
	private resolveNodeRef(refOrId: string): string {
		// Check if it's a reference
		const actualId = this.refMap.get(refOrId);
		if (actualId) {
			return actualId;
		}

		// Check if it's already an actual ID
		if (this.graph.getNode(refOrId)) {
			return refOrId;
		}

		// Return as-is (will fail validation in createEdge)
		return refOrId;
	}

	/**
	 * Resolve refs in RelativePosition objects
	 */
	private resolveRelativePosition(position: RelativePosition): RelativePosition {
		if (position.type === 'relative' || position.type === 'near') {
			return {
				...position,
				nodeId: this.resolveNodeRef(position.nodeId)
			};
		}
		return position;
	}

	// ===== NODE OPERATIONS =====

	/**
	 * Create a text node
	 */
	createTextNode(params: CreateTextNodeParams): Result<NodeOperationResult> {
		try {
			// Generate actual ID
			const id = this.graph.generateId('text_node');
			// Resolve refs in position before calculating
			const resolvedPosition = this.resolveRelativePosition(params.position);
			const position = this.graph.calculatePosition(resolvedPosition);
			const size = {
				width: params.size?.width ?? 250,
				height: params.size?.height ?? 60
			};

			const node: CanvasTextData = {
				id,
				type: 'text',
				text: params.text,
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				...(params.color && { color: params.color })
			};

			this.graph.addNode(node);

			// Store ref mapping if provided
			if (params.ref) {
				this.refMap.set(params.ref, id);
			}

			return {
				ok: true,
				value: {
					nodeId: id,
					operation: 'create',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Create a file node
	 */
	createFileNode(params: CreateFileNodeParams): Result<NodeOperationResult> {
		try {
			// Generate actual ID
			const id = this.graph.generateId('file_node');
			// Resolve refs in position before calculating
			const resolvedPosition = this.resolveRelativePosition(params.position);
			const position = this.graph.calculatePosition(resolvedPosition);
			const size = {
				width: params.size?.width ?? 400,
				height: params.size?.height ?? 400
			};

			const node: CanvasFileData = {
				id,
				type: 'file',
				file: params.file,
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				...(params.subpath && { subpath: params.subpath }),
				...(params.color && { color: params.color }),
				...(params.portal !== undefined && { portal: params.portal })
			};

			this.graph.addNode(node);

			// Store ref mapping if provided
			if (params.ref) {
				this.refMap.set(params.ref, id);
			}

			return {
				ok: true,
				value: {
					nodeId: id,
					operation: 'create',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Create a link node
	 */
	createLinkNode(params: CreateLinkNodeParams): Result<NodeOperationResult> {
		try {
			// Generate actual ID
			const id = this.graph.generateId('link_node');
			// Resolve refs in position before calculating
			const resolvedPosition = this.resolveRelativePosition(params.position);
			const position = this.graph.calculatePosition(resolvedPosition);
			const size = {
				width: params.size?.width ?? 300,
				height: params.size?.height ?? 100
			};

			const node: CanvasLinkData = {
				id,
				type: 'link',
				url: params.url,
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				...(params.color && { color: params.color })
			};

			this.graph.addNode(node);

			// Store ref mapping if provided
			if (params.ref) {
				this.refMap.set(params.ref, id);
			}

			return {
				ok: true,
				value: {
					nodeId: id,
					operation: 'create',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Create a group node
	 */
	createGroupNode(params: CreateGroupNodeParams): Result<NodeOperationResult> {
		try {
			// Generate actual ID
			const id = this.graph.generateId('group_node');
			// Resolve refs in position before calculating
			const resolvedPosition = this.resolveRelativePosition(params.position);
			const position = this.graph.calculatePosition(resolvedPosition);
			const size = {
				width: params.size?.width ?? 600,
				height: params.size?.height ?? 400
			};

			const node: CanvasGroupData = {
				id,
				type: 'group',
				x: position.x,
				y: position.y,
				width: size.width,
				height: size.height,
				...(params.label && { label: params.label }),
				...(params.background && { background: params.background }),
				...(params.backgroundStyle && { backgroundStyle: params.backgroundStyle }),
				...(params.color && { color: params.color })
			};

			this.graph.addNode(node);

			// Store ref mapping if provided
			if (params.ref) {
				this.refMap.set(params.ref, id);
			}

			return {
				ok: true,
				value: {
					nodeId: id,
					operation: 'create',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Update a node
	 */
	updateNode(params: UpdateNodeParams): Result<NodeOperationResult> {
		try {
			// Resolve ref to actual ID
			const actualId = this.resolveNodeRef(params.id);
			const node = this.graph.getNode(actualId);
			if (!node) {
				return {
					ok: false,
					error: new Error(`Node not found: ${params.id}`)
				};
			}

			const updates: Partial<AllCanvasNodeData> = {};

			// Position updates
			if (params.position) {
				if (params.position.x !== undefined) updates.x = params.position.x;
				if (params.position.y !== undefined) updates.y = params.position.y;
			}

			// Size updates
			if (params.size) {
				if (params.size.width !== undefined) updates.width = params.size.width;
				if (params.size.height !== undefined) updates.height = params.size.height;
			}

			// Color update
			if (params.color !== undefined) updates.color = params.color;

			// Type-specific updates
			if (params.text !== undefined && node.type === 'text') {
				(updates as CanvasTextData).text = params.text;
			}
			if (params.file !== undefined && node.type === 'file') {
				(updates as CanvasFileData).file = params.file;
			}
			if (params.subpath !== undefined && node.type === 'file') {
				(updates as CanvasFileData).subpath = params.subpath;
			}
			if (params.url !== undefined && node.type === 'link') {
				(updates as CanvasLinkData).url = params.url;
			}
			if (node.type === 'group') {
				if (params.label !== undefined) (updates as CanvasGroupData).label = params.label;
				if (params.background !== undefined) (updates as CanvasGroupData).background = params.background;
				if (params.backgroundStyle !== undefined) (updates as CanvasGroupData).backgroundStyle = params.backgroundStyle;
			}

			const success = this.graph.updateNode(actualId, updates);

			return {
				ok: true,
				value: {
					nodeId: actualId,
					operation: 'update',
					success
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Delete a node
	 */
	deleteNode(nodeId: string): Result<NodeOperationResult> {
		try {
			// Resolve ref to actual ID
			const actualId = this.resolveNodeRef(nodeId);
			const success = this.graph.removeNode(actualId);

			if (!success) {
				return {
					ok: false,
					error: new Error(`Node not found: ${nodeId}`)
				};
			}

			return {
				ok: true,
				value: {
					nodeId,
					operation: 'delete',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	// ===== EDGE OPERATIONS =====

	/**
	 * Create an edge
	 */
	createEdge(params: CreateEdgeParams): Result<EdgeOperationResult> {
		try {
			// Resolve node references to actual IDs
			const fromNodeId = this.resolveNodeRef(params.fromNode);
			const toNodeId = this.resolveNodeRef(params.toNode);

			// Validate that both nodes exist
			const fromNode = this.graph.getNode(fromNodeId);
			const toNode = this.graph.getNode(toNodeId);

			if (!fromNode) {
				return {
					ok: false,
					error: new Error(`Source node not found: ${params.fromNode} (resolved to: ${fromNodeId})`)
				};
			}

			if (!toNode) {
				return {
					ok: false,
					error: new Error(`Target node not found: ${params.toNode} (resolved to: ${toNodeId})`)
				};
			}

			// Generate actual edge ID
			const id = this.graph.generateId('edge');

			const edge: CanvasEdgeData = {
				id,
				fromNode: fromNodeId,
				toNode: toNodeId,
				...(params.fromSide && { fromSide: params.fromSide }),
				...(params.toSide && { toSide: params.toSide }),
				...(params.fromEnd && { fromEnd: params.fromEnd }),
				...(params.toEnd && { toEnd: params.toEnd }),
				...(params.color && { color: params.color }),
				...(params.label && { label: params.label })
			};

			this.graph.addEdge(edge);

			return {
				ok: true,
				value: {
					edgeId: id,
					operation: 'create',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Update an edge
	 */
	updateEdge(params: UpdateEdgeParams): Result<EdgeOperationResult> {
		try {
			const edge = this.graph.getEdge(params.id);
			if (!edge) {
				return {
					ok: false,
					error: new Error(`Edge not found: ${params.id}`)
				};
			}

			const updates: Partial<CanvasEdgeData> = {};

			if (params.fromNode !== undefined) updates.fromNode = params.fromNode;
			if (params.toNode !== undefined) updates.toNode = params.toNode;
			if (params.fromSide !== undefined) updates.fromSide = params.fromSide;
			if (params.toSide !== undefined) updates.toSide = params.toSide;
			if (params.fromEnd !== undefined) updates.fromEnd = params.fromEnd;
			if (params.toEnd !== undefined) updates.toEnd = params.toEnd;
			if (params.color !== undefined) updates.color = params.color;
			if (params.label !== undefined) updates.label = params.label;

			const success = this.graph.updateEdge(params.id, updates);

			return {
				ok: true,
				value: {
					edgeId: params.id,
					operation: 'update',
					success
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	/**
	 * Delete an edge
	 */
	deleteEdge(edgeId: string): Result<EdgeOperationResult> {
		try {
			const success = this.graph.removeEdge(edgeId);

			if (!success) {
				return {
					ok: false,
					error: new Error(`Edge not found: ${edgeId}`)
				};
			}

			return {
				ok: true,
				value: {
					edgeId,
					operation: 'delete',
					success: true
				}
			};
		} catch (error) {
			return {
				ok: false,
				error: error instanceof Error ? error : new Error(String(error))
			};
		}
	}

	// ===== BATCH OPERATIONS =====

	/**
	 * Execute multiple operations in batch with two-phase execution:
	 * Phase 1: All node operations (create, update, delete)
	 * Phase 2: All edge operations (create, update, delete)
	 *
	 * This ensures all nodes exist before edges are created,
	 * allowing proper ref-to-ID resolution.
	 */
	executeBatch(operations: Array<
		| { type: 'createTextNode'; params: CreateTextNodeParams }
		| { type: 'createFileNode'; params: CreateFileNodeParams }
		| { type: 'createLinkNode'; params: CreateLinkNodeParams }
		| { type: 'createGroupNode'; params: CreateGroupNodeParams }
		| { type: 'updateNode'; params: UpdateNodeParams }
		| { type: 'deleteNode'; nodeId: string }
		| { type: 'createEdge'; params: CreateEdgeParams }
		| { type: 'updateEdge'; params: UpdateEdgeParams }
		| { type: 'deleteEdge'; edgeId: string }
	>): BatchOperationResult {
		const nodeResults: NodeOperationResult[] = [];
		const edgeResults: EdgeOperationResult[] = [];

		// Separate node and edge operations
		const nodeOps = operations.filter(op =>
			op.type === 'createTextNode' ||
			op.type === 'createFileNode' ||
			op.type === 'createLinkNode' ||
			op.type === 'createGroupNode' ||
			op.type === 'updateNode' ||
			op.type === 'deleteNode'
		);

		const edgeOps = operations.filter(op =>
			op.type === 'createEdge' ||
			op.type === 'updateEdge' ||
			op.type === 'deleteEdge'
		);

		// PHASE 1: Execute all node operations
		for (const op of nodeOps) {
			let result;

			switch (op.type) {
				case 'createTextNode':
					result = this.createTextNode(op.params);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.params.ref || 'unknown',
							operation: 'create',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'createFileNode':
					result = this.createFileNode(op.params);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.params.ref || 'unknown',
							operation: 'create',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'createLinkNode':
					result = this.createLinkNode(op.params);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.params.ref || 'unknown',
							operation: 'create',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'createGroupNode':
					result = this.createGroupNode(op.params);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.params.ref || 'unknown',
							operation: 'create',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'updateNode':
					result = this.updateNode(op.params);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.params.id,
							operation: 'update',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'deleteNode':
					result = this.deleteNode(op.nodeId);
					if (result.ok) {
						nodeResults.push(result.value);
					} else {
						nodeResults.push({
							nodeId: op.nodeId,
							operation: 'delete',
							success: false,
							error: result.error.message
						});
					}
					break;
			}
		}

		// PHASE 2: Execute all edge operations
		for (const op of edgeOps) {
			let result;

			switch (op.type) {
				case 'createEdge':
					result = this.createEdge(op.params);
					if (result.ok) {
						edgeResults.push(result.value);
					} else {
						edgeResults.push({
							edgeId: 'unknown',
							operation: 'create',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'updateEdge':
					result = this.updateEdge(op.params);
					if (result.ok) {
						edgeResults.push(result.value);
					} else {
						edgeResults.push({
							edgeId: op.params.id,
							operation: 'update',
							success: false,
							error: result.error.message
						});
					}
					break;

				case 'deleteEdge':
					result = this.deleteEdge(op.edgeId);
					if (result.ok) {
						edgeResults.push(result.value);
					} else {
						edgeResults.push({
							edgeId: op.edgeId,
							operation: 'delete',
							success: false,
							error: result.error.message
						});
					}
					break;
			}
		}

		return {
			nodes: nodeResults,
			edges: edgeResults,
			canvasData: this.getData()
		};
	}
}
