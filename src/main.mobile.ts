// @ts-check

import JSZip from "jszip";
import { App, Notice, Platform, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';

import { ApiKeyModal } from './components/modals/ApiKeyModal';
import { ProUpgradeModal } from './components/modals/ProUpgradeModal';
// import { checkGeneral, fetchUserPlan, upgradeToProVersion } from './hooks/use-infio';
import { InfioSettings, parseInfioSettings } from './types/settings-mobile';
import { getDeviceId, getOperatingSystem } from './utils/device-id';

const INFIO_BASE_URL = 'https://api.infio.app'

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
 * Check device general status
 * @param apiKey API key
 * @param deviceId Device ID
 * @param deviceName Device name
 * @returns Promise<CheckGeneralResponse>
 */
export const checkGeneral = async (
	apiKey: string
): Promise<CheckGeneralResponse> => {
	try {
		if (!apiKey) {
			throw new Error('API key cannot be empty');
		}
		const deviceId = await getDeviceId();
		const deviceName = getOperatingSystem();
		if (!deviceId || !deviceName) {
			throw new Error('Device ID and device name cannot be empty');
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
			console.error('Check general membership failed:', response.json.message);
			return {
				success: false,
				message: response.json.message || 'Check device general status failed',
			};
		}
	} catch (error) {
		console.error('Check general membership failed:', error);

		// Return error response format
		return {
			success: false,
			message: error instanceof Error ? error.message : 'Unknown error occurred while checking device status'
		};
	}
};

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
		throw new Error("Network connection failed, unable to download Pro version files");
	}

	if (!zipResponse.arrayBuffer) {
		console.log("Invalid response format, missing arrayBuffer");
		throw new Error("Downloaded file format is invalid");
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
		throw new Error("File extraction failed, file may be corrupted");
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
		throw new Error("Unable to create temp directory");
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
		throw new Error("Error occurred during file extraction");
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

		new Notice("加载完成，成功升级");

		await cleanupTempDirectory(adapter, tempDir);

		setTimeout(async () => {
			console.log(`重载插件: ${plugin.manifest.id}`);
			try {
				// Disable plugin
				// @ts-expect-error obsidian typings do not expose this internal API
				await plugin.app.plugins.disablePlugin(plugin.manifest.id);
				console.log(`插件已禁用: ${plugin.manifest.id}`);

				// Enable plugin
				// @ts-expect-error obsidian typings do not expose this internal API
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

		// Clean temp directory even when error occurs
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


export class MobileSettingTab extends PluginSettingTab {
	plugin: Plugin & { settings: InfioSettings; setSettings: (s: InfioSettings) => Promise<void> }

	constructor(app: App, plugin: Plugin & { settings: InfioSettings; setSettings: (s: InfioSettings) => Promise<void> }) {
		super(app, plugin)
		this.plugin = plugin
 	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		// Title
		const title = containerEl.createEl('h2', { text: 'Infio Mobile' })
 		title.style.marginBottom = '8px'

 		// Description
		const descEl = containerEl.createEl('div')
		descEl.appendText('移动端需要会员才能使用，需要填入 API Key 然后点击升级Pro按钮 ')
		descEl.createEl('a', { text: '获取 API Key', href: 'https://infio.app/keys', attr: { target: '_blank' } })

 		new Setting(containerEl)
 			.setName('Infio API Key')
 			.setDesc('用于验证并下载移动端正式版本')
 			.addText((text) => {
 				text
 					.setPlaceholder('sk-...')
 					.setValue(this.plugin.settings?.infioProvider?.apiKey || '')
 					.onChange(async (value) => {
 						await this.plugin.setSettings({
 							...this.plugin.settings,
 							infioProvider: {
 								...(this.plugin.settings?.infioProvider || { name: 'Infio', apiKey: '', baseUrl: '', useCustomUrl: false, models: [] }),
 								apiKey: value,
 							},
 							// Compatibility field
 							infioApiKey: value,
 						})
 					})
 			})

		// Upgrade to Pro button
		new Setting(containerEl)
			.setName('升级到Pro')
			.setDesc('填写 API Key 后点击下载并升级到正式移动版')
			.addButton((button) => {
				button.setButtonText('升级到Pro').onClick(async () => {
					const originalText = button.buttonEl.textContent || '升级到Pro'
					button.setDisabled(true)
					button.setButtonText('加载中...')
					try {
						const apiKey = this.plugin.settings?.infioProvider?.apiKey || this.plugin.settings?.infioApiKey || ''
						if (!apiKey) {
							if (this.app) {
								new ApiKeyModal(this.app).open()
							} else {
								new Notice('请先在Infio Provider设置中配置 Infio API Key')
							}
							return
						}

						const userPlan = await fetchUserPlan(apiKey)
						const plan = (userPlan.plan || '').toLowerCase()
						const isProUser = plan.startsWith('pro')
						const isGeneralUser = plan.startsWith('general')
						let dl_zip = userPlan.dl_zip || ''

						if (!isProUser && !isGeneralUser) {
							if (this.app) {
								new ProUpgradeModal(this.app).open()
							} else {
								new Notice('您的账户不是会员用户, 请先购买会员')
							}
							return
						}

						if (isGeneralUser) {
							const result = await checkGeneral(apiKey)
							if (!result.success) {
								if (this.app) {
									new ProUpgradeModal(this.app).open()
								} else {
									new Notice('您的账户不是会员用户, 请先购买会员')
								}
								return
							}
							dl_zip = result.dl_zip || dl_zip
						}

						if (Platform.isMobile) {
							dl_zip = dl_zip.replace('.zip', '.mobile.zip')
						}

						if (!dl_zip) {
							new Notice('无法获取下载地址，请稍后再试')
							return
						}

						const result = await upgradeToProVersion(this.plugin, dl_zip)
						if (!result.success) {
							new Notice(`加载失败: ${result.message}`)
						}
					} catch (_error) {
						new Notice('升级过程中发生错误')
						console.error(_error)
					} finally {
						button.setDisabled(false)
						button.setButtonText(originalText)
					}
				})
			})
 		; // keep style
 	}
}

export async function loadMobile(base: Plugin) {
 	const plugin = base as Plugin & {
 		settings: InfioSettings
 		loadSettings: () => Promise<void>
 		setSettings: (s: InfioSettings) => Promise<void>
 	}

 	plugin.loadSettings = async function () {
 		this.settings = parseInfioSettings(await this.loadData())
 		await this.saveData(this.settings)
 	}

 	plugin.setSettings = async function (newSettings: InfioSettings) {
 		this.settings = newSettings
 		await this.saveData(newSettings)
 	}

 	await plugin.loadSettings()

 	// Only settings tab
 	plugin.addSettingTab(new MobileSettingTab(plugin.app, plugin))
}

export function unloadMobile(_base: Plugin) {
 	// nothing to cleanup in lite mobile
}


