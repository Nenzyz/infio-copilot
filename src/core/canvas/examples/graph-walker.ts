/**
 * Graph Walker - Advanced graph traversal and manipulation examples
 *
 * Demonstrates how to use the canvas service for complex graph operations:
 * - Walking through connected nodes
 * - Finding paths between nodes
 * - Analyzing graph structure
 * - Bulk operations on subgraphs
 */

import { CanvasOperations } from '../canvas-operations';
import { CanvasGraph } from '../canvas-graph';
import type { CanvasData, AllCanvasNodeData } from '../types/canvas-types';

/**
 * Graph Walker for traversing and manipulating canvas graphs
 */
export class GraphWalker {
	private ops: CanvasOperations;
	private graph: CanvasGraph;

	constructor(canvasData: CanvasData) {
		this.ops = new CanvasOperations(canvasData);
		this.graph = this.ops.getGraph();
	}

	/**
	 * Find all leaf nodes (nodes with no outgoing edges)
	 */
	findLeafNodes(): AllCanvasNodeData[] {
		const allNodes = this.graph.getData().nodes;
		return allNodes.filter(node => {
			const neighbors = this.graph.getNeighbors(node.id, 'outgoing');
			return neighbors.length === 0;
		});
	}

	/**
	 * Find all root nodes (nodes with no incoming edges)
	 */
	findRootNodes(): AllCanvasNodeData[] {
		const allNodes = this.graph.getData().nodes;
		return allNodes.filter(node => {
			const neighbors = this.graph.getNeighbors(node.id, 'incoming');
			return neighbors.length === 0;
		});
	}

	/**
	 * Find path between two nodes (BFS)
	 */
	findPath(fromNodeId: string, toNodeId: string): string[] | null {
		const queue: { nodeId: string; path: string[] }[] = [
			{ nodeId: fromNodeId, path: [fromNodeId] }
		];
		const visited = new Set<string>();

		while (queue.length > 0) {
			const { nodeId, path } = queue.shift()!;

			if (nodeId === toNodeId) {
				return path;
			}

			if (visited.has(nodeId)) continue;
			visited.add(nodeId);

			const neighbors = this.graph.getNeighbors(nodeId, 'outgoing');
			for (const neighborId of neighbors) {
				queue.push({
					nodeId: neighborId,
					path: [...path, neighborId]
				});
			}
		}

		return null;
	}

	/**
	 * Get all paths from root to leaves
	 */
	getAllPaths(): string[][] {
		const roots = this.findRootNodes();
		const leaves = this.findLeafNodes();
		const allPaths: string[][] = [];

		for (const root of roots) {
			for (const leaf of leaves) {
				const path = this.findPath(root.id, leaf.id);
				if (path) {
					allPaths.push(path);
				}
			}
		}

		return allPaths;
	}

	/**
	 * Calculate graph depth (longest path from root to leaf)
	 */
	calculateDepth(): number {
		const paths = this.getAllPaths();
		return paths.length > 0 ? Math.max(...paths.map(p => p.length)) - 1 : 0;
	}

	/**
	 * Get nodes at a specific depth level
	 */
	getNodesAtDepth(depth: number): AllCanvasNodeData[] {
		const roots = this.findRootNodes();
		const nodesAtDepth = new Set<string>();

		for (const root of roots) {
			this.traverseToDepth(root.id, depth, 0, nodesAtDepth);
		}

		return Array.from(nodesAtDepth)
			.map(id => this.graph.getNode(id))
			.filter(Boolean) as AllCanvasNodeData[];
	}

	private traverseToDepth(
		nodeId: string,
		targetDepth: number,
		currentDepth: number,
		result: Set<string>
	): void {
		if (currentDepth === targetDepth) {
			result.add(nodeId);
			return;
		}

		const neighbors = this.graph.getNeighbors(nodeId, 'outgoing');
		for (const neighborId of neighbors) {
			this.traverseToDepth(neighborId, targetDepth, currentDepth + 1, result);
		}
	}

	/**
	 * Find all cycles in the graph
	 */
	findCycles(): string[][] {
		const cycles: string[][] = [];
		const visited = new Set<string>();
		const recursionStack = new Set<string>();

		const dfs = (nodeId: string, path: string[]): void => {
			visited.add(nodeId);
			recursionStack.add(nodeId);

			const neighbors = this.graph.getNeighbors(nodeId, 'outgoing');
			for (const neighborId of neighbors) {
				if (!visited.has(neighborId)) {
					dfs(neighborId, [...path, neighborId]);
				} else if (recursionStack.has(neighborId)) {
					// Found a cycle
					const cycleStart = path.indexOf(neighborId);
					if (cycleStart !== -1) {
						cycles.push(path.slice(cycleStart));
					}
				}
			}

			recursionStack.delete(nodeId);
		};

		const allNodes = this.graph.getData().nodes;
		for (const node of allNodes) {
			if (!visited.has(node.id)) {
				dfs(node.id, [node.id]);
			}
		}

		return cycles;
	}

