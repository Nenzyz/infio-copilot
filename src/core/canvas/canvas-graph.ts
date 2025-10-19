import type {
	CanvasData,
	AllCanvasNodeData,
	CanvasEdgeData,
	Position,
	Size,
	RelativePosition,
	BoundingBox,
	NodeQuery,
	GraphTraversalOptions,
	Result,
	NodeNotFoundError,
	EdgeNotFoundError,
	ValidationError
} from './types/canvas-types';

/**
 * Canvas Graph - Core service for canvas operations with graph traversal
 */
export class CanvasGraph {
	private data: CanvasData;
	private nodeMap: Map<string, AllCanvasNodeData>;
	private edgeMap: Map<string, CanvasEdgeData>;
	private adjacencyList: Map<string, Set<string>>; // nodeId -> connected nodeIds
	private reverseAdjacencyList: Map<string, Set<string>>; // nodeId -> nodes pointing to it

	constructor(canvasData: CanvasData) {
		this.data = canvasData;
		this.nodeMap = new Map();
		this.edgeMap = new Map();
		this.adjacencyList = new Map();
		this.reverseAdjacencyList = new Map();

		this.buildGraph();
	}

	/**
	 * Build internal graph structure
	 */
	private buildGraph(): void {
		// Build node map
		for (const node of this.data.nodes) {
			this.nodeMap.set(node.id, node);
			this.adjacencyList.set(node.id, new Set());
			this.reverseAdjacencyList.set(node.id, new Set());
		}

		// Build edge map and adjacency lists
		for (const edge of this.data.edges) {
			this.edgeMap.set(edge.id, edge);

			const fromSet = this.adjacencyList.get(edge.fromNode);
			if (fromSet) fromSet.add(edge.toNode);

			const toSet = this.reverseAdjacencyList.get(edge.toNode);
			if (toSet) toSet.add(edge.fromNode);
		}
	}

	/**
	 * Get current canvas data
	 */
	getData(): CanvasData {
		return {
			nodes: Array.from(this.nodeMap.values()),
			edges: Array.from(this.edgeMap.values())
		};
	}

	/**
	 * Get node by ID
	 */
	getNode(nodeId: string): AllCanvasNodeData | undefined {
		return this.nodeMap.get(nodeId);
	}

	/**
	 * Get edge by ID
	 */
	getEdge(edgeId: string): CanvasEdgeData | undefined {
		return this.edgeMap.get(edgeId);
	}

	/**
	 * Find nodes matching query
	 */
	findNodes(query: NodeQuery): AllCanvasNodeData[] {
		let results = Array.from(this.nodeMap.values());

		if (query.id) {
			const node = this.nodeMap.get(query.id);
			return node ? [node] : [];
		}

		if (query.type) {
			results = results.filter(n => n.type === query.type);
		}

		if (query.color) {
			results = results.filter(n => n.color === query.color);
		}

		if (query.text && results.length > 0) {
			results = results.filter(n =>
				n.type === 'text' && n.text.toLowerCase().includes(query.text!.toLowerCase())
			);
		}

		if (query.file && results.length > 0) {
			results = results.filter(n =>
				n.type === 'file' && n.file.includes(query.file!)
			);
		}

		if (query.inBounds) {
			const { x, y, width, height } = query.inBounds;
			results = results.filter(n =>
				n.x >= x && n.x <= x + width &&
				n.y >= y && n.y <= y + height
			);
		}

		return results;
	}

	/**
	 * Get neighbors of a node
	 */
	getNeighbors(nodeId: string, direction: 'incoming' | 'outgoing' | 'both' = 'both'): string[] {
		const outgoing = direction !== 'incoming' ? Array.from(this.adjacencyList.get(nodeId) || []) : [];
		const incoming = direction !== 'outgoing' ? Array.from(this.reverseAdjacencyList.get(nodeId) || []) : [];

		return [...new Set([...outgoing, ...incoming])];
	}

	/**
	 * Get edges connected to a node
	 */
	getConnectedEdges(nodeId: string): CanvasEdgeData[] {
		return Array.from(this.edgeMap.values()).filter(
			edge => edge.fromNode === nodeId || edge.toNode === nodeId
		);
	}

	/**
	 * Traverse graph from a starting node
	 */
	traverse(
		startNodeId: string,
		options: GraphTraversalOptions = {}
	): { nodes: AllCanvasNodeData[]; edges?: CanvasEdgeData[] } {
		const maxDepth = options.maxDepth ?? Infinity;
		const direction = options.direction ?? 'both';
		const includeEdges = options.includeEdges ?? false;

		const visited = new Set<string>();
		const nodes: AllCanvasNodeData[] = [];
		const edges: CanvasEdgeData[] = [];

		const dfs = (nodeId: string, depth: number) => {
			if (depth > maxDepth || visited.has(nodeId)) return;

			visited.add(nodeId);
			const node = this.nodeMap.get(nodeId);
			if (node) nodes.push(node);

			const neighbors = this.getNeighbors(nodeId, direction);
			for (const neighborId of neighbors) {
				if (includeEdges) {
					const connectedEdges = this.getConnectedEdges(nodeId).filter(
						e => e.toNode === neighborId || e.fromNode === neighborId
					);
					edges.push(...connectedEdges);
				}
				dfs(neighborId, depth + 1);
			}
		};

		dfs(startNodeId, 0);

		return includeEdges ? { nodes, edges } : { nodes };
	}

