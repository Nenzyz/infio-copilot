console.log('Embedding worker loaded');

interface EmbedInput {
	embed_input: string;
}

interface EmbedResult {
	vec: number[];
	tokens: number;
	embed_input?: string;
	error?: string;
}

// Define parameter types for worker messages
interface LoadParams {
	model_key: string;
	use_gpu?: boolean;
}

interface EmbedBatchParams {
	inputs: EmbedInput[];
}

type WorkerParams = LoadParams | EmbedBatchParams | string | undefined;

interface WorkerMessage {
	method: string;
	params: WorkerParams;
	id: number;
	worker_id?: string;
}

interface WorkerResponse {
	id: number;
	result?: unknown;
	error?: string;
	worker_id?: string;
}

// Define Transformers.js related types
interface TransformersEnv {
	allowLocalModels: boolean;
	allowRemoteModels: boolean;
	backends: {
		onnx: {
			wasm: {
				numThreads: number;
				simd: boolean;
			};
		};
	};
	useFS: boolean;
	useBrowserCache: boolean;
	remoteHost?: string;
}

interface PipelineOptions {
	quantized?: boolean;
	progress_callback?: (progress: unknown) => void;
	device?: string;
	dtype?: string;
}

interface ModelInfo {
	loaded: boolean;
	model_key: string;
	use_gpu: boolean;
}

interface TokenizerResult {
	input_ids: {
		data: number[];
	};
}

interface GlobalTransformers {
	pipelineFactory: (task: string, model: string, options?: PipelineOptions) => Promise<unknown>;
	AutoTokenizer: {
		from_pretrained: (model: string) => Promise<unknown>;
	};
	env: TransformersEnv;
}

// Global variables
let model: ModelInfo | null = null;
let pipeline: unknown = null;
let tokenizer: unknown = null;
let processing_message = false;
let transformersLoaded = false;

/**
 * Test whether a network endpoint is accessible
 * @param {string} url The URL to test
 * @param {number} timeout Timeout in milliseconds
 * @returns {Promise<boolean>} Returns true if accessible, otherwise false
 */
async function testEndpoint(url: string, timeout = 3000): Promise<boolean> {
	// AbortController used to cancel fetch requests after timeout
	const controller = new AbortController();
	const signal = controller.signal;

	const timeoutId = setTimeout(() => {
		console.log(`Request to ${url} timed out.`);
		controller.abort();
	}, timeout);

	try {
		console.log(`Testing endpoint: ${url}`);
		// We use 'HEAD' method because it only requests header information, very fast, suitable for liveness detection.
		// 'no-cors' mode allows us to make cross-domain requests in browser environment for simple reachability testing,
		// Even if we can't read response content, successful request means network is accessible.
		await fetch(url, { method: 'HEAD', mode: 'no-cors', signal });
		
		// If fetch succeeds, clear timeout timer and return true
		clearTimeout(timeoutId);
		console.log(`Endpoint ${url} is accessible.`);
		return true;
	} catch (error) {
		// If network error occurs or request is aborted (timeout), enter catch block
		clearTimeout(timeoutId); // Also need to clear timer
		console.warn(`Cannot access endpoint ${url}:`, error instanceof Error && error.name === 'AbortError' ? 'timeout' : (error as Error).message);
		return false;
	}
}

/**
 * Initialize Hugging Face endpoint, automatically switch to fallback mirror if default is unavailable.
 */
async function initializeEndpoint(): Promise<void> {
	const defaultEndpoint = 'https://huggingface.co';
	const fallbackEndpoint = 'https://hf-mirror.com';

	const isDefaultReachable = await testEndpoint(defaultEndpoint);

	const globalTransformers = globalThis as unknown as { transformers?: GlobalTransformers };
	
	if (!isDefaultReachable) {
		console.log(`Default endpoint unreachable, switching to fallback mirror: ${fallbackEndpoint}`);
		// This is the key step: set endpoint in code
		if (globalTransformers.transformers?.env) {
			globalTransformers.transformers.env.remoteHost = fallbackEndpoint;
		}
	} else {
		console.log(`Will use default endpoint: ${defaultEndpoint}`);
	}
}

// Dynamically import Transformers.js
async function loadTransformers(): Promise<void> {
	if (transformersLoaded) return;

	try {
		console.log('Loading Transformers.js...');

		// First initialize endpoint
		await initializeEndpoint();

		// Try using older version of Transformers.js, which is more stable in Workers
		const { pipeline: pipelineFactory, env, AutoTokenizer } = await import('@xenova/transformers');

		// Configure environment to adapt to browser Worker
		env.allowLocalModels = false;
		env.allowRemoteModels = true;

		// Configure WASM backend - fix thread configuration
		env.backends.onnx.wasm.numThreads = 1; // Use single thread in Worker to avoid race conditions
		env.backends.onnx.wasm.simd = true;

		// Disable Node.js specific features
		env.useFS = false;
		env.useBrowserCache = true;

		const globalTransformers = globalThis as unknown as { transformers?: GlobalTransformers };
		globalTransformers.transformers = {
			pipelineFactory,
			AutoTokenizer,
			env: env as unknown as TransformersEnv
		};

		transformersLoaded = true;
		console.log('Transformers.js loaded successfully');
	} catch (error) {
		console.error('Failed to load Transformers.js:', error);
		throw new Error(`Failed to load Transformers.js: ${error}`);
	}
}

