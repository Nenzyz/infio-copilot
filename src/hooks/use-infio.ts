/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import JSZip from "jszip";
import { Notice, Plugin, requestUrl } from "obsidian";

import { INFIO_BASE_URL } from "../constants";
import { getDeviceId, getOperatingSystem } from "../utils/device-id";

// API response type definitions
export type UserPlanResponse = {
	plan: string;
	status: string;
	dl_zip?: string;
	[key: string]: unknown;
};

export type UpgradeResult = {
	success: boolean;
	message: string;
};

export const fetchUserPlan = async (apiKey: string): Promise<UserPlanResponse> => {
	const response = await requestUrl({
		url: `${INFIO_BASE_URL}/subscription/status`,
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	// eslint-disable-next-line @typescript-eslint/no-unsafe-return
	return response.json;
}

// API response type definitions
export type CheckGeneralResponse = {
	success: boolean;
	message: string;
	dl_zip?: string;
};

export type CheckGeneralParams = {
	device_id: string;
	device_name: string;
};

/**
 * 检查设备一般状态
 * @param apiKey API密钥
 * @param deviceId 设备ID
 * @param deviceName 设备名称
 * @returns Promise<CheckGeneralResponse>
 */
export const checkGeneral = async (
	apiKey: string
): Promise<CheckGeneralResponse> => {
	try {
		if (!apiKey) {
			throw new Error('API密钥不能为空');
		}
        const deviceId = await getDeviceId();
        const deviceName = getOperatingSystem();
		if (!deviceId || !deviceName) {
			throw new Error('设备ID和设备名称不能为空');
		}

		const response = await requestUrl({
			url: `${INFIO_BASE_URL}/subscription/check_general`,
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				device_id: deviceId,
				device_name: deviceName,
			}),
		});

		if (response.json.success) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return response.json;
		} else {
			console.error('检查 gerenal 会员失败:', response.json.message);
			return {
				success: false,
				message: response.json.message || '检查设备一般状态失败',
			};
		}
	} catch (error) {
		console.error('检查 gerenal 会员失败:', error);
		
		// Return error response format
		return {
			success: false,
			message: error instanceof Error ? error.message : '检查设备状态时出现未知错误'
		};
	}
};

/**
 * 检查用户是否为Pro用户
 */
// export const checkIsProUser = async (apiKey: string): Promise<boolean> => {
// 	try {
// 		if (!apiKey) {
// 			return false;
// 		}
		
// 		const userPlan = await fetchUserPlan(apiKey);
// 		return userPlan.plan?.toLowerCase().startsWith('pro') || false;
// 	} catch (error) {
// 		// eslint-disable-next-line no-console
// 		console.error('Failed to check Pro user status:', error);
// 		return false;
// 	}
// }

/**
 * 清理临时目录
 */
const cleanupTempDirectory = async (adapter: Plugin['app']['vault']['adapter'], tempDir: string): Promise<void> => {
	try {
		// Check if directory exists
		if (await adapter.exists(tempDir)) {
			console.log(`Cleaning temp directory: ${tempDir}`);
			// Delete temp directory and all its contents
			await adapter.rmdir(tempDir, true);
			console.log(`Temp directory cleanup complete: ${tempDir}`);
		}
	} catch (error) {
		console.log("Failed to clean temp directory:", error);
		// Don't throw error since this is not a critical operation
	}
};


/**
 * 下载并解压ZIP文件到临时目录
 */
const downloadAndExtractToTemp = async (
	adapter: Plugin['app']['vault']['adapter'], 
	tempDir: string, 
	downloadUrl: string
): Promise<void> => {
	console.log(`Starting file download: ${downloadUrl}`);
	
	// Download ZIP file
	let zipResponse;
	try {
		zipResponse = await requestUrl({
			url: downloadUrl,
			method: "GET",
		});
		console.log("File download complete, status:", zipResponse.status);
	} catch (error) {
		console.log("Download failed:", error);
		throw new Error("网络连接失败，无法下载Pro版本文件");
	}

	if (!zipResponse.arrayBuffer) {
		console.log("Invalid response format, missing arrayBuffer");
		throw new Error("下载的文件格式无效");
	}

	console.log("Extracting files to temp directory...");
	console.log(`Starting file extraction to temp directory: ${tempDir}`);

	// Extract ZIP file
	let zipData: JSZip;
	try {
		const zip = new JSZip();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		zipData = await zip.loadAsync(zipResponse.arrayBuffer);
		console.log("ZIP file parsed successfully");
	} catch (error) {
		console.log("ZIP file parsing failed:", error);
		throw new Error("文件解压失败，可能文件已损坏");
	}

	// Create temp directory
	try {
		if (!(await adapter.exists(tempDir))) {
			await adapter.mkdir(tempDir);
			console.log(`Temp directory created successfully: ${tempDir}`);
		} else {
			console.log(`Temp directory already exists: ${tempDir}`);
		}
	} catch (error) {
		console.log("Failed to create temp directory:", error);
		throw new Error("无法创建临时目录");
	}

	// Extract all files to temp directory
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		const files = Object.keys(zipData.files);
		console.log(files);
		console.log(`ZIP file contains ${files.length} entries`);
		
		let extractedCount = 0;
		for (const filename of files) {
			const file = zipData.files[filename];
			
			// Skip directories
			if (file?.dir) {
				console.log(`Skipping directory: ${filename}`);
				continue;
			}

			console.log(`Extracting file: ${filename}`);
			
			// Get file content
			const content = await file?.async("text");
			
			if (!content) {
				console.log(`Skipping empty file: ${filename}`);
				continue;
			}
			
			// Extract filename (remove path prefix)
			const pathParts = filename.split('/');
			const actualFileName = pathParts[pathParts.length - 1];
			
			// Write directly to temp directory root, don't create subdirectories
			const tempFilePath = `${tempDir}/${actualFileName}`;
			
			// Write file to temp directory
			await adapter.write(tempFilePath, content);
			extractedCount++;
			console.log(`File extraction complete: ${actualFileName} (${extractedCount}/${files.filter(f => !zipData.files[f].dir).length})`);
		}
		
		console.log(`All file extraction complete, extracted ${extractedCount} files`);
	} catch (error) {
		console.log("Error during file extraction:", error);
		throw new Error("文件解压过程中出现错误");
	}
};

