/**
 * Debug Logger - Comprehensive logging for AI interactions
 *
 * Usage:
 * - Set debugMode in settings or use localStorage
 * - Logs prompts, responses, tool parsing, and tool execution
 */

export interface DebugLogConfig {
	enabled: boolean;
	logPrompts: boolean;
	logResponses: boolean;
	logTools: boolean;
	logToolExecution: boolean;
	logToConsole: boolean;
	logToFile: boolean; // Future: save to a debug log file
}

const DEFAULT_CONFIG: DebugLogConfig = {
	enabled: false,
	logPrompts: true,
	logResponses: true,
	logTools: true,
	logToolExecution: true,
	logToConsole: true,
	logToFile: false
};

class DebugLogger {
	private config: DebugLogConfig = DEFAULT_CONFIG;
	private sessionId: string;
	private logs: Array<{ timestamp: number; type: string; data: any }> = [];

	constructor() {
		this.sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		this.loadConfig();
	}

	private loadConfig(): void {
		try {
			// Check localStorage for debug mode
			const debugEnabled = localStorage.getItem('infio-debug-mode') === 'true';
			if (debugEnabled) {
				this.config.enabled = true;
			}

			// Load custom config if available
			const customConfig = localStorage.getItem('infio-debug-config');
			if (customConfig) {
				this.config = { ...this.config, ...JSON.parse(customConfig) };
			}
		} catch (e) {
			console.warn('[DebugLogger] Failed to load config:', e);
		}
	}

	setConfig(config: Partial<DebugLogConfig>): void {
		this.config = { ...this.config, ...config };
		try {
			localStorage.setItem('infio-debug-config', JSON.stringify(this.config));
		} catch (e) {
			console.warn('[DebugLogger] Failed to save config:', e);
		}
	}

	enable(): void {
		this.config.enabled = true;
		localStorage.setItem('infio-debug-mode', 'true');
		console.log('[DebugLogger] 🐛 Debug mode ENABLED');
	}

	disable(): void {
		this.config.enabled = false;
		localStorage.setItem('infio-debug-mode', 'false');
		console.log('[DebugLogger] Debug mode disabled');
	}

	isEnabled(): boolean {
		return this.config.enabled;
	}

