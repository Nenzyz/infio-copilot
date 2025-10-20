import { App } from 'obsidian';
import type { Canvas, CanvasNode, Position } from '../types/canvas-api';
import type { CanvasOperationRequest, CanvasOperationResponse } from '../types/canvas-events';
import { CANVAS_OPERATION_REQUEST_EVENT, CANVAS_OPERATION_RESPONSE_EVENT } from '../types/canvas-events';
import type { ManageCanvasToolArgs } from '../types/apply';
import { CanvasAdapter } from '../core/canvas/canvas-adapter';

/**
 * Canvas Operation Handler
 * Runs in the canvas view context and executes operations on the canvas
 */
export class CanvasOperationHandler {
	private app: App;
	private canvas: Canvas;
	private canvasPath: string;
	private boundHandler?: (request: CanvasOperationRequest) => void;

	constructor(app: App, canvas: Canvas, canvasPath: string) {
		this.app = app;
		this.canvas = canvas;
		this.canvasPath = canvasPath;
	}

	/**
	 * Register event listener for canvas operation requests
	 */
	register(): void {
		this.boundHandler = this.handleRequest.bind(this);
		(this.app.workspace as any).on(
			CANVAS_OPERATION_REQUEST_EVENT,
			this.boundHandler
		);
	}

	/**
	 * Unregister event listener
	 */
	unregister(): void {
		if (this.boundHandler) {
			(this.app.workspace as any).off(
				CANVAS_OPERATION_REQUEST_EVENT,
				this.boundHandler
			);
		}
	}

	/**
	 * Handle canvas operation request
	 */
	private handleRequest(request: CanvasOperationRequest): void {
		// Only handle requests for this canvas
		if (request.canvasPath !== this.canvasPath) {
			return;
		}


		// Execute operations
		this.executeOperations(request)
			.then(response => {
				// Send response back
				(this.app.workspace as any).trigger(CANVAS_OPERATION_RESPONSE_EVENT, response);
			})
			.catch(error => {
				const errorResponse: CanvasOperationResponse = {
					requestId: request.requestId,
					success: false,
					results: [],
					error: error instanceof Error ? error.message : String(error)
				};
				(this.app.workspace as any).trigger(CANVAS_OPERATION_RESPONSE_EVENT, errorResponse);
			});
	}

