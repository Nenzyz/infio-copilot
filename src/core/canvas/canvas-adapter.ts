import type { Canvas } from '../../types/canvas-api';
import { CanvasOperations } from './canvas-operations';
import type {
	CreateTextNodeParams,
	CreateFileNodeParams,
	CreateLinkNodeParams,
	CreateGroupNodeParams,
	UpdateNodeParams,
	CreateEdgeParams,
	UpdateEdgeParams,
	RelativePosition,
	BatchOperationResult
} from './types/canvas-types';

/**
 * AI-friendly operation format
 * Accepts more flexible formats and handles normalization
 */
export interface AIOperation {
	action: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'update_edge' | 'remove_edge';

	// Node fields (flexible names accepted)
	ref?: string;           // Reference ID for use in edges
	id?: string;           // For updates/deletes or actual IDs
	type?: string;         // Will normalize to node_type
	node_type?: string;

	// Position (flexible formats)
	x?: number;
	y?: number;
	pos?: [number, number];
	position?: RelativePosition | { x: number; y: number };
	relative_to?: string;  // Shorthand for relative positioning
	direction?: 'above' | 'below' | 'left' | 'right';
	offset?: number;

	// Size (flexible formats)
	width?: number;
	height?: number;
	size?: [number, number] | { width?: number; height?: number };

	// Node content
	text?: string;
	content?: string;      // Will normalize to text
	file?: string;
	subpath?: string;
	url?: string;
	label?: string;
	background?: string;
	background_style?: 'cover' | 'ratio' | 'repeat';
	color?: string;

	// Edge fields (supports both camelCase and snake_case)
	fromNode?: string;     // camelCase
	from_node?: string;    // snake_case
	from?: string;         // shorthand - normalizes to fromNode
	toNode?: string;       // camelCase
	to_node?: string;      // snake_case
	to?: string;          // shorthand - normalizes to toNode
	fromSide?: 'top' | 'right' | 'bottom' | 'left';  // camelCase
	from_side?: 'top' | 'right' | 'bottom' | 'left'; // snake_case
	toSide?: 'top' | 'right' | 'bottom' | 'left';    // camelCase
	to_side?: 'top' | 'right' | 'bottom' | 'left';   // snake_case
	fromEnd?: 'none' | 'arrow';                      // camelCase
	from_end?: 'none' | 'arrow';                     // snake_case
	toEnd?: 'none' | 'arrow';                        // camelCase
	to_end?: 'none' | 'arrow';                       // snake_case

	// Nested structures (for compatibility)
	node?: any;
	node_data?: any;
	edge?: any;
	edge_data?: any;
}

/**
 * Canvas Adapter
 * Transforms AI operations into CanvasOperations format and applies to Canvas API
 */
export class CanvasAdapter {
	private canvas: Canvas;
	private operations: CanvasOperations;

	constructor(canvas: Canvas) {
		this.canvas = canvas;
		// Initialize with current canvas data
		this.operations = new CanvasOperations(canvas.getData());
	}

