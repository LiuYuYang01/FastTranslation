// 'vscode' 模块包含 VS Code 扩展性 API
// 在下面的代码中导入模块并使用 vscode 作为别名引用它
import * as vscode from 'vscode';
import * as crypto from 'crypto';

// 百度翻译API配置
const BAIDU_API_URL = 'http://api.fanyi.baidu.com/api/trans/vip/translate';

// 获取配置
function getConfig() {
	const config = vscode.workspace.getConfiguration('lyy');
	return {
		appId: config.get<string>('baiduAppId') || '',
		key: config.get<string>('baiduKey') || ''
	};
}

// 检查配置是否有效
function checkConfig() {
	const config = getConfig();
	if (!config.appId || !config.key) {
		vscode.window.showErrorMessage('请先在设置中配置相关信息');
		return false;
	}
	return true;
}

// 定义百度翻译API响应类型
interface BaiduTranslateResponse {
	from: string;
	to: string;
	trans_result: Array<{
		src: string;
		dst: string;
	}>;
	error_code?: string;
	error_msg?: string;
}

// 生成百度翻译API签名
function generateSign(text: string, salt: number): string {
	const config = getConfig();
	const str = config.appId + text + salt + config.key;
	return crypto.createHash('md5').update(str).digest('hex');
}

// 调用百度翻译API
async function translateText(text: string, from: string = 'auto', to: string = 'auto'): Promise<string> {
	if (!checkConfig()) throw new Error('请先配置百度翻译 API');

	const config = getConfig();
	const salt = Date.now();
	const sign = generateSign(text, salt);
	
	const params = new URLSearchParams({
		q: text,
		from,
		to,
		appid: config.appId,
		salt: salt.toString(),
		sign: sign
	});

	try {
		const response = await fetch(`${BAIDU_API_URL}?${params.toString()}`);
		const jsonData = await response.json();
		const data = jsonData as BaiduTranslateResponse;
		
		if (data.error_code) {
			throw new Error(`翻译失败: ${data.error_msg}`);
		}
		
		return data.trans_result[0].dst;
	} catch (error: unknown) {
		if (error instanceof Error) {
			throw new Error(`翻译请求失败: ${error.message}`);
		} else {
			throw new Error('翻译请求失败: 未知错误');
		}
	}
}

// 当扩展被激活时调用此方法
// 扩展在第一次执行命令时被激活
export function activate(context: vscode.ExtensionContext) {
	// 注册配置变更事件监听
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('lyy.baiduAppId') || e.affectsConfiguration('lyy.baiduKey')) {
				const config = getConfig();
				if (!config.appId || !config.key) {
					vscode.window.showWarningMessage('请完成百度翻译相关配置');
				} else {
					vscode.window.showInformationMessage('百度翻译配置已更新');
				}
			}
		})
	);

	// commandId 参数必须与 package.json 中的 command 字段匹配
	const disposable = vscode.commands.registerCommand('lyy.helloWorld', () => {
		// 放在这里的代码将在每次执行命令时执行
		vscode.window.showInformationMessage('欢迎使用极速翻译助手');
	});

	// 注册翻译并替换文本的命令
	const translateCommand = vscode.commands.registerCommand('lyy.translate', async () => {
		const editor = vscode.window.activeTextEditor;
		
		if (editor) {
			const selection = editor.selection;
			const text = editor.document.getText(selection);
			
			if (text) {
				try {
					await vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "正在翻译中，请稍后...",
						cancellable: false
					}, async (progress) => {
						try {
							progress.report({ message: "正在调用百度翻译API..." });
							
							const translatedText = await translateText(text, 'en', 'zh');
							
							try {
								vscode.window.showInformationMessage(`翻译结果: ${translatedText}`);
							} catch (notificationError) {
								console.log('通知显示失败，可能是通道已关闭');
							}
						} catch (progressError) {
							console.error('翻译过程中发生错误:', progressError);
							throw progressError;
						}
					});
				} catch (error: unknown) {
					if (error instanceof Error) {
						try {
							vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
						} catch (notificationError) {
							console.error('错误通知显示失败:', notificationError);
						}
					} else {
						try {
							vscode.window.showErrorMessage('翻译失败: 未知错误');
						} catch (notificationError) {
							console.error('错误通知显示失败:', notificationError);
						}
					}
				}
			}
		}
	});

	// 注册中文到英文的翻译命令
	const translateToEnglishCommand = vscode.commands.registerCommand('lyy.translateTo', async () => {
		const editor = vscode.window.activeTextEditor;
		
		if (editor) {
			const selection = editor.selection;
			const text = editor.document.getText(selection);
			
			if (text) {
				try {
					await vscode.window.withProgress({
						location: vscode.ProgressLocation.Notification,
						title: "正在翻译成英文...",
						cancellable: false
					}, async (progress) => {
						try {
							progress.report({ message: "正在调用百度翻译API..." });
							
							const translatedText = await translateText(text);
							
							await editor.edit(editBuilder => {
								editBuilder.replace(selection, translatedText);
							});
							
							try {
								vscode.window.showInformationMessage('翻译并替换成功！');
							} catch (notificationError) {
								console.log('通知显示失败，可能是通道已关闭');
							}
						} catch (progressError) {
							console.error('翻译过程中发生错误:', progressError);
							throw progressError;
						}
					});
				} catch (error: unknown) {
					if (error instanceof Error) {
						try {
							vscode.window.showErrorMessage(`翻译失败: ${error.message}`);
						} catch (notificationError) {
							console.error('错误通知显示失败:', notificationError);
						}
					} else {
						try {
							vscode.window.showErrorMessage('翻译失败: 未知错误');
						} catch (notificationError) {
							console.error('错误通知显示失败:', notificationError);
						}
					}
				}
			} else {
				try {
					vscode.window.showInformationMessage('没有选中任何文本');
				} catch (notificationError) {
					console.log('通知显示失败，可能是通道已关闭');
				}
			}
		} else {
			try {
				vscode.window.showInformationMessage('没有打开任何编辑器');
			} catch (notificationError) {
				console.log('通知显示失败，可能是通道已关闭');
			}
		}
	});

	context.subscriptions.push(disposable, translateCommand, translateToEnglishCommand);
}

// 当扩展被停用时调用此方法
export function deactivate() {}