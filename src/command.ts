import {
  window,
  ProgressLocation,
  ExtensionContext,

} from 'vscode';
import { formatSeconds } from './utils';
import { showInputBox, showQuickPick } from './basicInput';
import { multiStepInput } from './multiStepInput';

let interval: NodeJS.Timeout | undefined;
let lying = false; // 躺平状态
let mode = 0; // 0：躺平 1：番茄钟
let repeat = -1;

/**
 * 躺平结束收尾工作
 * 总要有人替你负重前行
 */
export function finished(message: string | undefined = undefined, type: string = 'info') {
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

type ProgressHandler = (progress: any, token: any, workTime: number, lyingTime: number) => Thenable<void>;

export function lyingAlert(event: any) {
  lying && event && window.showErrorMessage('现在是躺平时间，去休息吧！', { modal: true });
}

function doProgress(lyingState: boolean, workTime: number, lyingTime: number, handler: ProgressHandler) {
  lying = lyingState;
  window.withProgress({
    location: ProgressLocation.Notification,
    cancellable: lyingState
  }, (progress, token) => handler(progress, token, workTime, lyingTime));
}

const workHandler = (progress: any, _: any, workTime: number, lyingTime: number) => {
  const totalSecond = workTime * 60;
  let second = totalSecond;
  progress.report({ message: '开始工作' });

  interval = setInterval(() => {
    const time = formatSeconds(second - 1);
    const percent = (totalSecond - second - 1) / totalSecond * 10;
    progress.report({ message: `您的工作阶段还有 ${time}` });
    second--;
  }, 1000);

  const p = new Promise<void>(resolve => {
    setTimeout(() => {
      if (interval) {
        doProgress(true, workTime, lyingTime, lyingHandler);
      }
      resolve();
    }, second * 1000);
  });

  return p;
};

const lyingHandler = (progress: any, token: any, lyingTime: number = 15, workTime?: number) => {
  const totalSecond = lyingTime * 60; // 躺平时长：默认15分钟
  let second = totalSecond;
  token.onCancellationRequested(() => {
    finished('躺平大业，中道崩阻，你是真卷啊！', 'warn');
  });
  progress.report({ message: '开始躺平' });

  interval = setInterval(() => {
    const time = formatSeconds(second - 1);
    const percent = (totalSecond - second - 1) / totalSecond * 10;
    progress.report({ message: `您的躺平阶段还有 ${time}` });
    second--;
  }, 1000);

  const p = new Promise<void>(resolve => {
    setTimeout(() => {
      if (interval) {
        if (mode === 0) {
          finished('躺平结束，继续愉快地Coding~');
          return;
        }

        if (repeat > 0) {
          repeat--; // 番茄钟循环次数减1
          doProgress(false, workTime ?? 1, lyingTime, workHandler);
        } else {
          finished('番茄钟结束了，继续愉快地Coding吧！', 'warn');
        }
      }
      resolve();
    }, second * 1000);
  });

  return p;
};

export default (context: ExtensionContext) => {
  // 处于躺平状态时，不再响应躺平指令
  if (!interval) {
    const options: { [key: string]: (context: ExtensionContext) => Promise<string | void> } = {
      立即躺平: showInputBox,
      番茄钟: (context: ExtensionContext) => multiStepInput(context, (workTime: number, lyingTime: number, repeatCount: number) => {
        mode = 1;
        repeat = --repeatCount;
        doProgress(false, workTime, lyingTime, workHandler);
      })
    };
    const quickPick = window.createQuickPick();
    quickPick.items = Object.keys(options).map(label => ({ label }));
    quickPick.onDidChangeSelection(selection => {
      if (selection[0]) {
        options[selection[0].label](context)
          .then((text) => {
            if (selection[0].label === '立即躺平') {
              mode = 0;
              doProgress(true, 1, Number.parseInt(text ?? '1'), workHandler);
            }
          })
          .catch(console.error);
      }
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  } else {
    window.showWarningMessage('躺平中，勿Cue！', { modal: true });
  }
};