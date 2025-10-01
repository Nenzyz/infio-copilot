import {
	PropsWithChildren,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react'

import LLMManager from '../core/llm/manager'
import { LLMModel } from '../types/llm/model'
import {
	LLMOptions,
	LLMRequestNonStreaming,
	LLMRequestStreaming,
} from '../types/llm/request'
import {
	LLMResponseNonStreaming,
	LLMResponseStreaming,
} from '../types/llm/response'

import { useSettings } from './SettingsContext'

export type LLMContextType = {
	generateResponse: (
		model: LLMModel,
		request: LLMRequestNonStreaming,
		options?: LLMOptions,
	) => Promise<LLMResponseNonStreaming>
	streamResponse: (
		model: LLMModel,
		request: LLMRequestStreaming,
		options?: LLMOptions,
	) => Promise<AsyncIterable<LLMResponseStreaming>>
	chatModel: LLMModel
	// applyModel: LLMModel
}

const LLMContext = createContext<LLMContextType | null>(null)

export function LLMProvider({ children }: PropsWithChildren) {
	const [llmManager, setLLMManager] = useState<LLMManager | null>(null)
	const { settings } = useSettings()

	const chatModel = useMemo((): LLMModel => {
		return {
			provider: settings.chatModelProvider,
			modelId: settings.chatModelId,
		};
	}, [settings.chatModelProvider, settings.chatModelId])

	useEffect(() => {
		const manager = new LLMManager(settings)
		setLLMManager(manager)
	}, [settings])

	const generateResponse = useCallback(
		async (
			model: LLMModel,
			request: LLMRequestNonStreaming,
			options?: LLMOptions,
		) => {
			if (!llmManager) {
				throw new Error('LLMManager is not initialized')
			}
			return await llmManager.generateResponse(model, request, options)
		},
		[llmManager],
	)

	const streamResponse = useCallback(
		async (
			model: LLMModel,
			request: LLMRequestStreaming,
			options?: LLMOptions,
		) => {
			if (!llmManager) {
				throw new Error('LLMManager is not initialized')
			}
			return await llmManager.streamResponse(model, request, options)
		},
		[llmManager],
	)

	return (
		<LLMContext.Provider
			value={{ generateResponse, streamResponse, chatModel }}
		>
			{children}
		</LLMContext.Provider>
	)
}

export function useLLM() {
	const context = useContext(LLMContext)
	if (!context) {
		throw new Error('useLLM must be used within an LLMProvider')
	}
	return context
}
