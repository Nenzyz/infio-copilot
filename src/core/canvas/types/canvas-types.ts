import type {
	AllCanvasNodeData,
	CanvasData,
	CanvasEdgeData,
	CanvasFileData,
	CanvasTextData,
	CanvasLinkData,
	CanvasGroupData,
	NodeSide,
	EdgeEnd,
	CanvasColor
} from 'obsidian/canvas';

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
	| { ok: true; value: T }
	| { ok: false; error: E };

/**
 * Operation error types
 */
export class CanvasOperationError extends Error {
	constructor(message: string, public code: string) {
		super(message);
		this.name = 'CanvasOperationError';
	}
}

export class NodeNotFoundError extends CanvasOperationError {
	constructor(nodeId: string) {
		super(`Node not found: ${nodeId}`, 'NODE_NOT_FOUND');
	}
}

export class EdgeNotFoundError extends CanvasOperationError {
	constructor(edgeId: string) {
		super(`Edge not found: ${edgeId}`, 'EDGE_NOT_FOUND');
	}
}

export class ValidationError extends CanvasOperationError {
	constructor(message: string) {
		super(message, 'VALIDATION_ERROR');
	}
}

/**
 * Position and size types
 */
export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface BoundingBox {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Relative positioning
 */
export type RelativePosition =
	| { type: 'absolute'; x: number; y: number }
	| { type: 'relative'; nodeId: string; direction: 'above' | 'below' | 'left' | 'right'; offset?: number }
	| { type: 'center'; }
	| { type: 'near'; nodeId: string; };

/**
 * Node creation parameters
 */
export interface CreateTextNodeParams {
	text: string;
	position: RelativePosition;
	size?: Partial<Size>;
	color?: CanvasColor;
	/** Reference ID for use in edges - NOT the actual node ID */
	ref?: string;
}

export interface CreateFileNodeParams {
	file: string;
	subpath?: string;
	position: RelativePosition;
	size?: Partial<Size>;
	color?: CanvasColor;
	/** Reference ID for use in edges - NOT the actual node ID */
	ref?: string;
	/** Advanced Canvas: Set to true to open this canvas file as a portal (embedding its content) */
	portal?: boolean;
}

export interface CreateLinkNodeParams {
	url: string;
	position: RelativePosition;
	size?: Partial<Size>;
	color?: CanvasColor;
	/** Reference ID for use in edges - NOT the actual node ID */
	ref?: string;
}

export interface CreateGroupNodeParams {
	label?: string;
	background?: string;
	backgroundStyle?: 'cover' | 'ratio' | 'repeat';
	position: RelativePosition;
	size?: Partial<Size>;
	color?: CanvasColor;
	/** Reference ID for use in edges - NOT the actual node ID */
	ref?: string;
}

export type CreateNodeParams =
	| CreateTextNodeParams
	| CreateFileNodeParams
	| CreateLinkNodeParams
	| CreateGroupNodeParams;

/**
 * Node update parameters
 */
export interface UpdateNodeParams {
	id: string;
	position?: Partial<Position>;
	size?: Partial<Size>;
	color?: CanvasColor;
	// Type-specific updates
	text?: string;
	file?: string;
	subpath?: string;
	url?: string;
	label?: string;
	background?: string;
	backgroundStyle?: 'cover' | 'ratio' | 'repeat';
}

/**
 * Edge creation parameters
 */
export interface CreateEdgeParams {
	/** Node reference or actual ID - will be resolved from ref map */
	fromNode: string;
	/** Node reference or actual ID - will be resolved from ref map */
	toNode: string;
	fromSide?: NodeSide;
	toSide?: NodeSide;
	fromEnd?: EdgeEnd;
	toEnd?: EdgeEnd;
	color?: CanvasColor;
	label?: string;
}

/**
 * Edge update parameters
 */
export interface UpdateEdgeParams {
	id: string;
	fromNode?: string;
	toNode?: string;
	fromSide?: NodeSide;
	toSide?: NodeSide;
	fromEnd?: EdgeEnd;
	toEnd?: EdgeEnd;
	color?: CanvasColor;
	label?: string;
}

/**
 * Graph query types
 */
export interface NodeQuery {
	id?: string;
	type?: 'text' | 'file' | 'link' | 'group';
	color?: CanvasColor;
	text?: string; // Partial text search
	file?: string; // File path pattern
	inBounds?: BoundingBox;
}

export interface GraphTraversalOptions {
	maxDepth?: number;
	direction?: 'incoming' | 'outgoing' | 'both';
	includeEdges?: boolean;
}

/**
 * Operation result types
 */
export interface NodeOperationResult {
	nodeId: string;
	operation: 'create' | 'update' | 'delete';
	success: boolean;
	error?: string;
}

export interface EdgeOperationResult {
	edgeId: string;
	operation: 'create' | 'update' | 'delete';
	success: boolean;
	error?: string;
}

export interface BatchOperationResult {
	nodes: NodeOperationResult[];
	edges: EdgeOperationResult[];
	canvasData: CanvasData;
}

/**
 * Re-export canvas types
 */
export type {
	AllCanvasNodeData,
	CanvasData,
	CanvasEdgeData,
	CanvasFileData,
	CanvasTextData,
	CanvasLinkData,
	CanvasGroupData,
	NodeSide,
	EdgeEnd,
	CanvasColor
};
