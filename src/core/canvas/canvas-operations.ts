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
	InsertTextParams,
	SearchReplaceTextParams,
	AppendTextParams,
	PrependTextParams,
	BuildGroupParams,
	GroupNodeSpec,
	GroupLayout,
	CreateEdgeParams,
	UpdateEdgeParams,
	NodeOperationResult,
	EdgeOperationResult,
	BatchOperationResult,
	Result,
	RelativePosition,
	Position,
	Size
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

	// ===== TEXT EDITING OPERATIONS =====

	/**
	 * Insert text at a specific line position
	 */
	insertText(params: InsertTextParams): Result<NodeOperationResult> {
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

			if (node.type !== 'text') {
				return {
					ok: false,
					error: new Error(`Cannot insert text into ${node.type} node - only text nodes support text editing`)
				};
			}

			const lines = node.text.split('\n');
			const lineIndex = params.start_line - 1; // Convert to 0-based

			// Insert content at the specified line
			if (lineIndex < 0 || lineIndex > lines.length) {
				return {
					ok: false,
					error: new Error(`Line ${params.start_line} is out of range (1-${lines.length + 1})`)
				};
			}

			lines.splice(lineIndex, 0, params.content);
			const newText = lines.join('\n');

			const success = this.graph.updateNode(actualId, { text: newText } as Partial<AllCanvasNodeData>);

			return {
				ok: true,
				value: {
					nodeId: actualId,
					operation: 'insert_text',
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
	 * Search and replace text
	 */
	searchReplaceText(params: SearchReplaceTextParams): Result<NodeOperationResult> {
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

			if (node.type !== 'text') {
				return {
					ok: false,
					error: new Error(`Cannot search/replace text in ${node.type} node - only text nodes support text editing`)
				};
			}

			let text = node.text;

			// Handle line range restrictions
			if (params.start_line !== undefined || params.end_line !== undefined) {
				const lines = text.split('\n');
				const startIdx = (params.start_line || 1) - 1;
				const endIdx = params.end_line ? params.end_line - 1 : lines.length - 1;

				// Extract the target range
				const targetLines = lines.slice(startIdx, endIdx + 1);
				let targetText = targetLines.join('\n');

				// Perform replacement on target range
				targetText = this.performReplace(targetText, params);

				// Reconstruct full text
				const beforeLines = lines.slice(0, startIdx);
				const afterLines = lines.slice(endIdx + 1);
				text = [...beforeLines, targetText, ...afterLines].join('\n');
			} else {
				// Replace in entire text
				text = this.performReplace(text, params);
			}

			const success = this.graph.updateNode(actualId, { text } as Partial<AllCanvasNodeData>);

			return {
				ok: true,
				value: {
					nodeId: actualId,
					operation: 'search_replace_text',
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
	 * Helper method to perform text replacement
	 */
	private performReplace(text: string, params: SearchReplaceTextParams): string {
		if (params.use_regex) {
			const flags = params.ignore_case ? 'gi' : 'g';
			const regex = new RegExp(params.search, flags);
			return text.replace(regex, params.replace);
		} else {
			// Simple string replacement (all occurrences)
			const searchStr = params.ignore_case ? params.search.toLowerCase() : params.search;
			let result = text;

			if (params.ignore_case) {
				// Case-insensitive string replacement
				const regex = new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
				result = text.replace(regex, params.replace);
			} else {
				// Case-sensitive replacement
				result = text.split(params.search).join(params.replace);
			}

			return result;
		}
	}

	/**
	 * Append text to the end
	 */
	appendText(params: AppendTextParams): Result<NodeOperationResult> {
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

			if (node.type !== 'text') {
				return {
					ok: false,
					error: new Error(`Cannot append text to ${node.type} node - only text nodes support text editing`)
				};
			}

			const newText = node.text + params.content;
			const success = this.graph.updateNode(actualId, { text: newText } as Partial<AllCanvasNodeData>);

			return {
				ok: true,
				value: {
					nodeId: actualId,
					operation: 'append_text',
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
	 * Prepend text to the beginning
	 */
	prependText(params: PrependTextParams): Result<NodeOperationResult> {
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

			if (node.type !== 'text') {
				return {
					ok: false,
					error: new Error(`Cannot prepend text to ${node.type} node - only text nodes support text editing`)
				};
			}

			const newText = params.content + node.text;
			const success = this.graph.updateNode(actualId, { text: newText } as Partial<AllCanvasNodeData>);

			return {
				ok: true,
				value: {
					nodeId: actualId,
					operation: 'prepend_text',
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
	 * Build a group with multiple nodes inside using automatic layout
	 */
	buildGroup(params: BuildGroupParams): Result<BatchOperationResult> {
		try {
			const layout = params.layout || 'vertical';
			const spacing = params.spacing ?? 20;
			const padding = params.padding ?? 20;
			const gridColumns = params.gridColumns ?? 2;

			// Default sizes for different node types
			const getDefaultSize = (spec: GroupNodeSpec): Size => {
				const width = spec.width ?? 250;
				const height = spec.height ?? (spec.type === 'file' ? 400 : spec.type === 'text' ? 150 : 60);
				return { width, height };
			};

			// Calculate node sizes
			const nodeSizes = params.nodes.map(spec => getDefaultSize(spec));

			// Calculate positions based on layout strategy
			const nodePositions: Position[] = [];
			let groupWidth = 0;
			let groupHeight = 0;

			if (layout === 'vertical') {
				let currentY = padding;
				const maxWidth = Math.max(...nodeSizes.map(s => s.width));

				for (const size of nodeSizes) {
					nodePositions.push({ x: padding, y: currentY });
					currentY += size.height + spacing;
				}

				groupWidth = maxWidth + (padding * 2);
				groupHeight = currentY - spacing + padding;
			} else if (layout === 'horizontal') {
				let currentX = padding;
				const maxHeight = Math.max(...nodeSizes.map(s => s.height));

				for (const size of nodeSizes) {
					nodePositions.push({ x: currentX, y: padding });
					currentX += size.width + spacing;
				}

				groupWidth = currentX - spacing + padding;
				groupHeight = maxHeight + (padding * 2);
			} else if (layout === 'grid') {
				let row = 0;
				let col = 0;
				const maxWidthPerCol: number[] = [];
				const maxHeightPerRow: number[] = [];

				// Calculate max dimensions per row/col
				params.nodes.forEach((spec, i) => {
					const size = nodeSizes[i];
					const currentRow = Math.floor(i / gridColumns);
					const currentCol = i % gridColumns;

					if (!maxWidthPerCol[currentCol]) maxWidthPerCol[currentCol] = 0;
					if (!maxHeightPerRow[currentRow]) maxHeightPerRow[currentRow] = 0;

					maxWidthPerCol[currentCol] = Math.max(maxWidthPerCol[currentCol], size.width);
					maxHeightPerRow[currentRow] = Math.max(maxHeightPerRow[currentRow], size.height);
				});

				// Position nodes
				params.nodes.forEach((spec, i) => {
					const currentRow = Math.floor(i / gridColumns);
					const currentCol = i % gridColumns;

					const x = padding + maxWidthPerCol.slice(0, currentCol).reduce((sum, w) => sum + w + spacing, 0);
					const y = padding + maxHeightPerRow.slice(0, currentRow).reduce((sum, h) => sum + h + spacing, 0);

					nodePositions.push({ x, y });
				});

				groupWidth = padding + maxWidthPerCol.reduce((sum, w) => sum + w, 0) + (spacing * (maxWidthPerCol.length - 1)) + padding;
				groupHeight = padding + maxHeightPerRow.reduce((sum, h) => sum + h, 0) + (spacing * (maxHeightPerRow.length - 1)) + padding;
			} else if (layout === 'manual') {
				// Use provided positions or default to (0, 0)
				params.nodes.forEach((spec, i) => {
					nodePositions.push({
						x: spec.x ?? (padding + i * 50),
						y: spec.y ?? (padding + i * 50)
					});
				});

				// Calculate bounding box
				const allX = nodePositions.map((p, i) => [p.x, p.x + nodeSizes[i].width]).flat();
				const allY = nodePositions.map((p, i) => [p.y, p.y + nodeSizes[i].height]).flat();
				groupWidth = Math.max(...allX) + padding;
				groupHeight = Math.max(...allY) + padding;
			}

			// Resolve group position
			const groupPos = this.resolvePosition(params.position);

			// Create the group node first
			const groupResult = this.createGroupNode({
				label: params.label,
				background: params.background,
				backgroundStyle: params.backgroundStyle,
				position: { type: 'absolute', x: groupPos.x, y: groupPos.y },
				size: { width: groupWidth, height: groupHeight },
				color: params.color,
				ref: params.ref
			});

			if (!groupResult.ok) {
				return groupResult;
			}

			// Create child nodes with positions relative to group
			const nodeResults: NodeOperationResult[] = [groupResult.value];

			for (let i = 0; i < params.nodes.length; i++) {
				const spec = params.nodes[i];
				const pos = nodePositions[i];
				const size = nodeSizes[i];

				// Absolute position on canvas (group position + relative position)
				const absoluteX = groupPos.x + pos.x;
				const absoluteY = groupPos.y + pos.y;

				let nodeResult: Result<NodeOperationResult>;

				if (spec.type === 'text') {
					nodeResult = this.createTextNode({
						text: spec.text || '',
						position: { type: 'absolute', x: absoluteX, y: absoluteY },
						size,
						color: spec.color,
						ref: spec.ref
					});
				} else if (spec.type === 'file') {
					nodeResult = this.createFileNode({
						file: spec.file || '',
						subpath: spec.subpath,
						position: { type: 'absolute', x: absoluteX, y: absoluteY },
						size,
						color: spec.color,
						ref: spec.ref,
						portal: spec.portal
					});
				} else if (spec.type === 'link') {
					nodeResult = this.createLinkNode({
						url: spec.url || '',
						position: { type: 'absolute', x: absoluteX, y: absoluteY },
						size,
						color: spec.color,
						ref: spec.ref
					});
				} else {
					continue;
				}

				if (nodeResult.ok) {
					nodeResults.push(nodeResult.value);
				} else {
					nodeResults.push({
						nodeId: spec.ref || 'unknown',
						operation: 'create',
						success: false,
						error: nodeResult.error.message
					});
				}
			}

			return {
				ok: true,
				value: {
					nodes: nodeResults,
					edges: [],
					canvasData: this.graph.getData()
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
		| { type: 'insertText'; params: InsertTextParams }
		| { type: 'searchReplaceText'; params: SearchReplaceTextParams }
		| { type: 'appendText'; params: AppendTextParams }
		| { type: 'prependText'; params: PrependTextParams }
		| { type: 'buildGroup'; params: BuildGroupParams }
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
			op.type === 'deleteNode' ||
			op.type === 'insertText' ||
			op.type === 'searchReplaceText' ||
			op.type === 'appendText' ||
			op.type === 'prependText' ||
			op.type === 'buildGroup'
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

				case 'insertText':
					result = this.insertText(op.params);
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

				case 'searchReplaceText':
					result = this.searchReplaceText(op.params);
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

				case 'appendText':
					result = this.appendText(op.params);
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

				case 'prependText':
					result = this.prependText(op.params);
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

				case 'buildGroup':
					result = this.buildGroup(op.params);
					if (result.ok) {
						// buildGroup returns BatchOperationResult, so merge the node results
						nodeResults.push(...result.value.nodes);
					} else {
						nodeResults.push({
							nodeId: op.params.ref || 'unknown',
							operation: 'create',
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
