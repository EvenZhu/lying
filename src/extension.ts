import {
	ExtensionContext,
	window,
	commands,
	ProgressLocation,
	workspace
} from 'vscode';
import dayjs from 'dayjs';

let interval: NodeJS.Timeout | undefined;
let lying = false; // 躺平状态

/**
 * 躺平结束收尾工作
 * 总要有人替你负重前行
 */
function finished(message: string | undefined = undefined, type: string = 'info') {
	interval && clearInterval(interval), interval = undefined;
	lying = false;
	if (message) {
		switch (type) {
			case 'error':
				window.showWarningMessage(message, { modal: true });
				break;
			case 'warn':
				window.showWarningMessage(message, { modal: true });
				break;
			default:
				window.showInformationMessage(message, { modal: true });
				break;
		}
	}
}

function formatSeconds(seconds: number) {
	const minute = 60;
	const hour = 60 * minute;
	const minuteStr = dayjs().minute(~~(seconds / minute)).format('mm');
	const secondStr = dayjs().second(~~(seconds % 60)).format('ss');
	const hourStr = dayjs().hour(~~(seconds / hour)).format('HH');
	return `${hourStr === '00' ? '' : hourStr + '小时'}${hourStr === '00' && minuteStr === '00' ? '' : minuteStr + '分钟'}${secondStr + '秒'}`;
}

export function activate(context: ExtensionContext) {
	const dis = commands.registerCommand('lying.lying', () => {
		// 处于躺平状态时，不再响应躺平指令
		if (!interval) {
			const totalSecond = 15 * 60; // 躺平时长：默认15分钟 - 后续支持自定义
			let second = totalSecond;
			lying = true;
			window.withProgress({
				location: ProgressLocation.Notification,
				cancellable: true
			}, (progress, token) => {
				token.onCancellationRequested(e => {
					finished('躺平大业，中道崩阻，你是真卷啊！', 'warn');
				});
				progress.report({ message: '开始躺平' });

				interval = setInterval(() => {
					const time = formatSeconds(second - 1);
					const percent = (totalSecond - second - 1) / totalSecond * 10;
					progress.report({ message: `您还得躺平 ${time}` });
					second--;
				}, 1000);

				const p = new Promise<void>(resolve => {
					setTimeout(() => {
						if (interval) {
							finished('躺平结束，继续愉快地Coding~');
						}
						resolve();
					}, second * 1000);
				});

				return p;
			});
		} else {
			window.showWarningMessage('躺平中，勿Cue！', { modal: true });
		}
	});

	context.subscriptions.push(dis);

	/**
	 * 监听编辑器焦点变化和输入事件
	 * 为了让你实现真正意义上的躺平，真是操碎了心
	 */
	context.subscriptions.push(window.onDidChangeActiveTextEditor(event => {
		lyingAlert(event);
	}));

	context.subscriptions.push(workspace.onDidChangeTextDocument((event) => {
		lyingAlert(event);
	}));

	function lyingAlert(event: any) {
		lying && event && window.showErrorMessage('现在是躺平时间，去休息吧！', { modal: true });
	}
}

export function deactivate() {
	finished();
}