	/**
	 * Calculate absolute position from relative position
	 */
	calculatePosition(relativePos: RelativePosition, defaultSize: Size = { width: 250, height: 150 }): Position {
		switch (relativePos.type) {
			case 'absolute':
				return { x: relativePos.x, y: relativePos.y };

			case 'center': {
				if (this.nodeMap.size === 0) {
					return { x: 0, y: 0 };
				}
				const nodes = Array.from(this.nodeMap.values());
				const avgX = nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length;
				const avgY = nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length;
				return { x: Math.round(avgX), y: Math.round(avgY) };
			}

			case 'relative': {
				const refNode = this.nodeMap.get(relativePos.nodeId);
				if (!refNode) {
					throw new Error(`Reference node not found: ${relativePos.nodeId}`);
				}

				const offset = relativePos.offset ?? 50;
				const spacing = offset + defaultSize.width;

				switch (relativePos.direction) {
					case 'right':
						return { x: refNode.x + refNode.width + offset, y: refNode.y };
					case 'left':
						return { x: refNode.x - spacing, y: refNode.y };
					case 'below':
						return { x: refNode.x, y: refNode.y + refNode.height + offset };
					case 'above':
						return { x: refNode.x, y: refNode.y - defaultSize.height - offset };
				}
			}

			case 'near': {
				const refNode = this.nodeMap.get(relativePos.nodeId);
				if (!refNode) {
					throw new Error(`Reference node not found: ${relativePos.nodeId}`);
				}

				// Find nearest empty space around reference node
				const candidates = [
					{ x: refNode.x + refNode.width + 50, y: refNode.y },
					{ x: refNode.x - defaultSize.width - 50, y: refNode.y },
					{ x: refNode.x, y: refNode.y + refNode.height + 50 },
					{ x: refNode.x, y: refNode.y - defaultSize.height - 50 }
				];

				// Return first candidate (could be enhanced with collision detection)
				return candidates[0];
			}
		}
	}

	/**
	 * Calculate bounding box of multiple nodes
	 */
	calculateBoundingBox(nodeIds: string[]): BoundingBox | null {
		const nodes = nodeIds.map(id => this.nodeMap.get(id)).filter(Boolean) as AllCanvasNodeData[];
		if (nodes.length === 0) return null;

		const minX = Math.min(...nodes.map(n => n.x));
		const minY = Math.min(...nodes.map(n => n.y));
		const maxX = Math.max(...nodes.map(n => n.x + n.width));
		const maxY = Math.max(...nodes.map(n => n.y + n.height));

		return {
			x: minX,
			y: minY,
			width: maxX - minX,
			height: maxY - minY
		};
	}

	/**
	 * Generate unique ID
	 * Uses underscore separator to avoid conflict with Advanced Canvas portal IDs (which use dashes)
	 */
	generateId(prefix: string = 'node'): string {
		const timestamp = Date.now();
		const random = Math.random().toString(36).substr(2, 9);
		return `${prefix}_${timestamp}_${random}`;
	}

	/**
	 * Add a node to the graph
	 */
	addNode(node: AllCanvasNodeData): void {
		this.nodeMap.set(node.id, node);
		this.adjacencyList.set(node.id, new Set());
		this.reverseAdjacencyList.set(node.id, new Set());
	}

	/**
	 * Update a node in the graph
	 */
	updateNode(nodeId: string, updates: Partial<AllCanvasNodeData>): boolean {
		const node = this.nodeMap.get(nodeId);
		if (!node) return false;

		Object.assign(node, updates);
		return true;
	}

	/**
	 * Remove a node from the graph
	 */
	removeNode(nodeId: string): boolean {
		const node = this.nodeMap.get(nodeId);
		if (!node) return false;

		// Remove all connected edges
		const connectedEdges = this.getConnectedEdges(nodeId);
		for (const edge of connectedEdges) {
			this.removeEdge(edge.id);
		}

		// Remove from maps
		this.nodeMap.delete(nodeId);
		this.adjacencyList.delete(nodeId);
		this.reverseAdjacencyList.delete(nodeId);

		// Remove from other nodes' adjacency lists
		for (const set of this.adjacencyList.values()) {
			set.delete(nodeId);
		}
		for (const set of this.reverseAdjacencyList.values()) {
			set.delete(nodeId);
		}

		return true;
	}

	/**
	 * Add an edge to the graph
	 */
	addEdge(edge: CanvasEdgeData): void {
		this.edgeMap.set(edge.id, edge);

		const fromSet = this.adjacencyList.get(edge.fromNode);
		if (fromSet) fromSet.add(edge.toNode);

		const toSet = this.reverseAdjacencyList.get(edge.toNode);
		if (toSet) toSet.add(edge.fromNode);
	}

	/**
	 * Update an edge in the graph
	 */
	updateEdge(edgeId: string, updates: Partial<CanvasEdgeData>): boolean {
		const edge = this.edgeMap.get(edgeId);
		if (!edge) return false;

		// If fromNode or toNode changed, update adjacency lists
		if (updates.fromNode || updates.toNode) {
			this.removeEdge(edgeId);
			Object.assign(edge, updates);
			this.addEdge(edge);
		} else {
			Object.assign(edge, updates);
		}

		return true;
	}

	/**
	 * Remove an edge from the graph
	 */
	removeEdge(edgeId: string): boolean {
		const edge = this.edgeMap.get(edgeId);
		if (!edge) return false;

		const fromSet = this.adjacencyList.get(edge.fromNode);
		if (fromSet) fromSet.delete(edge.toNode);

		const toSet = this.reverseAdjacencyList.get(edge.toNode);
		if (toSet) toSet.delete(edge.fromNode);

		this.edgeMap.delete(edgeId);
		return true;
	}
}
