/**
 * 用于指定插入内容的工具参数
 */

export enum ApplyStatus {
	Idle = 0,
	Applied = 1,
	Failed = 2,
	Rejected = 3,
}

export type ReadFileToolArgs = {
	type: 'read_file';
	filepath?: string;
}

export type ListFilesToolArgs = {
	type: 'list_files';
	filepath?: string;
	recursive?: boolean;
}

export type MatchSearchFilesToolArgs = {
	type: 'match_search_files';
	filepath?: string;
	query?: string;
	file_pattern?: string;
	finish?: boolean;
}

export type RegexSearchFilesToolArgs = {
	type: 'regex_search_files';
	filepath?: string;
	regex?: string;
	file_pattern?: string;
	finish?: boolean;
}

export type SemanticSearchFilesToolArgs = {
	type: 'semantic_search_files';
	filepath?: string;
	query?: string;
	finish?: boolean;
}
export type WriteToFileToolArgs = {
	type: 'write_to_file';
	filepath?: string;
	content?: string;
	startLine?: number;
	endLine?: number;
}

export type InsertContentToolArgs = {
	type: 'insert_content';
	filepath?: string;
	content?: string;
	startLine?: number;
	endLine?: number;
}

export type SearchAndReplaceToolArgs = {
	type: 'search_and_replace';
	filepath: string;
	operations: {
		search: string;
		replace: string;
		startLine?: number;
		endLine?: number;
		useRegex?: boolean;
		ignoreCase?: boolean;
		regexFlags?: string;
	}[];
}

export type ApplyDiffToolArgs = {
	type: 'apply_diff';
	filepath: string;
	diff: string;
	finish?: boolean;
}

export type SearchWebToolArgs = {
	type: 'search_web';
	query: string;
	finish?: boolean;
}

export type FetchUrlsContentToolArgs = {
	type: 'fetch_urls_content';
	urls: string[];
	finish?: boolean;
}

export type SwitchModeToolArgs = {
	type: 'switch_mode';
	mode: string;
	reason: string;
	finish?: boolean;
}

export type UseMcpToolArgs = {
	type: 'use_mcp_tool';
	server_name: string;
	tool_name: string;
	parameters: Record<string, unknown>;
}

export type DataviewQueryToolArgs = {
	type: 'dataview_query';
	query: string;
	outputFormat: string;
	finish?: boolean;
}

export type CallTransformationsToolArgs = {
	type: 'call_transformations';
	path: string;
	transformation: string;
	finish?: boolean;
}

export type ManageFilesToolArgs = {
	type: 'manage_files';
	operations: Array<{
		action: 'create_folder' | 'move' | 'delete' | 'copy' | 'rename';
		path?: string;
		source_path?: string;
		destination_path?: string;
		new_name?: string;
	}>;
	finish?: boolean;
}

export type ManageCanvasToolArgs = {
	type: 'manage_canvas';
	path: string;
	operations: Array<{
		action: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'update_edge' | 'remove_edge';
		// Node properties
		id?: string;
		node_type?: 'text' | 'file' | 'link' | 'group';
		x?: number;
		y?: number;
		width?: number;
		height?: number;
		color?: string;
		text?: string;
		file?: string;
		subpath?: string;
		url?: string;
		label?: string;
		background?: string;
		background_style?: 'cover' | 'ratio' | 'repeat';
		// Edge properties
		from_node?: string;
		to_node?: string;
		from_side?: 'top' | 'right' | 'bottom' | 'left';
		to_side?: 'top' | 'right' | 'bottom' | 'left';
		from_end?: 'none' | 'arrow';
		to_end?: 'none' | 'arrow';
	}>;
	finish?: boolean;
}

export type ToolArgs = ReadFileToolArgs | WriteToFileToolArgs | InsertContentToolArgs | SearchAndReplaceToolArgs | ListFilesToolArgs | MatchSearchFilesToolArgs | RegexSearchFilesToolArgs | SemanticSearchFilesToolArgs | SearchWebToolArgs | FetchUrlsContentToolArgs | SwitchModeToolArgs | ApplyDiffToolArgs | UseMcpToolArgs | DataviewQueryToolArgs | CallTransformationsToolArgs | ManageFilesToolArgs | ManageCanvasToolArgs;
