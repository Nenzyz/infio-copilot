import { CanvasGraph } from '../canvas-graph';
import type { CanvasData, AllCanvasNodeData, CanvasEdgeData } from '../types/canvas-types';

describe('CanvasGraph', () => {
	let emptyCanvas: CanvasData;
	let sampleCanvas: CanvasData;

	beforeEach(() => {
		emptyCanvas = {
			nodes: [],
			edges: []
		};

		sampleCanvas = {
			nodes: [
				{
					id: 'node1',
					type: 'text',
					text: 'Node 1',
					x: 0,
					y: 0,
					width: 250,
					height: 150
				},
				{
					id: 'node2',
					type: 'text',
					text: 'Node 2',
					x: 300,
					y: 0,
					width: 250,
					height: 150
				},
				{
					id: 'node3',
					type: 'text',
					text: 'Node 3',
					x: 600,
					y: 0,
					width: 250,
					height: 150
				}
			],
			edges: [
				{
					id: 'edge1',
					fromNode: 'node1',
					toNode: 'node2',
					toEnd: 'arrow'
				},
				{
					id: 'edge2',
					fromNode: 'node2',
					toNode: 'node3',
					toEnd: 'arrow'
				}
			]
		};
	});

	describe('Construction and Basic Operations', () => {
		it('should initialize with empty canvas', () => {
			const graph = new CanvasGraph(emptyCanvas);
			const data = graph.getData();

			expect(data.nodes).toHaveLength(0);
			expect(data.edges).toHaveLength(0);
		});

		it('should initialize with sample canvas', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const data = graph.getData();

			expect(data.nodes).toHaveLength(3);
			expect(data.edges).toHaveLength(2);
		});

		it('should get node by id', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const node = graph.getNode('node1');

			expect(node).toBeDefined();
			expect(node?.id).toBe('node1');
			expect(node?.type).toBe('text');
		});

		it('should get edge by id', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const edge = graph.getEdge('edge1');

			expect(edge).toBeDefined();
			expect(edge?.fromNode).toBe('node1');
			expect(edge?.toNode).toBe('node2');
		});
	});

	describe('Node Queries', () => {
		it('should find nodes by type', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const textNodes = graph.findNodes({ type: 'text' });

			expect(textNodes).toHaveLength(3);
		});

		it('should find nodes by text content', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const nodes = graph.findNodes({ text: 'Node 2' });

			expect(nodes).toHaveLength(1);
			expect(nodes[0].id).toBe('node2');
		});

		it('should find nodes by color', () => {
			const canvasWithColors: CanvasData = {
				nodes: [
					{ id: 'n1', type: 'text', text: 'Red', x: 0, y: 0, width: 100, height: 100, color: '1' },
					{ id: 'n2', type: 'text', text: 'Blue', x: 0, y: 0, width: 100, height: 100, color: '2' },
					{ id: 'n3', type: 'text', text: 'Red', x: 0, y: 0, width: 100, height: 100, color: '1' }
				],
				edges: []
			};

			const graph = new CanvasGraph(canvasWithColors);
			const redNodes = graph.findNodes({ color: '1' });

			expect(redNodes).toHaveLength(2);
		});

		it('should find nodes in bounding box', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const nodesInBox = graph.findNodes({
				inBounds: { x: 0, y: 0, width: 500, height: 200 }
			});

			expect(nodesInBox).toHaveLength(2); // node1 and node2
		});
	});

	describe('Graph Traversal', () => {
		it('should get outgoing neighbors', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const neighbors = graph.getNeighbors('node1', 'outgoing');

			expect(neighbors).toEqual(['node2']);
		});

		it('should get incoming neighbors', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const neighbors = graph.getNeighbors('node2', 'incoming');

			expect(neighbors).toEqual(['node1']);
		});

		it('should get all neighbors (bidirectional)', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const neighbors = graph.getNeighbors('node2', 'both');

			expect(neighbors).toContain('node1');
			expect(neighbors).toContain('node3');
		});

		it('should traverse graph from starting node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const { nodes } = graph.traverse('node1', { direction: 'outgoing' });

			expect(nodes).toHaveLength(3);
			expect(nodes.map(n => n.id)).toEqual(['node1', 'node2', 'node3']);
		});

		it('should respect max depth in traversal', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const { nodes } = graph.traverse('node1', { maxDepth: 1, direction: 'outgoing' });

			expect(nodes).toHaveLength(2); // node1 and node2 only
		});

		it('should include edges in traversal when requested', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const { nodes, edges } = graph.traverse('node1', {
				direction: 'outgoing',
				includeEdges: true
			});

			expect(nodes).toHaveLength(3);
			expect(edges).toHaveLength(2);
		});
	});

	describe('Relative Positioning', () => {
		it('should calculate absolute position', () => {
			const graph = new CanvasGraph(emptyCanvas);
			const pos = graph.calculatePosition({ type: 'absolute', x: 100, y: 200 });

			expect(pos).toEqual({ x: 100, y: 200 });
		});

		it('should calculate center position', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const pos = graph.calculatePosition({ type: 'center' });

			// Average of node positions (0, 300, 600) = 300
			expect(pos.x).toBe(300);
			expect(pos.y).toBe(0);
		});

		it('should calculate position to the right of a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const pos = graph.calculatePosition({
				type: 'relative',
				nodeId: 'node1',
				direction: 'right',
				offset: 50
			});

			// node1.x (0) + node1.width (250) + offset (50) = 300
			expect(pos).toEqual({ x: 300, y: 0 });
		});

		it('should calculate position below a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const pos = graph.calculatePosition({
				type: 'relative',
				nodeId: 'node1',
				direction: 'below',
				offset: 50
			});

			// node1.y (0) + node1.height (150) + offset (50) = 200
			expect(pos).toEqual({ x: 0, y: 200 });
		});

		it('should calculate position to the left of a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const pos = graph.calculatePosition({
				type: 'relative',
				nodeId: 'node2',
				direction: 'left',
				offset: 50
			}, { width: 250, height: 150 });

			// node2.x (300) - width (250) - offset (50) = 0
			expect(pos).toEqual({ x: 0, y: 0 });
		});

		it('should calculate position above a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const pos = graph.calculatePosition({
				type: 'relative',
				nodeId: 'node1',
				direction: 'above',
				offset: 50
			}, { width: 250, height: 150 });

			// node1.y (0) - height (150) - offset (50) = -200
			expect(pos).toEqual({ x: 0, y: -200 });
		});

		it('should throw error for non-existent reference node', () => {
			const graph = new CanvasGraph(sampleCanvas);

			expect(() => {
				graph.calculatePosition({
					type: 'relative',
					nodeId: 'non-existent',
					direction: 'right'
				});
			}).toThrow('Reference node not found');
		});
	});

	describe('Bounding Box Calculation', () => {
		it('should calculate bounding box for multiple nodes', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const bbox = graph.calculateBoundingBox(['node1', 'node2', 'node3']);

			expect(bbox).toEqual({
				x: 0,
				y: 0,
				width: 850, // 600 + 250
				height: 150
			});
		});

		it('should return null for empty node list', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const bbox = graph.calculateBoundingBox([]);

			expect(bbox).toBeNull();
		});

		it('should handle non-existent nodes gracefully', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const bbox = graph.calculateBoundingBox(['node1', 'non-existent']);

			expect(bbox).not.toBeNull();
			expect(bbox?.width).toBe(250);
		});
	});

	describe('Node CRUD Operations', () => {
		it('should add a node', () => {
			const graph = new CanvasGraph(emptyCanvas);
			const newNode: AllCanvasNodeData = {
				id: 'new-node',
				type: 'text',
				text: 'New Node',
				x: 0,
				y: 0,
				width: 200,
				height: 100
			};

			graph.addNode(newNode);
			const node = graph.getNode('new-node');

			expect(node).toBeDefined();
			expect(node?.id).toBe('new-node');
		});

		it('should update a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.updateNode('node1', { x: 100, y: 200, color: '1' });

			expect(success).toBe(true);

			const node = graph.getNode('node1');
			expect(node?.x).toBe(100);
			expect(node?.y).toBe(200);
			expect(node?.color).toBe('1');
		});

		it('should return false when updating non-existent node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.updateNode('non-existent', { x: 100 });

			expect(success).toBe(false);
		});

		it('should remove a node and its edges', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.removeNode('node2');

			expect(success).toBe(true);
			expect(graph.getNode('node2')).toBeUndefined();

			// Both edges connected to node2 should be removed
			expect(graph.getEdge('edge1')).toBeUndefined();
			expect(graph.getEdge('edge2')).toBeUndefined();
		});

		it('should return false when removing non-existent node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.removeNode('non-existent');

			expect(success).toBe(false);
		});
	});

	describe('Edge CRUD Operations', () => {
		it('should add an edge', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const newEdge: CanvasEdgeData = {
				id: 'new-edge',
				fromNode: 'node1',
				toNode: 'node3'
			};

			graph.addEdge(newEdge);
			const edge = graph.getEdge('new-edge');

			expect(edge).toBeDefined();
			expect(edge?.fromNode).toBe('node1');
			expect(edge?.toNode).toBe('node3');
		});

		it('should update an edge', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.updateEdge('edge1', { color: '2', label: 'Updated' });

			expect(success).toBe(true);

			const edge = graph.getEdge('edge1');
			expect(edge?.color).toBe('2');
			expect(edge?.label).toBe('Updated');
		});

		it('should handle edge node updates correctly', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.updateEdge('edge1', { toNode: 'node3' });

			expect(success).toBe(true);

			const edge = graph.getEdge('edge1');
			expect(edge?.toNode).toBe('node3');

			// Check adjacency lists updated
			const neighbors = graph.getNeighbors('node1', 'outgoing');
			expect(neighbors).toContain('node3');
		});

		it('should return false when updating non-existent edge', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.updateEdge('non-existent', { color: '1' });

			expect(success).toBe(false);
		});

		it('should remove an edge', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.removeEdge('edge1');

			expect(success).toBe(true);
			expect(graph.getEdge('edge1')).toBeUndefined();

			// Check adjacency updated
			const neighbors = graph.getNeighbors('node1', 'outgoing');
			expect(neighbors).not.toContain('node2');
		});

		it('should return false when removing non-existent edge', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const success = graph.removeEdge('non-existent');

			expect(success).toBe(false);
		});
	});

	describe('Connected Edges', () => {
		it('should get all edges connected to a node', () => {
			const graph = new CanvasGraph(sampleCanvas);
			const edges = graph.getConnectedEdges('node2');

			expect(edges).toHaveLength(2);
			expect(edges.map(e => e.id)).toContain('edge1');
			expect(edges.map(e => e.id)).toContain('edge2');
		});

		it('should return empty array for node with no edges', () => {
			const graph = new CanvasGraph({
				nodes: [{ id: 'lone-node', type: 'text', text: '', x: 0, y: 0, width: 100, height: 100 }],
				edges: []
			});

			const edges = graph.getConnectedEdges('lone-node');
			expect(edges).toHaveLength(0);
		});
	});

	describe('ID Generation', () => {
		it('should generate unique IDs', () => {
			const graph = new CanvasGraph(emptyCanvas);
			const id1 = graph.generateId('node');
			const id2 = graph.generateId('node');

			expect(id1).not.toBe(id2);
			expect(id1).toMatch(/^node-\d+-[a-z0-9]+$/);
		});

		it('should support custom prefixes', () => {
			const graph = new CanvasGraph(emptyCanvas);
			const id = graph.generateId('custom');

			expect(id).toMatch(/^custom-/);
		});
	});
});