/**
 * 从临时目录复制文件到插件目录
 */
const copyFilesFromTemp = async (
	adapter: Plugin['app']['vault']['adapter'],
	tempDir: string,
	pluginDir: string
): Promise<void> => {
	console.log("Updating plugin files...");
	console.log(`Starting file copy from temp directory to plugin directory: ${tempDir} -> ${pluginDir}`);

	// Key files that need to be copied
	const filesToCopy = ['main.js', 'styles.css', 'manifest.json'];
	
	// Check if required files exist
	const mainJsPath = `${tempDir}/main.js`;
	if (!(await adapter.exists(mainJsPath))) {
		console.log("Critical file missing: main.js");
		throw new Error("升级文件不完整，缺少关键组件");
	}
	
	// Copy files
	let copiedCount = 0;
	for (const filename of filesToCopy) {
		const tempFilePath = `${tempDir}/${filename}`;
		const pluginFilePath = `${pluginDir}/${filename}`;
		
		try {
			if (await adapter.exists(tempFilePath)) {
				const content = await adapter.read(tempFilePath);
				await adapter.write(pluginFilePath, content);
				copiedCount++;
			} else if (filename !== 'main.js') {
				console.log(`Optional file does not exist, skipping: ${filename}`);
			}
		} catch (error) {
			throw new Error(`文件更新失败: ${filename}`);
		}
	}
	
	console.log(`File copy complete, copied ${copiedCount} files`);
};

/**
 * 下载并安装Pro版本
 */
export const upgradeToProVersion = async (
	plugin: Plugin,
	dl_zip: string
): Promise<UpgradeResult> => {
	const tempDir = '.infio_download_cache';
	const adapter = plugin.app.vault.adapter;
		
	try {
		// Get plugin directory
		const pluginDir = plugin.manifest.dir;
		if (!pluginDir) {
			console.log("Plugin directory not found");
			throw new Error("无法找到插件目录");
		}
		new Notice("正在加载...");

		await cleanupTempDirectory(adapter, tempDir);

		await downloadAndExtractToTemp(
			adapter, 
			tempDir, 
			dl_zip
		);

		await copyFilesFromTemp(adapter, tempDir, pluginDir);

		new Notice("加载完成，成功升级");

		await cleanupTempDirectory(adapter, tempDir);

		setTimeout(async () => {
			console.log(`Reloading plugin: ${plugin.manifest.id}`);
			try {
				// Disable plugin
                // @ts-expect-error obsidian typings do not expose this internal API
				await plugin.app.plugins.disablePlugin(plugin.manifest.id);
				console.log(`Plugin disabled: ${plugin.manifest.id}`);
				
				// Enable plugin
                // @ts-expect-error obsidian typings do not expose this internal API
				await plugin.app.plugins.enablePlugin(plugin.manifest.id);
				console.log(`Plugin re-enabled: ${plugin.manifest.id}`);
				
				new Notice("插件重载完成");
			} catch (error) {
				console.error("插件重载失败:", error);
				new Notice("插件重载失败，请手动重启插件");
			}
		}, 1000);

		return {
			success: true,
			message: "加载完成"
		};

	} catch (error) {
		console.log("Error details:", error);
		
		// Clean temp directory even when error occurs
		await cleanupTempDirectory(adapter, tempDir);
		
		const errorMessage = error instanceof Error ? error.message : "升级过程中出现未知错误";
		console.log(`Final error message: ${errorMessage}`);
		new Notice(`加载失败: ${errorMessage}`);
		
		return {
			success: false,
			message: errorMessage
		};
	}
}
