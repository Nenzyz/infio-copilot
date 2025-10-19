import { ItemView, TFile } from 'obsidian';
import { AllCanvasNodeData, CanvasData, CanvasEdgeData } from 'obsidian/canvas';

export interface Position {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export interface BBox {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export interface CanvasNode {
	id: string;
	x: number;
	y: number;
	width: number;
	height: number;
	color?: string;

	getData(): AllCanvasNodeData;
	setData(data: AllCanvasNodeData): void;
}

export interface CanvasEdge {
	id: string;

	getData(): CanvasEdgeData;
	setData(data: CanvasEdgeData): void;
}

export interface Canvas {
	nodes: Map<string, CanvasNode>;
	edges: Map<string, CanvasEdge>;

	getData(): CanvasData;
	setData(data: CanvasData): void;

	createTextNode(options: { pos: Position; size?: Size; text?: string }): CanvasNode;
	createFileNode(options: { pos: Position; size?: Size; file: TFile | string }): CanvasNode;
	createLinkNode(options: { pos: Position; size?: Size; url: string }): CanvasNode;
	createGroupNode(options: { pos: Position; size?: Size; label?: string }): CanvasNode;

	addNode(node: CanvasNode): void;
	removeNode(node: CanvasNode): void;
	addEdge(edge: CanvasEdge): void;
	removeEdge(edge: CanvasEdge): void;

	requestSave(): void;
}

export interface CanvasView extends ItemView {
	canvas: Canvas;
	file: TFile;
}
