import { EmbeddingManager } from "./EmbeddingManager";

// Create a singleton Manager to share the same Worker across the entire application
export const embeddingManager = new EmbeddingManager();

// Export EmbeddingManager class for use in other places
export { EmbeddingManager };

// Export type definitions
export type {
	EmbedResult,
	ModelLoadResult,
	ModelUnloadResult,
	TokenCountResult
} from './EmbeddingManager';
