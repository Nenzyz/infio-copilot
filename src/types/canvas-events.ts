import type { ManageCanvasToolArgs } from './apply';

/**
 * Event data for requesting canvas operations
 */
export interface CanvasOperationRequest {
	/** Unique ID for this request to match with response */
	requestId: string;
	/** Path to the canvas file */
	canvasPath: string;
	/** Operations to perform */
	operations: ManageCanvasToolArgs['operations'];
}

/**
 * Event data for canvas operation response
 */
export interface CanvasOperationResponse {
	/** Request ID this response corresponds to */
	requestId: string;
	/** Whether operations succeeded */
	success: boolean;
	/** Result messages from operations */
	results: string[];
	/** Error message if failed */
	error?: string;
}

/**
 * Custom event names for canvas operations
 */
export const CANVAS_OPERATION_REQUEST_EVENT = 'infio-canvas-operation-request';
export const CANVAS_OPERATION_RESPONSE_EVENT = 'infio-canvas-operation-response';
