import { QuickPickItem, window, Disposable, QuickInputButton, QuickInput, ExtensionContext, QuickInputButtons } from 'vscode';

export async function multiStepInput(context: ExtensionContext, then: (workTime: number, lyingTime: number, repeat: number, alertMessage: string) => void) {
	type PickItemWithMinute = QuickPickItem & { minute: number };

	function parseMinute(text: string) {
		const number = Number.parseInt(text);
		return number <= 2 ? number * 60 : number;
	}

	const workGroups: PickItemWithMinute[] = ['20分钟', '25分钟', '30分钟', '45分钟', '1小时', '2小时']
		.map(label => ({ label, minute: parseMinute(label) }));
	const lyingGroups: PickItemWithMinute[] = ['3分钟', '5分钟', '10分钟', '15分钟', '20分钟', '30分钟', '1小时']
		.map(label => ({ label, minute: parseMinute(label) }));

	interface State {
		title: string;
		step: number;
		totalSteps: number;
		workTime: PickItemWithMinute;
		lyingTime: PickItemWithMinute;
		repeatCount: number;
	}

	async function collectInputs() {
		const state = {
			step: 1, // 初始化为第一步
		} as Partial<State>;
		await MultiStepInput.run(input => pickTime(input, state));
		return state as State;
	}

	const title = '配置番茄钟';

	async function pickTime(input: MultiStepInput, state: Partial<State>) {
		const first = state.step === 1;
		const pick: PickItemWithMinute = await input.showQuickPick({
			title,
			step: state.step!,
			totalSteps: 3,
			placeholder: first ? '请选择工作阶段时长' : '请选择躺平时长',
			items: first ? workGroups : lyingGroups,
			shouldResume: shouldResume
		});
		if (first) {
			state.workTime = pick;
		} else {
			state.lyingTime = pick;
		}
		if (state.step === 2) {
			return (input: MultiStepInput) => inputRepeat(input, state);
		}
		state.step!++;
		return pickTime(input, state);
	}

	async function inputRepeat(input: MultiStepInput, state: Partial<State>) {
		const repeatCount = await input.showInputBox({
			title,
			step: 3,
			totalSteps: 3,
			value: '',
			prompt: '请输入循环次数，留空代表不限次数',
			validate: validateNameIsUnique,
			shouldResume: shouldResume
		});
		state.repeatCount = repeatCount ? parseInt(repeatCount) : -1;
	}

	function shouldResume() {
		return new Promise<boolean>((resolve, reject) => {
		});
	}

	async function validateNameIsUnique(name: string) {
		await new Promise(resolve => setTimeout(resolve, 1000));
		return name === 'vscode' ? 'Name not unique' : undefined;
	}

	const state = await collectInputs();
	const repeatDesc = '  ' + (state.repeatCount === -1 ? '无限循环' : `循环${state.repeatCount}次`);
	const alertMessage = `番茄钟状态：${repeatDesc} - 工作${state.workTime.label} - 躺平${state.lyingTime.label}`;
	then(state.workTime.minute, state.lyingTime.minute, state.repeatCount, alertMessage);
}

class InputFlowAction {
	static back = new InputFlowAction();
	static cancel = new InputFlowAction();
	static resume = new InputFlowAction();
}

type InputStep = (input: MultiStepInput) => Thenable<InputStep | void>;

interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	ignoreFocusOut?: boolean;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}

interface InputBoxParameters {
	title: string;
	step: number;
	totalSteps: number;
	value: string;
	prompt: string;
	validate: (value: string) => Promise<string | undefined>;
	buttons?: QuickInputButton[];
	ignoreFocusOut?: boolean;
	placeholder?: string;
	shouldResume: () => Thenable<boolean>;
}

class MultiStepInput {

	static async run<T>(start: InputStep) {
		const input = new MultiStepInput();
		return input.stepThrough(start);
	}

	private current?: QuickInput;
	private steps: InputStep[] = [];

	private async stepThrough<T>(start: InputStep) {
		let step: InputStep | void = start;
		while (step) {
			this.steps.push(step);
			if (this.current) {
				this.current.enabled = false;
				this.current.busy = true;
			}
			try {
				step = await step(this);
			} catch (err) {
				if (err === InputFlowAction.back) {
					this.steps.pop();
					step = this.steps.pop();
				} else if (err === InputFlowAction.resume) {
					step = this.steps.pop();
				} else if (err === InputFlowAction.cancel) {
					step = undefined;
				} else {
					throw err;
				}
			}
		}
		if (this.current) {
			this.current.dispose();
		}
	}

	async showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, ignoreFocusOut, placeholder, buttons, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createQuickPick<T>();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.ignoreFocusOut = ignoreFocusOut ?? false;
				input.placeholder = placeholder;
				input.items = items;
				if (activeItem) {
					input.activeItems = [activeItem];
				}
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidChangeSelection(items => resolve(items[0])),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}

	async showInputBox<P extends InputBoxParameters>({ title, step, totalSteps, value, prompt, validate, buttons, ignoreFocusOut, placeholder, shouldResume }: P) {
		const disposables: Disposable[] = [];
		try {
			return await new Promise<string | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
				const input = window.createInputBox();
				input.title = title;
				input.step = step;
				input.totalSteps = totalSteps;
				input.value = value || '';
				input.prompt = prompt;
				input.ignoreFocusOut = ignoreFocusOut ?? false;
				input.placeholder = placeholder;
				input.buttons = [
					...(this.steps.length > 1 ? [QuickInputButtons.Back] : []),
					...(buttons || [])
				];
				let validating = validate('');
				disposables.push(
					input.onDidTriggerButton(item => {
						if (item === QuickInputButtons.Back) {
							reject(InputFlowAction.back);
						} else {
							resolve(<any>item);
						}
					}),
					input.onDidAccept(async () => {
						const value = input.value;
						input.enabled = false;
						input.busy = true;
						if (!(await validate(value))) {
							resolve(value);
						}
						input.enabled = true;
						input.busy = false;
					}),
					input.onDidChangeValue(async text => {
						const current = validate(text);
						validating = current;
						const validationMessage = await current;
						if (current === validating) {
							input.validationMessage = validationMessage;
						}
					}),
					input.onDidHide(() => {
						(async () => {
							reject(shouldResume && await shouldResume() ? InputFlowAction.resume : InputFlowAction.cancel);
						})()
							.catch(reject);
					})
				);
				if (this.current) {
					this.current.dispose();
				}
				this.current = input;
				this.current.show();
			});
		} finally {
			disposables.forEach(d => d.dispose());
		}
	}
}
