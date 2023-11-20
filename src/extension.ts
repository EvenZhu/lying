import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "helloworld" is now active!');

	let disposable = vscode.commands.registerCommand('helloworld.helloWorld', () => {
		vscode.window.showInformationMessage('这是一个新的插件!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}
