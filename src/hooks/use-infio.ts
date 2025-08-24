/* eslint-disable no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import JSZip from "jszip";
import { machineId } from 'node-machine-id';
import { Notice, Platform, Plugin, requestUrl } from "obsidian";

import { INFIO_BASE_URL } from "../constants";

function getOperatingSystem(): string {
	if (Platform.isWin) {
		return 'windows';
	}
	if (Platform.isMacOS) {
		return 'macos';
	}
	if (Platform.isLinux) {
		return 'linux';
	}
	if (Platform.isAndroidApp) {
		return 'android';
	}
	if (Platform.isIosApp) {
		return 'ios';
	}
	// 如果所有已知的平台都不是，则返回未知
	return 'unknown';
}

// API响应类型定义
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

// API响应类型定义
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
		const deviceId = await machineId();
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
		
		// 返回错误响应格式
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
// 		console.error('检查Pro用户状态失败:', error);
// 		return false;
// 	}
// }

/**
 * 清理临时目录
 */
const cleanupTempDirectory = async (adapter: Plugin['app']['vault']['adapter'], tempDir: string): Promise<void> => {
	try {
		// 检查目录是否存在
		if (await adapter.exists(tempDir)) {
			console.log(`清理临时目录: ${tempDir}`);
			// 删除临时目录及其所有内容
			await adapter.rmdir(tempDir, true);
			console.log(`临时目录清理完成: ${tempDir}`);
		}
	} catch (error) {
		console.log("清理临时目录失败:", error);
		// 不抛出错误，因为这不是关键操作
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
	console.log(`开始下载文件: ${downloadUrl}`);
	
	// 下载ZIP文件
	let zipResponse;
	try {
		zipResponse = await requestUrl({
			url: downloadUrl,
			method: "GET",
		});
		console.log("文件下载完成，状态:", zipResponse.status);
	} catch (error) {
		console.log("下载失败:", error);
		throw new Error("网络连接失败，无法下载Pro版本文件");
	}

	if (!zipResponse.arrayBuffer) {
		console.log("响应格式无效，缺少arrayBuffer");
		throw new Error("下载的文件格式无效");
	}

	console.log("正在解压文件到临时目录...");
	console.log(`开始解压文件到临时目录: ${tempDir}`);

	// 解压ZIP文件
	let zipData: JSZip;
	try {
		const zip = new JSZip();
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		zipData = await zip.loadAsync(zipResponse.arrayBuffer);
		console.log("ZIP文件解析成功");
	} catch (error) {
		console.log("ZIP文件解析失败:", error);
		throw new Error("文件解压失败，可能文件已损坏");
	}

	// 创建临时目录
	try {
		if (!(await adapter.exists(tempDir))) {
			await adapter.mkdir(tempDir);
			console.log(`临时目录创建成功: ${tempDir}`);
		} else {
			console.log(`临时目录已存在: ${tempDir}`);
		}
	} catch (error) {
		console.log("创建临时目录失败:", error);
		throw new Error("无法创建临时目录");
	}

	// 解压所有文件到临时目录
	try {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
		const files = Object.keys(zipData.files);
		console.log(files);
		console.log(`ZIP文件中包含 ${files.length} 个条目`);
		
		let extractedCount = 0;
		for (const filename of files) {
			const file = zipData.files[filename];
			
			// 跳过目录
			if (file?.dir) {
				console.log(`跳过目录: ${filename}`);
				continue;
			}

			console.log(`正在解压文件: ${filename}`);
			
			// 获取文件内容
			const content = await file?.async("text");
			
			if (!content) {
				console.log(`跳过空文件: ${filename}`);
				continue;
			}
			
			// 提取文件名（去掉路径前缀）
			const pathParts = filename.split('/');
			const actualFileName = pathParts[pathParts.length - 1];
			
			// 直接写入到临时目录根目录，不创建子目录
			const tempFilePath = `${tempDir}/${actualFileName}`;
			
			// 写入文件到临时目录
			await adapter.write(tempFilePath, content);
			extractedCount++;
			console.log(`文件解压完成: ${actualFileName} (${extractedCount}/${files.filter(f => !zipData.files[f].dir).length})`);
		}
		
		console.log(`所有文件解压完成，共解压 ${extractedCount} 个文件`);
	} catch (error) {
		console.log("文件解压过程中出错:", error);
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
	console.log("正在更新插件文件...");
	console.log(`开始从临时目录复制文件到插件目录: ${tempDir} -> ${pluginDir}`);

	// 需要复制的关键文件
	const filesToCopy = ['main.js', 'styles.css', 'manifest.json'];
	
	// 检查必需文件是否存在
	const mainJsPath = `${tempDir}/main.js`;
	if (!(await adapter.exists(mainJsPath))) {
		console.log("关键文件缺失: main.js");
		throw new Error("升级文件不完整，缺少关键组件");
	}
	
	// 复制文件
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
				console.log(`可选文件不存在，跳过: ${filename}`);
			}
		} catch (error) {
			throw new Error(`文件更新失败: ${filename}`);
		}
	}
	
	console.log(`文件复制完成，共复制 ${copiedCount} 个文件`);
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
		// 获取插件目录
		const pluginDir = plugin.manifest.dir;
		if (!pluginDir) {
			console.log("插件目录未找到");
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

		new Notice("加载完成，成功升级为Pro");

		await cleanupTempDirectory(adapter, tempDir);

		setTimeout(async () => {
			console.log(`重载插件: ${plugin.manifest.id}`);
			try {
				// 禁用插件
				await plugin.app.plugins.disablePlugin(plugin.manifest.id);
				console.log(`插件已禁用: ${plugin.manifest.id}`);
				
				// 启用插件
				await plugin.app.plugins.enablePlugin(plugin.manifest.id);
				console.log(`插件已重新启用: ${plugin.manifest.id}`);
				
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
		console.log("错误详情:", error);
		
		// 发生错误时也要清理临时目录
		await cleanupTempDirectory(adapter, tempDir);
		
		const errorMessage = error instanceof Error ? error.message : "升级过程中出现未知错误";
		console.log(`最终错误信息: ${errorMessage}`);
		new Notice(`加载失败: ${errorMessage}`);
		
		return {
			success: false,
			message: errorMessage
		};
	}
}