async function loadModel(modelKey: string, useGpu: boolean = false): Promise<{ model_loaded: boolean }> {
	try {
		console.log(`Loading model: ${modelKey}, GPU: ${useGpu}`);

		// Ensure Transformers.js is loaded
		await loadTransformers();

		const globalTransformers = globalThis as unknown as { transformers?: GlobalTransformers };
		const transformers = globalTransformers.transformers;
		
		if (!transformers) {
			throw new Error('Transformers.js not loaded');
		}

		const { pipelineFactory, AutoTokenizer } = transformers;

		// Configure pipeline options
		const pipelineOpts: PipelineOptions = {
			quantized: true,
			// Fix progress callback, add error handling
			progress_callback: (progress: unknown) => {
				try {
					if (progress && typeof progress === 'object') {
						// console.log('Model loading progress:', progress);
					}
				} catch (error) {
					// Ignore progress callback errors to avoid interrupting model loading
					console.warn('Progress callback error (ignored):', error);
				}
			}
		};

		// GPU configuration more cautious
		if (useGpu) {
			try {
				// Check WebGPU support
				console.log("useGpu", useGpu);
				if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
					const gpu = (navigator as { gpu?: { requestAdapter?: () => unknown } }).gpu;
					if (gpu && typeof gpu.requestAdapter === 'function') {
						console.log('[Transformers] Attempting to use GPU');
						pipelineOpts.device = 'webgpu';
						pipelineOpts.dtype = 'fp32';
					} else {
						console.log('[Transformers] WebGPU not fully supported, using CPU');
					}
				} else {
					console.log('[Transformers] WebGPU not available, using CPU');
				}
			} catch (error) {
				console.warn('[Transformers] Error checking GPU support, falling back to CPU:', error);
			}
		} else {
			console.log('[Transformers] Using CPU');
		}

		// Create embedding pipeline
		pipeline = await pipelineFactory('feature-extraction', modelKey, pipelineOpts);

		// Create tokenizer
		tokenizer = await AutoTokenizer.from_pretrained(modelKey);

		model = {
			loaded: true,
			model_key: modelKey,
			use_gpu: useGpu
		};

		console.log(`Model ${modelKey} loaded successfully`);
		return { model_loaded: true };

	} catch (error) {
		console.error('Error loading model:', error);
		throw new Error(`Failed to load model: ${error}`);
	}
}

async function unloadModel(): Promise<{ model_unloaded: boolean }> {
	try {
		console.log('Unloading model...');

		if (pipeline && typeof pipeline === 'object' && 'destroy' in pipeline) {
			const pipelineWithDestroy = pipeline as { destroy: () => void };
			pipelineWithDestroy.destroy();
		}
		pipeline = null;

		tokenizer = null;
		model = null;

		console.log('Model unloaded successfully');
		return { model_unloaded: true };

	} catch (error) {
		console.error('Error unloading model:', error);
		throw new Error(`Failed to unload model: ${error}`);
	}
}

async function countTokens(input: string): Promise<{ tokens: number }> {
	try {
		if (!tokenizer) {
			throw new Error('Tokenizer not loaded');
		}

		const tokenizerWithCall = tokenizer as (input: string) => Promise<TokenizerResult>;
		const { input_ids } = await tokenizerWithCall(input);
		return { tokens: input_ids.data.length };

	} catch (error) {
		console.error('Error counting tokens:', error);
		throw new Error(`Failed to count tokens: ${error}`);
	}
}

async function embedBatch(inputs: EmbedInput[]): Promise<EmbedResult[]> {
	try {
		if (!pipeline || !tokenizer) {
			throw new Error('Model not loaded');
		}

		console.log(`Processing ${inputs.length} inputs`);

		// Filter empty inputs
		const filteredInputs = inputs.filter(item => item.embed_input && item.embed_input.length > 0);

		if (filteredInputs.length === 0) {
			return [];
		}

		// Batch size (can be adjusted as needed)
		const batchSize = 1;

		if (filteredInputs.length > batchSize) {
			console.log(`Processing ${filteredInputs.length} inputs in batches of ${batchSize}`);
			const results: EmbedResult[] = [];

			for (let i = 0; i < filteredInputs.length; i += batchSize) {
				const batch = filteredInputs.slice(i, i + batchSize);
				const batchResults = await processBatch(batch);
				results.push(...batchResults);
			}

			return results;
		}

		return await processBatch(filteredInputs);

	} catch (error) {
		console.error('Error in embed batch:', error);
		throw new Error(`Failed to generate embeddings: ${error}`);
	}
}