	/**
	 * Get connected components (subgraphs)
	 */
	getConnectedComponents(): AllCanvasNodeData[][] {
		const allNodes = this.graph.getData().nodes;
		const visited = new Set<string>();
		const components: AllCanvasNodeData[][] = [];

		for (const node of allNodes) {
			if (visited.has(node.id)) continue;

			const component = this.graph.traverse(node.id, {
				direction: 'both',
				maxDepth: Infinity
			}).nodes;

			component.forEach(n => visited.add(n.id));
			components.push(component);
		}

		return components;
	}

	/**
	 * Apply color to all nodes in a path
	 */
	colorPath(path: string[], color: string): void {
		const operations = path.map(nodeId => ({
			type: 'updateNode' as const,
			params: { id: nodeId, color }
		}));

		this.ops.executeBatch(operations);
	}

	/**
	 * Apply color to nodes at a specific depth level
	 */
	colorDepthLevel(depth: number, color: string): void {
		const nodes = this.getNodesAtDepth(depth);
		const operations = nodes.map(node => ({
			type: 'updateNode' as const,
			params: { id: node.id, color }
		}));

		this.ops.executeBatch(operations);
	}

	/**
	 * Create a hierarchical layout (tree-like)
	 */
	layoutHierarchical(startX: number = 0, startY: number = 0, spacing: number = 350): void {
		const roots = this.findRootNodes();
		let currentX = startX;

		for (const root of roots) {
			currentX = this.layoutSubtree(root.id, currentX, startY, spacing);
			currentX += spacing;
		}
	}

	private layoutSubtree(nodeId: string, x: number, y: number, spacing: number): number {
		const node = this.graph.getNode(nodeId);
		if (!node) return x;

		// Position current node
		this.ops.updateNode({
			id: nodeId,
			position: { x, y }
		});

		// Get children
		const children = this.graph.getNeighbors(nodeId, 'outgoing');
		if (children.length === 0) {
			return x + node.width;
		}

		// Layout children
		let currentX = x;
		const childY = y + node.height + 100;

		for (const childId of children) {
			currentX = this.layoutSubtree(childId, currentX, childY, spacing);
			currentX += spacing;
		}

		// Center parent over children
		const subtreeWidth = currentX - x - spacing;
		const centerX = x + subtreeWidth / 2;

		this.ops.updateNode({
			id: nodeId,
			position: { x: centerX, y }
		});

		return currentX;
	}

	/**
	 * Create a linear workflow from nodes
	 */
	createLinearWorkflow(nodeIds: string[], direction: 'horizontal' | 'vertical' = 'horizontal'): void {
		const spacing = 350;
		const operations: any[] = [];

		// Position nodes
		for (let i = 0; i < nodeIds.length; i++) {
			const position = direction === 'horizontal'
				? { x: i * spacing, y: 0 }
				: { x: 0, y: i * spacing };

			operations.push({
				type: 'updateNode',
				params: {
					id: nodeIds[i],
					position
				}
			});
		}

		// Connect nodes
		for (let i = 0; i < nodeIds.length - 1; i++) {
			operations.push({
				type: 'createEdge',
				params: {
					fromNode: nodeIds[i],
					toNode: nodeIds[i + 1],
					fromSide: direction === 'horizontal' ? 'right' : 'bottom',
					toSide: direction === 'horizontal' ? 'left' : 'top',
					toEnd: 'arrow'
				}
			});
		}

		this.ops.executeBatch(operations);
	}