	/**
	 * Execute AI operations and apply to canvas
	 */
	async executeOperations(aiOps: AIOperation[]): Promise<{ success: boolean; results: string[]; error?: string }> {
		const results: string[] = [];

		try {
			// CRITICAL: Sync CanvasOperations with current canvas state
			// This ensures we don't lose nodes/edges added outside this adapter
			this.operations = new CanvasOperations(this.canvas.getData());

			// Transform AI operations to CanvasOperations format
			const transformedOps = this.transformOperations(aiOps);

			// Execute through CanvasOperations service (with two-phase execution)
			const batchResult = this.operations.executeBatch(transformedOps);

			// Apply changes to actual Canvas API
			await this.applyToCanvas(batchResult);

			// Generate result messages
			for (const nodeResult of batchResult.nodes) {
				if (nodeResult.success) {
					results.push(`✅ ${nodeResult.operation} node: ${nodeResult.nodeId}`);
				} else {
					results.push(`❌ Failed to ${nodeResult.operation} node: ${nodeResult.error || 'unknown error'}`);
				}
			}

			for (const edgeResult of batchResult.edges) {
				if (edgeResult.success) {
					results.push(`✅ ${edgeResult.operation} edge: ${edgeResult.edgeId}`);
				} else {
					results.push(`❌ Failed to ${edgeResult.operation} edge: ${edgeResult.error || 'unknown error'}`);
				}
			}

			return { success: true, results };
		} catch (error) {
			return {
				success: false,
				results,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * Transform AI operations to CanvasOperations format
	 */
	private transformOperations(aiOps: AIOperation[]): Array<any> {
		return aiOps.map(op => this.transformSingleOperation(op));
	}

	/**
	 * Transform a single AI operation
	 */
	private transformSingleOperation(op: AIOperation): any {
		// Flatten nested structures
		let normalized = { ...op };
		if (op.node_data) {
			normalized = { ...normalized, ...op.node_data };
		} else if (op.node) {
			normalized = { ...normalized, ...op.node };
		} else if (op.edge_data) {
			normalized = { ...normalized, ...op.edge_data };
		} else if (op.edge) {
			normalized = { ...normalized, ...op.edge };
		}

		switch (op.action) {
			case 'add_node':
				return this.transformAddNode(normalized);

			case 'update_node':
				return {
					type: 'updateNode',
					params: this.transformUpdateNode(normalized)
				};

			case 'remove_node':
				return {
					type: 'deleteNode',
					nodeId: normalized.id || normalized.ref || ''
				};

			case 'add_edge':
				return {
					type: 'createEdge',
					params: this.transformAddEdge(normalized)
				};

			case 'update_edge':
				return {
					type: 'updateEdge',
					params: this.transformUpdateEdge(normalized)
				};

			case 'remove_edge':
				return {
					type: 'deleteEdge',
					edgeId: normalized.id || ''
				};

			default:
				throw new Error(`Unknown operation action: ${op.action}`);
		}
	}

	/**
	 * Transform add_node to createNode params
	 */
	private transformAddNode(op: any): any {
		// Normalize node type
		const nodeType = op.node_type || op.type;
		if (!nodeType) {
			throw new Error('Node type is required for add_node operation');
		}

		// Build position
		const position = this.transformPosition(op);

		// Build size
		const size = this.transformSize(op);

		// Determine ref: use ref, id, or node_id in that order
		const refId = op.ref || op.id || op.node_id;

		// Common params
		const commonParams = {
			position,
			...(size && { size }),
			...(op.color && { color: op.color }),
			...(refId && { ref: refId })
		};

		// Type-specific operations
		switch (nodeType) {
			case 'text':
				return {
					type: 'createTextNode',
					params: {
						...commonParams,
						text: op.text || op.content || ''
					} as CreateTextNodeParams
				};

			case 'file':
				if (!op.file) {
					throw new Error('File path is required for file node');
				}
				return {
					type: 'createFileNode',
					params: {
						...commonParams,
						file: op.file,
						...(op.subpath && { subpath: op.subpath })
					} as CreateFileNodeParams
				};

			case 'link':
				if (!op.url) {
					throw new Error('URL is required for link node');
				}
				return {
					type: 'createLinkNode',
					params: {
						...commonParams,
						url: op.url
					} as CreateLinkNodeParams
				};

			case 'group':
				return {
					type: 'createGroupNode',
					params: {
						...commonParams,
						...(op.label && { label: op.label }),
						...(op.background && { background: op.background }),
						...(op.background_style && { backgroundStyle: op.background_style })
					} as CreateGroupNodeParams
				};

			default:
				throw new Error(`Unknown node type: ${nodeType}`);
		}
	}

	/**
	 * Transform position from various formats
	 */
	private transformPosition(op: any): RelativePosition {
		// Already a RelativePosition object
		if (op.position && typeof op.position === 'object' && 'type' in op.position) {
			return op.position as RelativePosition;
		}

		// Relative positioning shorthand
		if (op.relative_to && op.direction) {
			return {
				type: 'relative',
				nodeId: op.relative_to,
				direction: op.direction,
				...(op.offset && { offset: op.offset })
			};
		}

		// Position as object
		if (op.position && typeof op.position === 'object' && 'x' in op.position) {
			return {
				type: 'absolute',
				x: op.position.x || 0,
				y: op.position.y || 0
			};
		}

		// Position as array
		if (op.pos && Array.isArray(op.pos)) {
			return {
				type: 'absolute',
				x: op.pos[0] || 0,
				y: op.pos[1] || 0
			};
		}

		// Individual x, y coordinates
		if (op.x !== undefined || op.y !== undefined) {
			return {
				type: 'absolute',
				x: op.x || 0,
				y: op.y || 0
			};
		}

		// Default to center
		return { type: 'center' };
	}

	/**
	 * Transform size from various formats
	 */
	private transformSize(op: any): { width?: number; height?: number } | undefined {
		// Size as object
		if (op.size && typeof op.size === 'object' && !Array.isArray(op.size)) {
			return op.size;
		}

		// Size as array
		if (op.size && Array.isArray(op.size)) {
			return {
				width: op.size[0],
				height: op.size[1]
			};
		}

		// Individual width, height
		if (op.width !== undefined || op.height !== undefined) {
			return {
				...(op.width !== undefined && { width: op.width }),
				...(op.height !== undefined && { height: op.height })
			};
		}

		return undefined;
	}

	/**
	 * Transform update_node params
	 */
	private transformUpdateNode(op: any): UpdateNodeParams {
		const params: UpdateNodeParams = {
			id: op.id || op.ref || ''
		};

		// Position updates
		if (op.x !== undefined || op.y !== undefined) {
			params.position = {
				...(op.x !== undefined && { x: op.x }),
				...(op.y !== undefined && { y: op.y })
			};
		}

		// Size updates
		const size = this.transformSize(op);
		if (size) {
			params.size = size;
		}

		// Content updates
		if (op.text !== undefined || op.content !== undefined) {
			params.text = op.text || op.content;
		}
		if (op.file !== undefined) params.file = op.file;
		if (op.subpath !== undefined) params.subpath = op.subpath;
		if (op.url !== undefined) params.url = op.url;
		if (op.label !== undefined) params.label = op.label;
		if (op.background !== undefined) params.background = op.background;
		if (op.background_style !== undefined) params.backgroundStyle = op.background_style;
		if (op.color !== undefined) params.color = op.color;

		return params;
	}

	/**
	 * Transform add_edge params
	 */
	private transformAddEdge(op: any): CreateEdgeParams {
		return {
			// Handle multiple field name variations
			fromNode: op.fromNode || op.from_node || op.from || '',
			toNode: op.toNode || op.to_node || op.to || '',
			...(op.fromSide || op.from_side) && { fromSide: op.fromSide || op.from_side },
			...(op.toSide || op.to_side) && { toSide: op.toSide || op.to_side },
			...(op.fromEnd || op.from_end) && { fromEnd: op.fromEnd || op.from_end },
			...(op.toEnd || op.to_end) && { toEnd: op.toEnd || op.to_end },
			...(op.color && { color: op.color }),
			...(op.label && { label: op.label })
		};
	}

	/**
	 * Transform update_edge params
	 */
	private transformUpdateEdge(op: any): UpdateEdgeParams {
		const params: UpdateEdgeParams = {
			id: op.id || ''
		};

		// Handle multiple field name variations
		if (op.fromNode || op.from_node || op.from) params.fromNode = op.fromNode || op.from_node || op.from;
		if (op.toNode || op.to_node || op.to) params.toNode = op.toNode || op.to_node || op.to;
		if (op.fromSide || op.from_side) params.fromSide = op.fromSide || op.from_side;
		if (op.toSide || op.to_side) params.toSide = op.toSide || op.to_side;
		if (op.fromEnd || op.from_end) params.fromEnd = op.fromEnd || op.from_end;
		if (op.toEnd || op.to_end) params.toEnd = op.toEnd || op.to_end;
		if (op.color) params.color = op.color;
		if (op.label) params.label = op.label;

		return params;
	}

	/**
	 * Resolve a node ID through the refMap to get the real Canvas ID
	 * Follows the chain: ref -> internal ID -> real Canvas ID
	 */
	private resolveCanvasNodeId(nodeId: string): string {
		// Try to resolve through all intermediate refs
		let currentId = nodeId;
		let resolved = this.operations.getRefMapping(currentId);

		while (resolved && resolved !== currentId) {
			currentId = resolved;
			resolved = this.operations.getRefMapping(currentId);
		}

		return currentId;
	}

	/**
	 * Apply CanvasOperations result to actual Canvas API
	 * Uses incremental operation-by-operation approach
	 */
	private async applyToCanvas(result: BatchOperationResult): Promise<void> {
		// Use setData() for EVERYTHING (nodes + edges together)
		// This ensures consistency - Canvas processes all changes at once

		const currentData = this.canvas.getData();
		const newData = result.canvasData;

		// Resolve edge node IDs to use actual Canvas node IDs
		const nodeIdMap = new Map<string, string>();

		// Map existing node IDs (they stay the same)
		for (const node of currentData.nodes) {
			nodeIdMap.set(node.id, node.id);
		}

		// Generate new IDs for new nodes
		for (const node of newData.nodes) {
			if (!nodeIdMap.has(node.id)) {
				// Generate a Canvas-style ID
				const canvasId = this.generateCanvasId();
				nodeIdMap.set(node.id, canvasId);
				node.id = canvasId; // Update the node with its new ID
			}
		}

		// Resolve edge references
		for (const edge of newData.edges) {
			const resolvedFromId = nodeIdMap.get(edge.fromNode) || edge.fromNode;
			const resolvedToId = nodeIdMap.get(edge.toNode) || edge.toNode;

			edge.fromNode = resolvedFromId;
			edge.toNode = resolvedToId;

			// Ensure required edge fields
			if (!edge.styleAttributes) edge.styleAttributes = {};
			if (edge.toFloating === undefined) edge.toFloating = false;
			if (!edge.fromSide) edge.fromSide = "right";
			if (!edge.toSide) edge.toSide = "left";
		}

		// Apply everything at once via setData
		this.canvas.setData(newData);

		// Request save immediately to persist before other plugins interfere
		this.canvas.requestSave();

		// Force a second save after a delay to ensure persistence
		// This helps when other plugins (like Advanced Canvas) might interfere
		await new Promise(resolve => setTimeout(resolve, 100));
		this.canvas.requestSave();
	}

	/**
	 * Generate a Canvas-style node ID
	 */
	private generateCanvasId(): string {
		return Array.from({ length: 16 }, () =>
			Math.floor(Math.random() * 16).toString(16)
		).join('');
	}

	/**
	 * Apply a single node addition
	 */
	private applyNodeAddition(node: any): any {
		const pos = { x: node.x, y: node.y };
		const size = { width: node.width, height: node.height };

		let createdNode: any;
		switch (node.type) {
			case 'text':
				createdNode = this.canvas.createTextNode({ pos, size, text: node.text });
				break;
			case 'file':
				createdNode = this.canvas.createFileNode({
					pos,
					size,
					file: node.file,
					...(node.subpath && { subpath: node.subpath })
				});
				break;
			case 'link':
				createdNode = this.canvas.createLinkNode({ pos, size, url: node.url });
				break;
			case 'group':
				createdNode = this.canvas.createGroupNode({
					pos,
					size,
					...(node.label && { label: node.label }),
					...(node.background && { background: node.background }),
					...(node.backgroundStyle && { backgroundStyle: node.backgroundStyle })
				});
				break;
		}

		if (createdNode) {
			// CRITICAL: Register the node with Canvas's interaction system
			// Without this, the node won't respond properly to mouse events (move, select, etc.)
			this.canvas.addNode(createdNode);

			// Force Canvas to process this node before creating the next one
			this.canvas.requestSave();
		}

		return createdNode;
	}

	/**
	 * Apply a single node removal
	 */
	private applyNodeRemoval(nodeId: string): void {
		const node = this.canvas.nodes.get(nodeId);
		if (node) {
			this.canvas.removeNode(node);
		}
	}

	/**
	 * Apply a single node update
	 */
	private applyNodeUpdate(node: any): void {
		const canvasNode = this.canvas.nodes.get(node.id);
		if (canvasNode) {
			// Update position and size
			canvasNode.moveAndResize({
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height
			});

			// Update node data for content changes
			const nodeData = canvasNode.getData();
			Object.assign(nodeData, node);
			canvasNode.setData(nodeData);
		}
	}

	/**
	 * Apply edge operations in batch
	 * Get data once, modify all edges, then setData once
	 */
	private async applyEdgeOperations(currentData: any, newData: any, nodeIdMap: Map<string, string>): Promise<void> {
		const currentEdgeIds = new Set(currentData.edges.map((e: any) => e.id));
		const newEdgeIds = new Set(newData.edges.map((e: any) => e.id));

		// Find edges to add
		const edgesToAdd = newData.edges.filter((e: any) => !currentEdgeIds.has(e.id));

		// Find edges to remove
		const edgesToRemove = currentData.edges.filter((e: any) => !newEdgeIds.has(e.id));

		// Find edges to update
		const edgesToUpdate = newData.edges.filter((e: any) => {
			const current = currentData.edges.find((ce: any) => ce.id === e.id);
			return current && JSON.stringify(current) !== JSON.stringify(e);
		});

		// Skip if no edge changes
		if (edgesToAdd.length === 0 && edgesToRemove.length === 0 && edgesToUpdate.length === 0) {
			return;
		}

		// Get fresh canvas data AFTER nodes have been created
		const canvasData = this.canvas.getData();

		// Apply all edge changes to this data
		for (const edge of edgesToRemove) {
			const index = canvasData.edges.findIndex((e: any) => e.id === edge.id);
			if (index !== -1) {
				canvasData.edges.splice(index, 1);
			}
		}

		for (const edge of edgesToAdd) {
			const newEdge = this.buildEdgeData(edge, nodeIdMap);
			canvasData.edges.push(newEdge);
		}

		for (const edge of edgesToUpdate) {
			const index = canvasData.edges.findIndex((e: any) => e.id === edge.id);
			if (index !== -1) {
				const updatedEdge = this.buildEdgeData(edge, nodeIdMap, canvasData.edges[index]);
				canvasData.edges[index] = updatedEdge;
			}
		}

		// Apply all edge changes - DON'T use deep copy, Canvas needs the actual object reference
		this.canvas.setData(canvasData);

		// Wait briefly for Canvas to refresh internal state
		await new Promise(resolve => setTimeout(resolve, 50));
	}

	/**
	 * Build edge data structure with proper field resolution
	 */
	private buildEdgeData(edge: any, nodeIdMap: Map<string, string>, existingEdge?: any): any {
		// Resolve node IDs (handle both camelCase and snake_case)
		const fromNodeRef = edge.fromNode || edge.from_node || edge.from;
		const toNodeRef = edge.toNode || edge.to_node || edge.to;

		const realFromId = nodeIdMap.get(fromNodeRef) || this.resolveCanvasNodeId(fromNodeRef);
		const realToId = nodeIdMap.get(toNodeRef) || this.resolveCanvasNodeId(toNodeRef);

		// Build edge data properly - matching actual Canvas edge structure
		// Required fields that MUST be present (based on sample edge structure)
		const newEdge: any = {
			id: edge.id,
			styleAttributes: {},  // Required
			toFloating: false,    // Required
			fromNode: realFromId,
			toNode: realToId,
			fromSide: edge.fromSide || edge.from_side || (existingEdge?.fromSide) || "right",  // Required - default to "right"
			toSide: edge.toSide || edge.to_side || (existingEdge?.toSide) || "left"          // Required - default to "left"
		};

		// Add optional fields
		if (edge.from_end || edge.fromEnd) {
			newEdge.fromEnd = edge.fromEnd || edge.from_end;
		}
		if (edge.to_end || edge.toEnd) {
			newEdge.toEnd = edge.toEnd || edge.to_end;
		}
		if (edge.label !== undefined) {
			newEdge.label = edge.label;
		}
		if (edge.color !== undefined) {
			newEdge.color = edge.color;
		}

		return newEdge;
	}

	/**
	 * Apply a single edge addition
	 */
	private applyEdgeAddition(edge: any, nodeIdMap: Map<string, string>): void {
		const canvasData = this.canvas.getData();

		// Resolve node IDs (handle both camelCase and snake_case)
		const fromNodeRef = edge.fromNode || edge.from_node || edge.from;
		const toNodeRef = edge.toNode || edge.to_node || edge.to;

		const realFromId = nodeIdMap.get(fromNodeRef) || this.resolveCanvasNodeId(fromNodeRef);
		const realToId = nodeIdMap.get(toNodeRef) || this.resolveCanvasNodeId(toNodeRef);

		// Build edge data properly - matching actual Canvas edge structure
		// Required fields that MUST be present (based on sample edge structure)
		const newEdge: any = {
			id: edge.id,
			styleAttributes: {},  // Required
			toFloating: false,    // Required
			fromNode: realFromId,
			toNode: realToId,
			fromSide: edge.fromSide || edge.from_side || "right",  // Required - default to "right"
			toSide: edge.toSide || edge.to_side || "left"          // Required - default to "left"
		};
		if (edge.from_end || edge.fromEnd) {
			newEdge.fromEnd = edge.fromEnd || edge.from_end;
		}
		if (edge.to_end || edge.toEnd) {
			newEdge.toEnd = edge.toEnd || edge.to_end;
		}
		if (edge.label) {
			newEdge.label = edge.label;
		}
		if (edge.color) {
			newEdge.color = edge.color;
		}

		// Add edge to data
		canvasData.edges.push(newEdge);

		// Create a deep copy to avoid reference issues
		const freshData = JSON.parse(JSON.stringify(canvasData));

		// Apply immediately with fresh copy
		this.canvas.setData(freshData);
	}

	/**
	 * Apply a single edge removal
	 */
	private applyEdgeRemoval(edgeId: string): void {
		const canvasData = this.canvas.getData();

		const index = canvasData.edges.findIndex((e: any) => e.id === edgeId);
		if (index !== -1) {
			canvasData.edges.splice(index, 1);
			this.canvas.setData(canvasData);
		}
	}

	/**
	 * Apply a single edge update
	 */
	private applyEdgeUpdate(edge: any, nodeIdMap: Map<string, string>): void {
		const canvasData = this.canvas.getData();

		const index = canvasData.edges.findIndex((e: any) => e.id === edge.id);
		if (index !== -1) {
			// Resolve node IDs (handle both camelCase and snake_case)
			const fromNodeRef = edge.fromNode || edge.from_node || edge.from;
			const toNodeRef = edge.toNode || edge.to_node || edge.to;

			const realFromId = fromNodeRef ? (nodeIdMap.get(fromNodeRef) || this.resolveCanvasNodeId(fromNodeRef)) : canvasData.edges[index].fromNode;
			const realToId = toNodeRef ? (nodeIdMap.get(toNodeRef) || this.resolveCanvasNodeId(toNodeRef)) : canvasData.edges[index].toNode;

			// Build updated edge data properly - matching actual Canvas edge structure
			// Get existing edge for defaults
			const existingEdge = canvasData.edges[index];

			// Required fields that MUST be present
			const updatedEdge: any = {
				id: edge.id,
				styleAttributes: {},  // Required
				toFloating: false,    // Required
				fromNode: realFromId,
				toNode: realToId,
				fromSide: edge.fromSide || edge.from_side || existingEdge.fromSide || "right",  // Required - preserve existing or default
				toSide: edge.toSide || edge.to_side || existingEdge.toSide || "left"          // Required - preserve existing or default
			};
			if (edge.from_end || edge.fromEnd) {
				updatedEdge.fromEnd = edge.fromEnd || edge.from_end;
			}
			if (edge.to_end || edge.toEnd) {
				updatedEdge.toEnd = edge.toEnd || edge.to_end;
			}
			if (edge.label !== undefined) {
				updatedEdge.label = edge.label;
			}
			if (edge.color !== undefined) {
				updatedEdge.color = edge.color;
			}

			canvasData.edges[index] = updatedEdge;

			this.canvas.setData(canvasData);
		}
	}
}
