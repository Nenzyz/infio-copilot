// Import complete embedding Worker
// @ts-nocheck
import EmbedWorker from './embed.worker';

// Type definitions
export interface EmbedResult {
	vec: number[];
	tokens: number;
	embed_input?: string;
}

export interface ModelLoadResult {
	model_loaded: boolean;
}

export interface ModelUnloadResult {
	model_unloaded: boolean;
}

export interface TokenCountResult {
	tokens: number;
}

// Worker message type definitions
interface WorkerMessage {
	id: number;
	result?: unknown;
	error?: string;
}

interface WorkerRequest {
	resolve: (value: unknown) => void;
	reject: (reason?: unknown) => void;
}

export class EmbeddingManager {
	private worker: Worker;
	private requests = new Map<number, WorkerRequest>();
	private nextRequestId = 0;
	private isModelLoaded = false;
	private currentModelId: string | null = null;

	constructor() {
		// Create Worker using the same pattern as pgworker
		this.worker = new EmbedWorker();

		// Unified listener for all messages from Worker
		this.worker.onmessage = (event) => {
			try {
				const { id, result, error } = event.data as WorkerMessage;

				// Find the corresponding Promise callback based on the returned id
				const request = this.requests.get(id);

				if (request) {
					if (error) {
						request.reject(new Error(error));
					} else {
						request.resolve(result);
					}
					// Remove from Map after completion
					this.requests.delete(id);
				}
			} catch (err) {
				console.error("Error processing worker message:", err);
				// Reject all pending requests
				this.requests.forEach(request => {
					request.reject(new Error(`Worker message processing error: ${(err as Error).message}`));
				});
				this.requests.clear();
			}
		};

		this.worker.onerror = (error) => {
			console.error("EmbeddingWorker error:", error);
			// Reject all pending requests
			this.requests.forEach(request => {
				request.reject(new Error(`Worker error: ${error.message || 'Unknown worker error'}`));
			});
			this.requests.clear();

			// Reset state
			this.isModelLoaded = false;
			this.currentModelId = null;
		};
	}

