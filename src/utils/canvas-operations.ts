import { App } from 'obsidian';
import type { ManageCanvasToolArgs } from '../types/apply';
import type { CanvasOperationRequest, CanvasOperationResponse } from '../types/canvas-events';
import { CANVAS_OPERATION_REQUEST_EVENT, CANVAS_OPERATION_RESPONSE_EVENT } from '../types/canvas-events';
import { v4 as uuidv4 } from 'uuid';

export interface CanvasOperationResult {
	success: boolean;
	results: string[];
}

/**
 * Execute canvas operations using event-based communication
 * Sends a request to the canvas view and waits for a response
 */
export async function executeCanvasOperationsWithAPI(
	app: App,
	canvasPath: string,
	operations: ManageCanvasToolArgs['operations']
): Promise<CanvasOperationResult> {

	// Handle case where AI puts path inside operations instead of top level
	if ((!canvasPath || canvasPath.trim() === '') && operations.length > 0) {
		const firstOp: any = operations[0];
		if (firstOp.path) {
			canvasPath = firstOp.path;
			// Remove path from all operations
			operations = operations.map((op: any) => {
				const {path, ...rest} = op;
				return rest;
			});
		}
	}


	// Generate unique request ID
	const requestId = uuidv4();

	// Create the request
	const request: CanvasOperationRequest = {
		requestId,
		canvasPath,
		operations
	};

	// Create a promise that will be resolved when we get a response
	return new Promise((resolve) => {
		// Set up one-time listener for response
		const responseHandler = (response: CanvasOperationResponse) => {
			// Only handle our response
			if (response.requestId !== requestId) {
				return;
			}


			// Clean up listener
			(app.workspace as any).off(CANVAS_OPERATION_RESPONSE_EVENT, responseHandler);

			// Clear timeout
			clearTimeout(timeout);

			// Resolve with result
			if (response.success) {
				resolve({
					success: true,
					results: response.results
				});
			} else {
				resolve({
					success: false,
					results: response.error ? [`❌ ${response.error}`, ...response.results] : response.results
				});
			}
		};

		// Register response listener
		(app.workspace as any).on(CANVAS_OPERATION_RESPONSE_EVENT, responseHandler);

		// Set timeout in case canvas doesn't respond
		const timeout = setTimeout(() => {
			(app.workspace as any).off(CANVAS_OPERATION_RESPONSE_EVENT, responseHandler);
			resolve({
				success: false,
				results: [`❌ Timeout: Canvas did not respond. Make sure the canvas file is open: ${canvasPath}`]
			});
		}, 10000); // 10 second timeout

		// Send the request
		(app.workspace as any).trigger(CANVAS_OPERATION_REQUEST_EVENT, request);
	});
}
