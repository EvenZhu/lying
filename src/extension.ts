import {
	ExtensionContext,
	window,
	commands,
	workspace
} from 'vscode';
import command, { finished, lyingAlert } from './command';

export function activate(context: ExtensionContext) {
	context.subscriptions.push(commands.registerCommand('evenzhu.lying', command));

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
}

export function deactivate() {
	finished();
}