	/**
	 * Execute canvas operations using the CanvasAdapter
	 */
	private async executeOperations(request: CanvasOperationRequest): Promise<CanvasOperationResponse> {

		try {
			// Create adapter instance
			const adapter = new CanvasAdapter(this.canvas);

			// Execute operations through adapter (handles transformation and two-phase execution)
			const result = await adapter.executeOperations(request.operations as any[]);


			// Return response
			return {
				requestId: request.requestId,
				success: result.success,
				results: result.results,
				...(result.error && { error: result.error })
			};
		} catch (error) {
			return {
				requestId: request.requestId,
				success: false,
				results: [],
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	/**
	 * LEGACY: Old operation execution method (kept for reference, can be removed)
	 */
	private async executeOperationsLegacy(request: CanvasOperationRequest): Promise<CanvasOperationResponse> {
		const results: string[] = [];
		const operations = request.operations;


		// Track ID mappings: AI's placeholder IDs -> actual generated node IDs
		const idMap = new Map<string, string>();

		try {
			// Process each operation
			for (const operation of operations) {

				switch (operation.action) {
					case 'add_node': {
					try {
						// Handle both flat and nested node_data/node structures
						let nodeData: any = operation;
						if (operation.node_data) {
							nodeData = { ...operation, ...operation.node_data };
						} else if (operation.node) {
							nodeData = { ...operation, ...operation.node };
						}

						// Normalize field names that AI commonly gets wrong
						if (nodeData.type && !nodeData.node_type) {
							nodeData.node_type = nodeData.type;
						}
						if (nodeData.content && !nodeData.text) {
							nodeData.text = nodeData.content;
						}
						if (nodeData.pos && Array.isArray(nodeData.pos)) {
							nodeData.x = nodeData.pos[0];
							nodeData.y = nodeData.pos[1];
						}
						if (nodeData.size && Array.isArray(nodeData.size)) {
							nodeData.width = nodeData.size[0];
							nodeData.height = nodeData.size[1];
						}

						// Validate node_type is present
						if (!nodeData.node_type) {
							const providedFields = Object.keys(operation).join(', ');
							results.push(`❌ add_node operation missing required 'node_type' field. Must be one of: "text", "file", "link", "group". Provided fields: ${providedFields}`);
							continue;
						}

							const pos: Position = {
								x: nodeData.x || 0,
								y: nodeData.y || 0
							};
							const size = {
								width: nodeData.width || 250,
								height: nodeData.height || (nodeData.node_type === 'file' ? 400 : 60)
							};

							let node: CanvasNode | null = null;


							// Create node based on type using Canvas API
							switch (nodeData.node_type) {
							case 'text':
								try {
									// Pass text directly to createTextNode (matching advanced-canvas pattern)
									node = this.canvas.createTextNode({
										pos,
										size,
										text: nodeData.text || ''
									});
								} catch (createError) {
									// Some plugins wrap createTextNode and may throw errors even when node is created
									// Check if node was actually created despite the error
									const nodes = this.canvas.nodes;
									const lastNode = nodes.size > 0 ? Array.from(nodes.values()).pop() : null;
									if (lastNode && lastNode.getData().type === 'text') {
										node = lastNode;
									} else {
										throw createError; // Re-throw if node wasn't actually created
									}
								}
								break;

								case 'file':
									if (!nodeData.file) {
										results.push(`❌ File node requires 'file' parameter`);
										continue;
									}
									node = this.canvas.createFileNode({
										pos,
										size,
										file: nodeData.file
									});
									// Handle subpath if provided
									if (node && nodeData.subpath) {
										const fileNodeData = node.getData();
										if (fileNodeData.type === 'file') {
											fileNodeData.subpath = nodeData.subpath;
											node.setData(fileNodeData);
										}
									}
									break;

								case 'link':
									if (!nodeData.url) {
										results.push(`❌ Link node requires 'url' parameter`);
										continue;
									}
									node = this.canvas.createLinkNode({
										pos,
										size,
										url: nodeData.url
									});
									break;

								case 'group':
									node = this.canvas.createGroupNode({ pos, size });
									// Handle group-specific properties
									if (node) {
										const groupNodeData = node.getData();
										if (groupNodeData.type === 'group') {
											if (nodeData.label) groupNodeData.label = nodeData.label;
											if (nodeData.background) groupNodeData.background = nodeData.background;
											if (nodeData.background_style) groupNodeData.backgroundStyle = nodeData.background_style;
											node.setData(groupNodeData);
										}
									}
									break;

								default:
									results.push(`❌ Unknown node type: ${nodeData.node_type}`);
									continue;
							}

							if (node) {
								// Set color if provided
								if (nodeData.color) {
									const colorNodeData = node.getData();
									colorNodeData.color = nodeData.color;
									node.setData(colorNodeData);
								}

								// Map placeholder ID to actual ID
								if (nodeData.id) {
									idMap.set(nodeData.id, node.id);
								}

								results.push(`✅ Added ${nodeData.node_type} node: ${node.id}${nodeData.id ? ` (placeholder: ${nodeData.id})` : ''}`);
							}
						} catch (error) {
							const stack = error instanceof Error && error.stack ? error.stack : '';
					results.push(`❌ Failed to create node: ${error instanceof Error ? error.message : String(error)}\nStack: ${stack}`);
						}
						break;
					}

					case 'update_node': {
						if (!operation.id) {
							results.push(`❌ update_node requires node id`);
							break;
						}

						const node = this.canvas.nodes.get(operation.id);
						if (!node) {
							results.push(`❌ Node not found: ${operation.id}`);
							break;
						}

						try {
							const nodeData = node.getData();

							// Update position and size
							if (operation.x !== undefined) node.x = operation.x;
							if (operation.y !== undefined) node.y = operation.y;
							if (operation.width !== undefined) node.width = operation.width;
							if (operation.height !== undefined) node.height = operation.height;

							// Update type-specific properties
							if (operation.color !== undefined) nodeData.color = operation.color;
							if (operation.text !== undefined && nodeData.type === 'text') nodeData.text = operation.text;
							if (operation.file !== undefined && nodeData.type === 'file') nodeData.file = operation.file;
							if (operation.subpath !== undefined && nodeData.type === 'file') nodeData.subpath = operation.subpath;
							if (operation.url !== undefined && nodeData.type === 'link') nodeData.url = operation.url;
							if (nodeData.type === 'group') {
								if (operation.label !== undefined) nodeData.label = operation.label;
								if (operation.background !== undefined) nodeData.background = operation.background;
								if (operation.background_style !== undefined) nodeData.backgroundStyle = operation.background_style;
							}

							node.setData(nodeData);
							results.push(`✅ Updated node: ${operation.id}`);
						} catch (error) {
							results.push(`❌ Failed to update node: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					}

					case 'remove_node': {
						if (!operation.id) {
							results.push(`❌ remove_node requires node id`);
							break;
						}

						const node = this.canvas.nodes.get(operation.id);
						if (!node) {
							results.push(`❌ Node not found: ${operation.id}`);
							break;
						}

						try {
							this.canvas.removeNode(node);
							results.push(`✅ Removed node and connected edges: ${operation.id}`);
						} catch (error) {
							results.push(`❌ Failed to remove node: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					}

					case 'add_edge': {
						// Flatten nested edge structures
						let edgeData: any = operation;
						if (operation.edge_data) {
							edgeData = { ...operation, ...operation.edge_data };
						} else if (operation.edge) {
							edgeData = { ...operation, ...operation.edge };
						}

						// Normalize field names
						if (edgeData.from && !edgeData.from_node) {
							edgeData.from_node = edgeData.from;
						}
						if (edgeData.to && !edgeData.to_node) {
							edgeData.to_node = edgeData.to;
						}

						// Resolve node IDs: use mapped IDs if available, otherwise use as-is
						const fromNodeId = edgeData.from_node ? (idMap.get(edgeData.from_node) || edgeData.from_node) : '';
						const toNodeId = edgeData.to_node ? (idMap.get(edgeData.to_node) || edgeData.to_node) : '';


						if (!fromNodeId || !toNodeId) {
							results.push(`❌ add_edge requires both from_node and to_node`);
							break;
						}

						// Verify nodes exist
						const fromNode = this.canvas.nodes.get(fromNodeId);
						const toNode = this.canvas.nodes.get(toNodeId);

						if (!fromNode) {
							results.push(`❌ Source node not found: ${edgeData.from_node} (resolved to: ${fromNodeId})`);
							break;
						}
						if (!toNode) {
							results.push(`❌ Target node not found: ${edgeData.to_node} (resolved to: ${toNodeId})`);
							break;
						}

						try {
							// Create edge using Canvas API
							const canvasData = this.canvas.getData();
							// Use underscore separator to avoid conflict with Advanced Canvas portal IDs (which use dashes)
							const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

							const newEdge: any = {
								id: edgeId,
								fromNode: fromNodeId,
								toNode: toNodeId
							};

							if (edgeData.from_side) newEdge.fromSide = edgeData.from_side;
							if (edgeData.to_side) newEdge.toSide = edgeData.to_side;
							if (edgeData.from_end) newEdge.fromEnd = edgeData.from_end;
							if (edgeData.to_end) newEdge.toEnd = edgeData.to_end;
							if (edgeData.color) newEdge.color = edgeData.color;
							if (edgeData.label) newEdge.label = edgeData.label;

							canvasData.edges.push(newEdge);
							this.canvas.setData(canvasData);

							results.push(`✅ Added edge: ${fromNodeId} → ${toNodeId}`);
						} catch (error) {
							results.push(`❌ Failed to create edge: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					}

					case 'update_edge': {
						if (!operation.id) {
							results.push(`❌ update_edge requires edge id`);
							break;
						}

						const edge = this.canvas.edges.get(operation.id);
						if (!edge) {
							results.push(`❌ Edge not found: ${operation.id}`);
							break;
						}

						try {
							const edgeData = edge.getData();

							if (operation.from_node !== undefined) edgeData.fromNode = operation.from_node;
							if (operation.to_node !== undefined) edgeData.toNode = operation.to_node;
							if (operation.from_side !== undefined) edgeData.fromSide = operation.from_side;
							if (operation.to_side !== undefined) edgeData.toSide = operation.to_side;
							if (operation.from_end !== undefined) edgeData.fromEnd = operation.from_end;
							if (operation.to_end !== undefined) edgeData.toEnd = operation.to_end;
							if (operation.color !== undefined) edgeData.color = operation.color;
							if (operation.label !== undefined) edgeData.label = operation.label;

							edge.setData(edgeData);
							results.push(`✅ Updated edge: ${operation.id}`);
						} catch (error) {
							results.push(`❌ Failed to update edge: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					}

					case 'remove_edge': {
						if (!operation.id) {
							results.push(`❌ remove_edge requires edge id`);
							break;
						}

						const edge = this.canvas.edges.get(operation.id);
						if (!edge) {
							results.push(`❌ Edge not found: ${operation.id}`);
							break;
						}

						try {
							this.canvas.removeEdge(edge);
							results.push(`✅ Removed edge: ${operation.id}`);
						} catch (error) {
							results.push(`❌ Failed to remove edge: ${error instanceof Error ? error.message : String(error)}`);
						}
						break;
					}

					default:
						results.push(`❌ Unknown operation: ${(operation as any).action}`);
				}
			}

			// Save the canvas
			this.canvas.requestSave();
			results.push(`✅ Canvas operations completed successfully`);

			return {
				requestId: request.requestId,
				success: true,
				results
			};
		} catch (error) {
			return {
				requestId: request.requestId,
				success: false,
				results: [...results],
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}
}
