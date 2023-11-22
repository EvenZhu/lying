import {
  window,
  ProgressLocation,
  ExtensionContext
} from 'vscode';
import { formatSeconds } from './utils';
import { showInputBox } from './basicInput';
import { multiStepInput } from './multiStepInput';

let interval: NodeJS.Timeout | undefined;
let lying = false; // 躺平状态
let mode = 0; // 0：躺平 1：番茄钟
let repeat = -1;
let alertMessage: string | undefined;

let repeatCountThenable: any;
let repeatCountProgress: any;
let repeatCountResolve: any;

/**
 * 躺平结束收尾工作
 * 总要有人替你负重前行
 */
export function finished(message: string | undefined = undefined, type: string = 'info') {
  interval && clearInterval(interval), interval = undefined;
  if (lying) {
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
}

export function lyingAlert(event: any) {
  lying && event && window.showErrorMessage('现在是躺平时间，去休息吧！', { modal: true });
}

function showRepeatCount() {
  if (!repeatCountThenable) {
    repeatCountThenable = window.withProgress({
      location: ProgressLocation.Notification,
      cancellable: false
    }, (progress) => {
      repeatCountProgress = progress;
      progress.report({ message: `${alertMessage!}  >>  剩余${repeat}次` });
      return new Promise<void>(resolve => {
        repeatCountResolve = resolve;
      });
    });
  } else {
    repeatCountProgress.report({ message: `${alertMessage!}  >>  剩余${repeat}次` });
  }
}

function doProgress(lyingState: boolean, workTime?: number, lyingTime?: number) {
  if (!lyingState && repeat !== -1) {
    showRepeatCount();
  }
  lying = lyingState;
  window.withProgress({
    location: ProgressLocation.Notification,
    title: lyingState ? '躺平阶段' : '工作阶段',
    cancellable: lyingState
  }, (progress, token) => progressHandler(lyingState, progress, token, workTime, lyingTime));
}

const handlerPromise = (lyingState: boolean, second: number, workTime?: number, lyingTime?: number) => {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      if (interval) {
        if (!lyingState) {
          doProgress(true, workTime, lyingTime);
          resolve();
          return;
        }

        if (mode === 0) {
          finished('躺平结束，继续愉快地Coding~');
          resolve();
          return;
        }

        if (repeat === -1 || repeat > 1) {
          repeat !== -1 && repeat--; // 番茄钟循环次数减1
          doProgress(false, workTime, lyingTime);
        } else {
          finished('番茄钟结束了，继续愉快地Coding吧！', 'warn');
          repeatCountResolve && repeatCountResolve();
        }
      }
      resolve();
    }, second * 1000);
  });
};

const progressHandler = (lyingState: boolean, progress: any, token: any, workTime?: number, lyingTime?: number) => {
  const totalSecond = (lyingState ? lyingTime! : workTime!) * 60;
  let second = totalSecond;

  if (lyingState) {
    token.onCancellationRequested(() => {
      finished('躺平大业，中道崩阻，你是真卷啊！', 'warn');
      repeatCountResolve && repeatCountResolve();
    });
  }

  const stateName = lyingState ? '躺平' : '工作';
  progress.report({ message: `开始${stateName}` });

  interval = setInterval(() => {
    const time = formatSeconds(second - 1);
    const percent = (totalSecond - second - 1) / totalSecond * 10;
    progress.report({ message: `还有 ${time}` });
    second--;
  }, 1000);

  return handlerPromise(lyingState, totalSecond, workTime, lyingTime);
};

export default (context: ExtensionContext) => {
  // 处于躺平状态时，不再响应躺平指令
  if (!interval) {
    const options: { [key: string]: (context: ExtensionContext) => Promise<string | void> } = {
      立即躺平: showInputBox,
      番茄钟: (context: ExtensionContext) => multiStepInput(context, (workTime: number, lyingTime: number, repeatCount: number, message: string) => {
        mode = 1;
        repeat = repeatCount;
        alertMessage = message;
        doProgress(false, workTime, lyingTime);
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
              doProgress(true, 0, Number.parseInt(text ?? '1'));
            }
          })
          .catch(console.error);
      }
    });
    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  } else {
    window.showWarningMessage(`${mode ? '工作' : '躺平'}中，勿Cue！`, { modal: true });
  }
};