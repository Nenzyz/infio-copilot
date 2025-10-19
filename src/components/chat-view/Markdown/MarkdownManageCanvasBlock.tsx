import { Box, Check, Loader2, Network, Square, FileText, Link as LinkIcon, Layers } from 'lucide-react'
import React, { useState } from 'react'

import { ApplyStatus, ManageCanvasToolArgs } from "../../../types/apply"

interface CanvasOperation {
	action: 'add_node' | 'update_node' | 'remove_node' | 'add_edge' | 'update_edge' | 'remove_edge'
	id?: string
	node_type?: 'text' | 'file' | 'link' | 'group'
	x?: number
	y?: number
	width?: number
	height?: number
	color?: string
	text?: string
	file?: string
	subpath?: string
	url?: string
	label?: string
	background?: string
	background_style?: 'cover' | 'ratio' | 'repeat'
	from_node?: string
	to_node?: string
	from_side?: 'top' | 'right' | 'bottom' | 'left'
	to_side?: 'top' | 'right' | 'bottom' | 'left'
	from_end?: 'none' | 'arrow'
	to_end?: 'none' | 'arrow'
}

export default function MarkdownManageCanvasBlock({
	applyStatus,
	onApply,
	path,
	operations,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: ManageCanvasToolArgs) => void
	path: string
	operations: CanvasOperation[]
	finish: boolean
}) {
	const [applying, setApplying] = useState(false)

	const getOperationIcon = (operation: CanvasOperation) => {
		if (operation.action.includes('edge')) {
			return <Network size={14} className="infio-chat-code-block-header-icon" />
		}

		switch (operation.node_type) {
			case 'text':
				return <FileText size={14} className="infio-chat-code-block-header-icon" />
			case 'file':
				return <FileText size={14} className="infio-chat-code-block-header-icon" />
			case 'link':
				return <LinkIcon size={14} className="infio-chat-code-block-header-icon" />
			case 'group':
				return <Layers size={14} className="infio-chat-code-block-header-icon" />
			default:
				return <Box size={14} className="infio-chat-code-block-header-icon" />
		}
	}

	const getOperationDescription = (operation: CanvasOperation) => {
		switch (operation.action) {
			case 'add_node':
				if (operation.node_type === 'text') {
					const textPreview = operation.text ? operation.text.substring(0, 30) + '...' : 'text node'
					return `Add text node: "${textPreview}"`
				}
				if (operation.node_type === 'file') {
					return `Add file node: ${operation.file || 'unknown'}`
				}
				if (operation.node_type === 'link') {
					return `Add link node: ${operation.url || 'unknown'}`
				}
				if (operation.node_type === 'group') {
					return `Add group: ${operation.label || 'unlabeled'}`
				}
				return `Add ${operation.node_type} node`
			case 'update_node':
				return `Update node: ${operation.id || 'unknown'}`
			case 'remove_node':
				return `Remove node: ${operation.id || 'unknown'}`
			case 'add_edge':
				return `Add edge: ${operation.from_node} → ${operation.to_node}`
			case 'update_edge':
				return `Update edge: ${operation.id || 'unknown'}`
			case 'remove_edge':
				return `Remove edge: ${operation.id || 'unknown'}`
			default:
				return `Unknown operation`
		}
	}

	const handleApply = async () => {
		if (applyStatus !== ApplyStatus.Idle) {
			return
		}
		setApplying(true)
		onApply({
			type: 'manage_canvas',
			path: path,
			operations: operations,
		})
	}

	return (
		<div className={`infio-chat-code-block has-filename`}>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<Box size={14} className="infio-chat-code-block-header-icon" />
					Canvas: {path} ({operations.length} operation{operations.length !== 1 ? 's' : ''})
				</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={handleApply}
						className="infio-apply-button"
						disabled={applyStatus !== ApplyStatus.Idle || applying || !finish}
					>
						{
							!finish ? (
								<>
									<Loader2 className="spinner" size={14} /> Preparing
								</>
							) : applyStatus === ApplyStatus.Idle ? (
								applying ? (
									<>
										<Loader2 className="spinner" size={14} /> Applying
									</>
								) : (
									'Apply'
								)
							) : applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> Applied
								</>
							) : applyStatus === ApplyStatus.Failed ? (
								'Failed'
							) : (
								'Rejected'
							)
						}
					</button>
				</div>
			</div>
			<div className={'infio-chat-code-block-body'}>
				{operations.map((operation, index) => (
					<div key={index} className="infio-file-operation-item">
						{getOperationIcon(operation)}
						<span>{getOperationDescription(operation)}</span>
					</div>
				))}
			</div>
		</div>
	)
}