	/**
	 * Clone a subgraph starting from a node
	 */
	cloneSubgraph(rootNodeId: string, offsetX: number = 500, offsetY: number = 0): void {
		const { nodes, edges } = this.graph.traverse(rootNodeId, {
			direction: 'outgoing',
			includeEdges: true
		});

		// Map old IDs to new IDs
		const idMap = new Map<string, string>();

		const operations: any[] = [];

		// Clone nodes
		for (const node of nodes) {
			const newId = this.graph.generateId(node.type + '-clone');
			idMap.set(node.id, newId);

			switch (node.type) {
				case 'text':
					operations.push({
						type: 'createTextNode',
						params: {
							text: node.text,
							position: { type: 'absolute', x: node.x + offsetX, y: node.y + offsetY },
							size: { width: node.width, height: node.height },
							color: node.color,
							id: newId
						}
					});
					break;

				case 'file':
					operations.push({
						type: 'createFileNode',
						params: {
							file: node.file,
							subpath: node.subpath,
							position: { type: 'absolute', x: node.x + offsetX, y: node.y + offsetY },
							size: { width: node.width, height: node.height },
							color: node.color,
							id: newId
						}
					});
					break;

				case 'link':
					operations.push({
						type: 'createLinkNode',
						params: {
							url: node.url,
							position: { type: 'absolute', x: node.x + offsetX, y: node.y + offsetY },
							size: { width: node.width, height: node.height },
							color: node.color,
							id: newId
						}
					});
					break;

				case 'group':
					operations.push({
						type: 'createGroupNode',
						params: {
							label: node.label,
							background: node.background,
							backgroundStyle: node.backgroundStyle,
							position: { type: 'absolute', x: node.x + offsetX, y: node.y + offsetY },
							size: { width: node.width, height: node.height },
							color: node.color,
							id: newId
						}
					});
					break;
			}
		}

		// Clone edges (only if both nodes are in the subgraph)
		if (edges) {
			for (const edge of edges) {
				const newFromId = idMap.get(edge.fromNode);
				const newToId = idMap.get(edge.toNode);

				if (newFromId && newToId) {
					operations.push({
						type: 'createEdge',
						params: {
							fromNode: newFromId,
							toNode: newToId,
							fromSide: edge.fromSide,
							toSide: edge.toSide,
							fromEnd: edge.fromEnd,
							toEnd: edge.toEnd,
							color: edge.color,
							label: edge.label
						}
					});
				}
			}
		}

		this.ops.executeBatch(operations);
	}

	/**
	 * Delete a subgraph (node and all descendants)
	 */
	deleteSubgraph(rootNodeId: string): void {
		const { nodes } = this.graph.traverse(rootNodeId, {
			direction: 'outgoing',
			maxDepth: Infinity
		});

		const operations = nodes.map(node => ({
			type: 'deleteNode' as const,
			nodeId: node.id
		}));

		this.ops.executeBatch(operations);
	}

	/**
	 * Get the updated canvas data
	 */
	getCanvasData(): CanvasData {
		return this.ops.getData();
	}
}

/**
 * Example usage
 */
export function exampleUsage() {
	// Sample canvas data
	const canvasData: CanvasData = {
		nodes: [
			{ id: 'root', type: 'text', text: 'Root', x: 0, y: 0, width: 200, height: 100 },
			{ id: 'child1', type: 'text', text: 'Child 1', x: 300, y: 0, width: 200, height: 100 },
			{ id: 'child2', type: 'text', text: 'Child 2', x: 600, y: 0, width: 200, height: 100 },
			{ id: 'grandchild', type: 'text', text: 'Grandchild', x: 450, y: 150, width: 200, height: 100 }
		],
		edges: [
			{ id: 'e1', fromNode: 'root', toNode: 'child1', toEnd: 'arrow' },
			{ id: 'e2', fromNode: 'root', toNode: 'child2', toEnd: 'arrow' },
			{ id: 'e3', fromNode: 'child1', toNode: 'grandchild', toEnd: 'arrow' }
		]
	};

	const walker = new GraphWalker(canvasData);

	// Find structure
	console.log('Root nodes:', walker.findRootNodes());
	console.log('Leaf nodes:', walker.findLeafNodes());
	console.log('Graph depth:', walker.calculateDepth());

	// Find paths
	const path = walker.findPath('root', 'grandchild');
	console.log('Path from root to grandchild:', path);

	// Color path
	if (path) {
		walker.colorPath(path, '2'); // Orange
	}

	// Color depth levels
	walker.colorDepthLevel(0, '1'); // Red for roots
	walker.colorDepthLevel(1, '2'); // Orange for level 1
	walker.colorDepthLevel(2, '3'); // Yellow for level 2

	// Layout hierarchically
	walker.layoutHierarchical(0, 0, 350);

	// Clone subgraph
	walker.cloneSubgraph('root', 1000, 0);

	// Get updated data
	const updatedCanvas = walker.getCanvasData();
	console.log('Updated canvas:', updatedCanvas);

	return updatedCanvas;
}