	/**
	 * Log prompt sent to LLM
	 */
	logPrompt(model: string, messages: any[], metadata?: any): void {
		if (!this.config.enabled || !this.config.logPrompts) return;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			type: 'PROMPT',
			model,
			messageCount: messages.length,
			messages,
			metadata
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			console.group(`🚀 [PROMPT] → ${model}`);
			console.log('Session:', this.sessionId);
			console.log('Messages:', messages.length);
			console.log('Full prompt:', messages);
			if (metadata) console.log('Metadata:', metadata);
			console.groupEnd();
		}
	}

	/**
	 * Log streaming response chunk
	 */
	logResponseChunk(model: string, chunk: string, metadata?: any): void {
		if (!this.config.enabled || !this.config.logResponses) return;

		// Don't log every tiny chunk to console (too noisy), but save to logs
		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			type: 'RESPONSE_CHUNK',
			model,
			chunk,
			length: chunk.length,
			metadata
		};

		this.saveLog(log);

		// Only log significant chunks or use a sampling rate
		if (this.config.logToConsole && (chunk.length > 50 || Math.random() < 0.1)) {
			console.log(`📝 [RESPONSE] ${chunk.substring(0, 100)}${chunk.length > 100 ? '...' : ''}`);
		}
	}

	/**
	 * Log complete response
	 */
	logResponse(model: string, fullResponse: string, metadata?: any): void {
		if (!this.config.enabled || !this.config.logResponses) return;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			type: 'RESPONSE_COMPLETE',
			model,
			response: fullResponse,
			length: fullResponse.length,
			metadata
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			console.group(`✅ [RESPONSE COMPLETE] ${model}`);
			console.log('Session:', this.sessionId);
			console.log('Length:', fullResponse.length, 'characters');
			console.log('Full response:', fullResponse);
			if (metadata) console.log('Metadata:', metadata);
			console.groupEnd();
		}
	}

	/**
	 * Log parsed tool blocks
	 */
	logToolsParsed(tools: any[], rawContent?: string): void {
		if (!this.config.enabled || !this.config.logTools) return;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			type: 'TOOLS_PARSED',
			toolCount: tools.length,
			tools,
			rawContent
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			console.group(`🔧 [TOOLS PARSED] ${tools.length} tool(s)`);
			console.log('Session:', this.sessionId);
			tools.forEach((tool, index) => {
				console.group(`Tool ${index + 1}: ${tool.type || 'unknown'}`);
				console.log('Data:', tool);
				console.groupEnd();
			});
			console.groupEnd();
		}
	}

	/**
	 * Log tool execution start
	 */
	logToolExecutionStart(toolType: string, toolData: any): string {
		if (!this.config.enabled || !this.config.logToolExecution) return '';

		const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			executionId,
			type: 'TOOL_EXECUTION_START',
			toolType,
			toolData
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			console.group(`⚙️ [TOOL EXECUTION START] ${toolType}`);
			console.log('Execution ID:', executionId);
			console.log('Tool data:', toolData);
			console.groupEnd();
		}

		return executionId;
	}

	/**
	 * Log tool execution result
	 */
	logToolExecutionEnd(
		executionId: string,
		toolType: string,
		success: boolean,
		result?: any,
		error?: any
	): void {
		if (!this.config.enabled || !this.config.logToolExecution) return;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			executionId,
			type: 'TOOL_EXECUTION_END',
			toolType,
			success,
			result,
			error
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			const icon = success ? '✅' : '❌';
			console.group(`${icon} [TOOL EXECUTION END] ${toolType}`);
			console.log('Execution ID:', executionId);
			console.log('Success:', success);
			if (success && result) {
				console.log('Result:', result);
			}
			if (!success && error) {
				console.error('Error:', error);
			}
			console.groupEnd();
		}
	}

	/**
	 * Log tool execution error
	 */
	logToolError(toolType: string, error: any, toolData?: any): void {
		if (!this.config.enabled || !this.config.logToolExecution) return;

		const log = {
			timestamp: Date.now(),
			sessionId: this.sessionId,
			type: 'TOOL_ERROR',
			toolType,
			error: error instanceof Error ? {
				message: error.message,
				stack: error.stack,
				name: error.name
			} : error,
			toolData
		};

		this.saveLog(log);

		if (this.config.logToConsole) {
			console.group(`💥 [TOOL ERROR] ${toolType}`);
			console.error('Error:', error);
			if (toolData) console.log('Tool data:', toolData);
			console.groupEnd();
		}
	}

	/**
	 * Get all logs
	 */
	getLogs(): Array<{ timestamp: number; type: string; data: any }> {
		return [...this.logs];
	}

	/**
	 * Get logs by type
	 */
	getLogsByType(type: string): Array<{ timestamp: number; type: string; data: any }> {
		return this.logs.filter(log => log.type === type);
	}

	/**
	 * Clear all logs
	 */
	clearLogs(): void {
		this.logs = [];
		console.log('[DebugLogger] Logs cleared');
	}

	/**
	 * Export logs as JSON
	 */
	exportLogs(): string {
		return JSON.stringify({
			sessionId: this.sessionId,
			exportedAt: Date.now(),
			config: this.config,
			logs: this.logs
		}, null, 2);
	}

	/**
	 * Print session summary
	 */
	printSummary(): void {
		console.group('📊 [DEBUG LOGGER SUMMARY]');
		console.log('Session ID:', this.sessionId);
		console.log('Total logs:', this.logs.length);

		const typeCounts: Record<string, number> = {};
		this.logs.forEach(log => {
			typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
		});

		console.log('Logs by type:', typeCounts);
		console.groupEnd();
	}

	private saveLog(logData: any): void {
		this.logs.push({
			timestamp: logData.timestamp,
			type: logData.type,
			data: logData
		});

		// Keep only last 1000 logs to prevent memory issues
		if (this.logs.length > 1000) {
			this.logs.shift();
		}
	}
}

// Singleton instance
let debugLoggerInstance: DebugLogger | null = null;

export function getDebugLogger(): DebugLogger {
	if (!debugLoggerInstance) {
		debugLoggerInstance = new DebugLogger();
	}
	return debugLoggerInstance;
}

// Convenience functions
export const debugLogger = {
	enable: () => getDebugLogger().enable(),
	disable: () => getDebugLogger().disable(),
	isEnabled: () => getDebugLogger().isEnabled(),
	logPrompt: (model: string, messages: any[], metadata?: any) =>
		getDebugLogger().logPrompt(model, messages, metadata),
	logResponseChunk: (model: string, chunk: string, metadata?: any) =>
		getDebugLogger().logResponseChunk(model, chunk, metadata),
	logResponse: (model: string, fullResponse: string, metadata?: any) =>
		getDebugLogger().logResponse(model, fullResponse, metadata),
	logToolsParsed: (tools: any[], rawContent?: string) =>
		getDebugLogger().logToolsParsed(tools, rawContent),
	logToolExecutionStart: (toolType: string, toolData: any) =>
		getDebugLogger().logToolExecutionStart(toolType, toolData),
	logToolExecutionEnd: (executionId: string, toolType: string, success: boolean, result?: any, error?: any) =>
		getDebugLogger().logToolExecutionEnd(executionId, toolType, success, result, error),
	logToolError: (toolType: string, error: any, toolData?: any) =>
		getDebugLogger().logToolError(toolType, error, toolData),
	getLogs: () => getDebugLogger().getLogs(),
	clearLogs: () => getDebugLogger().clearLogs(),
	exportLogs: () => getDebugLogger().exportLogs(),
	printSummary: () => getDebugLogger().printSummary()
};

// Global access for console debugging
if (typeof window !== 'undefined') {
	(window as any).infioDebug = debugLogger;
}