async function processBatch(batchInputs: EmbedInput[]): Promise<EmbedResult[]> {
	try {
		// Calculate token count for each input
		const tokens = await Promise.all(
			batchInputs.map(item => countTokens(item.embed_input))
		);

		// Prepare embedding inputs (handle overly long text)
		const maxTokens = 512; // Maximum token limit for most models
		const embedInputs = await Promise.all(
			batchInputs.map(async (item, i) => {
				if (tokens[i].tokens < maxTokens) {
					return item.embed_input;
				}

				// Truncate overly long text
				let tokenCt = tokens[i].tokens;
				let truncatedInput = item.embed_input;

				while (tokenCt > maxTokens) {
					const pct = maxTokens / tokenCt;
					const maxChars = Math.floor(truncatedInput.length * pct * 0.9);
					truncatedInput = truncatedInput.substring(0, maxChars) + '...';
					tokenCt = (await countTokens(truncatedInput)).tokens;
				}

				tokens[i].tokens = tokenCt;
				return truncatedInput;
			})
		);

		// Generate embedding vectors
		const pipelineCall = pipeline as (inputs: string[], options: { pooling: string; normalize: boolean }) => Promise<{ data: number[] }[]>;
		const resp = await pipelineCall(embedInputs, { pooling: 'mean', normalize: true });

		// Process results
		return batchInputs.map((item, i) => ({
			vec: Array.from(resp[i].data).map((val: number) => Math.round(val * 1e8) / 1e8),
			tokens: tokens[i].tokens,
			embed_input: item.embed_input
		}));

	} catch (error) {
		console.error('Error processing batch:', error);

		// If batch processing fails, try processing individually
		const results = await Promise.all(
			batchInputs.map(async (item): Promise<EmbedResult> => {
				try {
					const pipelineCall = pipeline as (input: string, options: { pooling: string; normalize: boolean }) => Promise<{ data: number[] }[]>;
					const result = await pipelineCall(item.embed_input, { pooling: 'mean', normalize: true });
					const tokenCount = await countTokens(item.embed_input);

					return {
						vec: Array.from(result[0].data).map((val: number) => Math.round(val * 1e8) / 1e8),
						tokens: tokenCount.tokens,
						embed_input: item.embed_input
					};
				} catch (singleError) {
					console.error('Error processing single item:', singleError);
					return {
						vec: [],
						tokens: 0,
						embed_input: item.embed_input,
						error: singleError instanceof Error ? singleError.message : 'Unknown error'
					};
				}
			})
		);
		
		return results;
	}
}

async function processMessage(data: WorkerMessage): Promise<WorkerResponse> {
	const { method, params, id, worker_id } = data;

	try {
		let result: unknown;

		switch (method) {
			case 'load':
				console.log('Load method called with params:', params);
				const loadParams = params as LoadParams;
				result = await loadModel(loadParams.model_key, loadParams.use_gpu || false);
				break;

			case 'unload':
				console.log('Unload method called');
				result = await unloadModel();
				break;

			case 'embed_batch':
				console.log('Embed batch method called');
				if (!model) {
					throw new Error('Model not loaded');
				}

				// Wait for previous processing to complete
				if (processing_message) {
					while (processing_message) {
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}

				processing_message = true;
				const embedParams = params as EmbedBatchParams;
				result = await embedBatch(embedParams.inputs);
				processing_message = false;
				break;

			case 'count_tokens':
				console.log('Count tokens method called');
				if (!model) {
					throw new Error('Model not loaded');
				}

				// Wait for previous processing to complete
				if (processing_message) {
					while (processing_message) {
						await new Promise(resolve => setTimeout(resolve, 100));
					}
				}

				processing_message = true;
				const tokenParams = params as string;
				result = await countTokens(tokenParams);
				processing_message = false;
				break;

			default:
				throw new Error(`Unknown method: ${method}`);
		}

		return { id, result, worker_id };

	} catch (error) {
		console.error('Error processing message:', error);
		processing_message = false;
		return { id, error: error instanceof Error ? error.message : 'Unknown error', worker_id };
	}
}

self.addEventListener('message', async (event) => {
	try {
		console.log('Worker received message:', event.data);

		// Validate message format
		if (!event.data || typeof event.data !== 'object') {
			console.error('Invalid message format received');
			self.postMessage({
				id: -1,
				error: 'Invalid message format'
			});
			return;
		}

		const response = await processMessage(event.data as WorkerMessage);
		console.log('Worker sending response:', response);
		self.postMessage(response);
	} catch (error) {
		console.error('Unhandled error in worker message handler:', error);
		self.postMessage({
			id: (event.data as { id?: number })?.id || -1,
			error: `Worker error: ${error instanceof Error ? error.message : 'Unknown error'}`
		});
	}
});

self.addEventListener('error', (event) => {
	console.error('Worker global error:', event);
	self.postMessage({
		id: -1,
		error: `Worker global error: ${event.message || 'Unknown error'}`
	});
});

self.addEventListener('unhandledrejection', (event) => {
	console.error('Worker unhandled promise rejection:', event);
	self.postMessage({
		id: -1,
		error: `Worker unhandled rejection: ${event.reason || 'Unknown error'}`
	});
	event.preventDefault(); // Prevent default console errors
});

console.log('Embedding worker ready'); 
