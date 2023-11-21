import { window } from 'vscode';

export async function showQuickPick() {
	let i = 0;
	const result = await window.showQuickPick(['eins', 'zwei', 'drei'], {
		placeHolder: 'eins, zwei or drei',
		onDidSelectItem: item => window.showInformationMessage(`Focus ${++i}: ${item}`)
	});
	window.showInformationMessage(`Got: ${result}`);
}

export async function showInputBox() {
	return window.showInputBox({
			valueSelection: [1, 120],
			placeHolder: '请输入躺平时间（分钟数：1~120）',
			validateInput: text => {
				if (text === '') {
					return '躺平时间不得为空';
				}

				const minute = Number.parseInt(text);
				if (Number.isNaN(minute)) {
					return '请输入数字';
				}

				if (minute > 120 || minute < 1) {
					return '请输入 1~120 之间的数字';
				}
				return null;
			},
		});
}
