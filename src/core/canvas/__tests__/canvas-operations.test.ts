import { CanvasOperations } from '../canvas-operations';
import type { CanvasData } from '../types/canvas-types';

describe('CanvasOperations', () => {
	let emptyCanvas: CanvasData;
	let operations: CanvasOperations;

	beforeEach(() => {
		emptyCanvas = {
			nodes: [],
			edges: []
		};
		operations = new CanvasOperations(emptyCanvas);
	});

	describe('Text Node Operations', () => {
		it('should create a text node with absolute position', () => {
			const result = operations.createTextNode({
				text: 'Hello World',
				position: { type: 'absolute', x: 100, y: 200 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.success).toBe(true);
				expect(result.value.operation).toBe('create');

				const data = operations.getData();
				expect(data.nodes).toHaveLength(1);

				const node = data.nodes[0];
				expect(node.type).toBe('text');
				expect(node.x).toBe(100);
				expect(node.y).toBe(200);
				if (node.type === 'text') {
					expect(node.text).toBe('Hello World');
				}
			}
		});

		it('should create a text node with custom size and color', () => {
			const result = operations.createTextNode({
				text: 'Styled Text',
				position: { type: 'absolute', x: 0, y: 0 },
				size: { width: 300, height: 200 },
				color: '2'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.width).toBe(300);
				expect(node.height).toBe(200);
				expect(node.color).toBe('2');
			}
		});

		it('should create a text node with reference ID', () => {
			const result = operations.createTextNode({
				text: 'With Ref',
				position: { type: 'absolute', x: 0, y: 0 },
				ref: 'my-ref'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				// Should generate actual ID, not use ref
				expect(result.value.nodeId).not.toBe('my-ref');
				expect(result.value.nodeId).toMatch(/^text-node-/);
			}
		});
	});

	describe('File Node Operations', () => {
		it('should create a file node', () => {
			const result = operations.createFileNode({
				file: 'notes/meeting.md',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.type).toBe('file');
				if (node.type === 'file') {
					expect(node.file).toBe('notes/meeting.md');
				}
			}
		});

		it('should create a file node with subpath', () => {
			const result = operations.createFileNode({
				file: 'notes/meeting.md',
				subpath: '#Summary',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				if (node.type === 'file') {
					expect(node.subpath).toBe('#Summary');
				}
			}
		});

		it('should use default size for file nodes', () => {
			const result = operations.createFileNode({
				file: 'test.md',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.width).toBe(400);
				expect(node.height).toBe(400);
			}
		});
	});

	describe('Link Node Operations', () => {
		it('should create a link node', () => {
			const result = operations.createLinkNode({
				url: 'https://example.com',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.type).toBe('link');
				if (node.type === 'link') {
					expect(node.url).toBe('https://example.com');
				}
			}
		});

		it('should use default size for link nodes', () => {
			const result = operations.createLinkNode({
				url: 'https://example.com',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.width).toBe(300);
				expect(node.height).toBe(100);
			}
		});
	});

	describe('Group Node Operations', () => {
		it('should create a group node', () => {
			const result = operations.createGroupNode({
				label: 'Phase 1',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.type).toBe('group');
				if (node.type === 'group') {
					expect(node.label).toBe('Phase 1');
				}
			}
		});

		it('should create a group with background', () => {
			const result = operations.createGroupNode({
				label: 'Group',
				background: 'images/background.png',
				backgroundStyle: 'cover',
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				if (node.type === 'group') {
					expect(node.background).toBe('images/background.png');
					expect(node.backgroundStyle).toBe('cover');
				}
			}
		});

		it('should use default size for group nodes', () => {
			const result = operations.createGroupNode({
				position: { type: 'absolute', x: 0, y: 0 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[0];

				expect(node.width).toBe(600);
				expect(node.height).toBe(400);
			}
		});
	});

	describe('Relative Positioning', () => {
		let refNodeId: string;

		beforeEach(() => {
			// Create a reference node and get its actual ID
			const result = operations.createTextNode({
				text: 'Reference',
				position: { type: 'absolute', x: 100, y: 100 },
				size: { width: 200, height: 100 },
				ref: 'ref-node'
			});

			if (result.ok) {
				refNodeId = result.value.nodeId;
			}
		});

		it('should position node to the right of reference', () => {
			const result = operations.createTextNode({
				text: 'Right Node',
				position: { type: 'relative', nodeId: refNodeId, direction: 'right', offset: 50 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[1]; // Second node

				// 100 + 200 + 50 = 350
				expect(node.x).toBe(350);
				expect(node.y).toBe(100);
			}
		});

		it('should position node below reference', () => {
			const result = operations.createTextNode({
				text: 'Below Node',
				position: { type: 'relative', nodeId: refNodeId, direction: 'below', offset: 30 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[1];

				expect(node.x).toBe(100);
				// 100 + 100 + 30 = 230
				expect(node.y).toBe(230);
			}
		});

		it('should position node at center', () => {
			// Add more nodes to test centering
			operations.createTextNode({
				text: 'Node 2',
				position: { type: 'absolute', x: 400, y: 100 },
				ref: 'node2'
			});

			const result = operations.createTextNode({
				text: 'Center Node',
				position: { type: 'center' }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const node = data.nodes[2];

				// Average of 100 and 400 = 250
				expect(node.x).toBe(250);
			}
		});

		it('should fail with non-existent reference node', () => {
			const result = operations.createTextNode({
				text: 'Orphan',
				position: { type: 'relative', nodeId: 'non-existent', direction: 'right' }
			});

			expect(result.ok).toBe(false);
		});
	});

	describe('Update Node Operations', () => {
		let testNodeId: string;

		beforeEach(() => {
			const result = operations.createTextNode({
				text: 'Original',
				position: { type: 'absolute', x: 0, y: 0 },
				ref: 'update-test'
			});
			if (result.ok) {
				testNodeId = result.value.nodeId;
			}
		});

		it('should update node position', () => {
			const result = operations.updateNode({
				id: testNodeId,
				position: { x: 100, y: 200 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const node = operations.getGraph().getNode(testNodeId);
				expect(node?.x).toBe(100);
				expect(node?.y).toBe(200);
			}
		});

		it('should update node size', () => {
			const result = operations.updateNode({
				id: testNodeId,
				size: { width: 500, height: 300 }
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const node = operations.getGraph().getNode(testNodeId);
				expect(node?.width).toBe(500);
				expect(node?.height).toBe(300);
			}
		});

		it('should update text content', () => {
			const result = operations.updateNode({
				id: testNodeId,
				text: 'Updated Text'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const node = operations.getGraph().getNode(testNodeId);
				if (node?.type === 'text') {
					expect(node.text).toBe('Updated Text');
				}
			}
		});

		it('should update color', () => {
			const result = operations.updateNode({
				id: testNodeId,
				color: '3'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const node = operations.getGraph().getNode(testNodeId);
				expect(node?.color).toBe('3');
			}
		});

		it('should fail for non-existent node', () => {
			const result = operations.updateNode({
				id: 'non-existent',
				color: '1'
			});

			expect(result.ok).toBe(false);
		});
	});

	describe('Delete Node Operations', () => {
		let testNodeId: string;

		beforeEach(() => {
			const result = operations.createTextNode({
				text: 'To Delete',
				position: { type: 'absolute', x: 0, y: 0 },
				ref: 'delete-test'
			});
			if (result.ok) {
				testNodeId = result.value.nodeId;
			}
		});

		it('should delete a node', () => {
			const result = operations.deleteNode(testNodeId);

			expect(result.ok).toBe(true);
			if (result.ok) {
				expect(result.value.success).toBe(true);
				const data = operations.getData();
				expect(data.nodes).toHaveLength(0);
			}
		});

		it('should fail for non-existent node', () => {
			const result = operations.deleteNode('non-existent');

			expect(result.ok).toBe(false);
		});
	});

	describe('Edge Operations', () => {
		let node1Id: string;
		let node2Id: string;

		beforeEach(() => {
			const result1 = operations.createTextNode({
				text: 'Node 1',
				position: { type: 'absolute', x: 0, y: 0 },
				ref: 'node1'
			});
			if (result1.ok) {
				node1Id = result1.value.nodeId;
			}

			const result2 = operations.createTextNode({
				text: 'Node 2',
				position: { type: 'absolute', x: 300, y: 0 },
				ref: 'node2'
			});
			if (result2.ok) {
				node2Id = result2.value.nodeId;
			}
		});

		it('should create an edge', () => {
			const result = operations.createEdge({
				fromNode: 'node1',  // Using ref - will be resolved
				toNode: 'node2',    // Using ref - will be resolved
				toEnd: 'arrow'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				expect(data.edges).toHaveLength(1);

				const edge = data.edges[0];
				expect(edge.fromNode).toBe(node1Id);  // Resolved to actual ID
				expect(edge.toNode).toBe(node2Id);    // Resolved to actual ID
				expect(edge.toEnd).toBe('arrow');
			}
		});

		it('should create an edge with label and color', () => {
			const result = operations.createEdge({
				fromNode: 'node1',  // Using ref
				toNode: 'node2',    // Using ref
				label: 'connects to',
				color: '2',
				fromSide: 'right',
				toSide: 'left'
			});

			expect(result.ok).toBe(true);
			if (result.ok) {
				const data = operations.getData();
				const edge = data.edges[0];

				expect(edge.label).toBe('connects to');
				expect(edge.color).toBe('2');
				expect(edge.fromSide).toBe('right');
				expect(edge.toSide).toBe('left');
			}
		});

		it('should fail to create edge with non-existent source node', () => {
			const result = operations.createEdge({
				fromNode: 'non-existent',
				toNode: 'node2'
			});

			expect(result.ok).toBe(false);
		});

		it('should fail to create edge with non-existent target node', () => {
			const result = operations.createEdge({
				fromNode: 'node1',
				toNode: 'non-existent'
			});

			expect(result.ok).toBe(false);
		});

		it('should update an edge', () => {
			const createResult = operations.createEdge({
				fromNode: 'node1',
				toNode: 'node2'
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const edgeId = createResult.value.edgeId;

				const updateResult = operations.updateEdge({
					id: edgeId,
					label: 'Updated Label',
					color: '3'
				});

				expect(updateResult.ok).toBe(true);
				if (updateResult.ok) {
					const edge = operations.getGraph().getEdge(edgeId);
					expect(edge?.label).toBe('Updated Label');
					expect(edge?.color).toBe('3');
				}
			}
		});

		it('should delete an edge', () => {
			const createResult = operations.createEdge({
				fromNode: 'node1',
				toNode: 'node2'
			});

			expect(createResult.ok).toBe(true);

			if (createResult.ok) {
				const edgeId = createResult.value.edgeId;

				const result = operations.deleteEdge(edgeId);

				expect(result.ok).toBe(true);
				if (result.ok) {
					const data = operations.getData();
					expect(data.edges).toHaveLength(0);
				}
			}
		});
	});

	describe('Batch Operations', () => {
		it('should execute multiple node operations in batch', () => {
			const result = operations.executeBatch([
				{
					type: 'createTextNode',
					params: {
						text: 'Node 1',
						position: { type: 'absolute', x: 0, y: 0 },
						ref: 'n1'
					}
				},
				{
					type: 'createTextNode',
					params: {
						text: 'Node 2',
						position: { type: 'relative', nodeId: 'n1', direction: 'right' },
						ref: 'n2'
					}
				},
				{
					type: 'createTextNode',
					params: {
						text: 'Node 3',
						position: { type: 'relative', nodeId: 'n2', direction: 'right' },
						ref: 'n3'
					}
				}
			]);

			expect(result.nodes).toHaveLength(3);
			expect(result.nodes.every(n => n.success)).toBe(true);
			expect(result.canvasData.nodes).toHaveLength(3);
		});

		it('should create nodes and edges in batch', () => {
			const result = operations.executeBatch([
				{
					type: 'createTextNode',
					params: {
						text: 'Start',
						position: { type: 'absolute', x: 0, y: 0 },
						ref: 'start'
					}
				},
				{
					type: 'createTextNode',
					params: {
						text: 'End',
						position: { type: 'absolute', x: 300, y: 0 },
						ref: 'end'
					}
				},
				{
					type: 'createEdge',
					params: {
						fromNode: 'start',
						toNode: 'end',
						toEnd: 'arrow'
					}
				}
			]);

			expect(result.nodes).toHaveLength(2);
			expect(result.edges).toHaveLength(1);
			expect(result.nodes.every(n => n.success)).toBe(true);
			expect(result.edges.every(e => e.success)).toBe(true);
		});

		it('should continue batch on partial failures', () => {
			const result = operations.executeBatch([
				{
					type: 'createTextNode',
					params: {
						text: 'Valid Node',
						position: { type: 'absolute', x: 0, y: 0 },
						ref: 'valid'
					}
				},
				{
					type: 'createEdge',
					params: {
						fromNode: 'non-existent',
						toNode: 'valid'
					}
				},
				{
					type: 'updateNode',
					params: {
						id: 'valid',  // This ref will be resolved to actual ID
						color: '2'
					}
				}
			]);

			expect(result.nodes).toHaveLength(2); // create + update
			expect(result.edges).toHaveLength(1);
			expect(result.nodes[0].success).toBe(true);
			expect(result.edges[0].success).toBe(false);
			expect(result.nodes[1].success).toBe(true);
		});

		it('should handle complex workflow', () => {
			const result = operations.executeBatch([
				// Create group
				{
					type: 'createGroupNode',
					params: {
						label: 'Process',
						position: { type: 'absolute', x: -50, y: -50 },
						size: { width: 800, height: 300 },
						ref: 'group1'
					}
				},
				// Create nodes inside group
				{
					type: 'createTextNode',
					params: {
						text: 'Step 1',
						position: { type: 'absolute', x: 0, y: 0 },
						ref: 'step1'
					}
				},
				{
					type: 'createTextNode',
					params: {
						text: 'Step 2',
						position: { type: 'relative', nodeId: 'step1', direction: 'right' },
						ref: 'step2'
					}
				},
				{
					type: 'createTextNode',
					params: {
						text: 'Step 3',
						position: { type: 'relative', nodeId: 'step2', direction: 'right' },
						ref: 'step3'
					}
				},
				// Connect steps
				{
					type: 'createEdge',
					params: {
						fromNode: 'step1',
						toNode: 'step2',
						toEnd: 'arrow'
					}
				},
				{
					type: 'createEdge',
					params: {
						fromNode: 'step2',
						toNode: 'step3',
						toEnd: 'arrow'
					}
				}
			]);

			expect(result.nodes.length).toBe(4); // 1 group + 3 text
			expect(result.edges.length).toBe(2);
			expect(result.nodes.every(n => n.success)).toBe(true);
			expect(result.edges.every(e => e.success)).toBe(true);
		});
	});
});
