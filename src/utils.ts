import dayjs from 'dayjs';

export function formatSeconds(seconds: number) {
  const minute = 60;
  const hour = 60 * minute;
  const minuteStr = dayjs().minute(~~(seconds / minute)).format('m');
  const secondStr = dayjs().second(~~(seconds % 60)).format('s');
  const hourStr = dayjs().hour(~~(seconds / hour)).format('H');
  return `${hourStr === '0' ? '' : hourStr + '小时'}${hourStr === '0' && minuteStr === '0' ? '' : minuteStr + '分钟'}${secondStr + '秒'}`;
}