	private postRequest<T>(method: string, params: unknown): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const id = this.nextRequestId++;
			this.requests.set(id, { resolve, reject });
			this.worker.postMessage({ method, params, id });
		});
	}

	public async loadModel(modelId: string, useGpu: boolean = false): Promise<ModelLoadResult> {
		console.log(`Loading embedding model: ${modelId}, GPU: ${useGpu}`);

		try {
			// If the same model is already loaded, return directly
			if (this.isModelLoaded && this.currentModelId === modelId) {
				console.log(`Model ${modelId} already loaded`);
				return { model_loaded: true };
			}

			// If a different model is loaded, unload it first
			if (this.isModelLoaded && this.currentModelId !== modelId) {
				console.log(`Unloading previous model: ${this.currentModelId}`);
				await this.unloadModel();
			}

			const result = await this.postRequest<ModelLoadResult>('load', {
				model_key: modelId,
				use_gpu: useGpu
			});

			this.isModelLoaded = result.model_loaded;
			this.currentModelId = result.model_loaded ? modelId : null;

			if (result.model_loaded) {
				console.log(`Model ${modelId} loaded successfully`);
			}

			return result;
		} catch (error) {
			console.error(`Failed to load model ${modelId}:`, error);
			this.isModelLoaded = false;
			this.currentModelId = null;
			throw error;
		}
	}

	/**
	 * Generate embedding vectors for a batch of texts.
	 * @param texts Array of texts to process
	 * @returns Returns an array of objects containing vector and token information
	 */
	public async embedBatch(texts: string[]): Promise<EmbedResult[]> {
		if (!this.isModelLoaded) {
			throw new Error('Model not loaded. Please call loadModel() first.');
		}

		if (!texts || texts.length === 0) {
			return [];
		}

		console.log(`Generating embeddings for ${texts.length} texts`);

		try {
			const inputs = texts.map(text => ({ embed_input: text }));
			const results = await this.postRequest<EmbedResult[]>('embed_batch', { inputs });

			console.log(`Generated ${results.length} embeddings`);
			return results;
		} catch (error) {
			console.error('Failed to generate embeddings:', error);
			throw error;
		}
	}

	/**
	 * Generate embedding vector for a single text.
	 * @param text Text to process
	 * @returns Returns object containing vector and token information
	 */
	public async embed(text: string): Promise<EmbedResult> {
		if (!text || text.trim().length === 0) {
			throw new Error('Text cannot be empty');
		}

		const results = await this.embedBatch([text]);
		if (results.length === 0) {
			throw new Error('Failed to generate embedding');
		}

		return results[0];
	}

	/**
	 * Count the number of tokens in text.
	 * @param text Text to count
	 */
	public async countTokens(text: string): Promise<TokenCountResult> {
		if (!this.isModelLoaded) {
			throw new Error('Model not loaded. Please call loadModel() first.');
		}

		if (!text) {
			return { tokens: 0 };
		}

		try {
			return await this.postRequest<TokenCountResult>('count_tokens', text);
		} catch (error) {
			console.error('Failed to count tokens:', error);
			throw error;
		}
	}

	/**
	 * Unload model and free memory.
	 */
	public async unloadModel(): Promise<ModelUnloadResult> {
		if (!this.isModelLoaded) {
			console.log('No model to unload');
			return { model_unloaded: true };
		}

		try {
			console.log(`Unloading model: ${this.currentModelId}`);
			const result = await this.postRequest<ModelUnloadResult>('unload', {});

			this.isModelLoaded = false;
			this.currentModelId = null;

			console.log('Model unloaded successfully');
			return result;
		} catch (error) {
			console.error('Failed to unload model:', error);
			// Reset state even if unloading fails
			this.isModelLoaded = false;
			this.currentModelId = null;
			throw error;
		}
	}

	/**
	 * Check if model is loaded.
	 */
	public get modelLoaded(): boolean {
		return this.isModelLoaded;
	}

	/**
	 * Get current loaded model ID.
	 */
	public get currentModel(): string | null {
		return this.currentModelId;
	}

	/**
	 * Get list of supported models.
	 */
	public getSupportedModels(): string[] {
		return [
			'TaylorAI/bge-micro-v2',
			'Xenova/all-MiniLM-L6-v2',
			'Xenova/bge-small-en-v1.5',
			'Xenova/bge-base-en-v1.5',
			'Xenova/jina-embeddings-v2-base-zh',
			'Xenova/jina-embeddings-v2-small-en',
			'Xenova/multilingual-e5-small',
			'Xenova/multilingual-e5-base',
			'Xenova/gte-small',
			'Xenova/e5-small-v2',
			'Xenova/e5-base-v2'
		];
	}

	/**
	 * Get model information.
	 */
	public getModelInfo(modelId: string): { dims: number; maxTokens: number; description: string } | null {
		const modelInfoMap: Record<string, { dims: number; maxTokens: number; description: string }> = {
			'Xenova/all-MiniLM-L6-v2': { dims: 384, maxTokens: 512, description: 'All-MiniLM-L6-v2 (recommended, lightweight)' },
			'Xenova/bge-small-en-v1.5': { dims: 384, maxTokens: 512, description: 'BGE-small-en-v1.5' },
			'Xenova/bge-base-en-v1.5': { dims: 768, maxTokens: 512, description: 'BGE-base-en-v1.5 (higher quality)' },
			'Xenova/jina-embeddings-v2-base-zh': { dims: 768, maxTokens: 8192, description: 'Jina-v2-base-zh (Chinese-English bilingual)' },
			'Xenova/jina-embeddings-v2-small-en': { dims: 512, maxTokens: 8192, description: 'Jina-v2-small-en' },
			'Xenova/multilingual-e5-small': { dims: 384, maxTokens: 512, description: 'E5-small (multilingual)' },
			'Xenova/multilingual-e5-base': { dims: 768, maxTokens: 512, description: 'E5-base (multilingual, higher quality)' },
			'Xenova/gte-small': { dims: 384, maxTokens: 512, description: 'GTE-small' },
			'Xenova/e5-small-v2': { dims: 384, maxTokens: 512, description: 'E5-small-v2' },
			'Xenova/e5-base-v2': { dims: 768, maxTokens: 512, description: 'E5-base-v2 (higher quality)' }
		};

		return modelInfoMap[modelId] || null;
	}

	/**
	 * Terminate Worker and release resources.
	 */
	public terminate() {
		this.worker.terminate();
		this.requests.clear();
		this.isModelLoaded = false;
	}
} 
