import type { Dictionary } from './en.ts';

export const zhCN: Dictionary = {
  'app.name': 'dacapo',
  'app.tagline': '看谱，找键。',
  'nav.label': '主导航',
  'nav.play': '弹奏',
  'nav.read': '识谱',
  'nav.progress': '进度',
  'nav.settings': '设置',

  'play.title': '弹奏',
  'play.readout.label': '音符',
  'play.readout.empty': '弹一个音试试',
  'play.readout.last': '刚才弹的',
  'play.sustain': '延音踏板',
  'play.sustain.down': '踏板踩下',
  'play.sustain.up': '踏板松开',

  'piano.label': '钢琴键盘，A0 到 C8',
  'piano.key.black': '{sharp} / {flat}',
  'piano.key.middleC': '{name}，中央 C',

  'midi.status.pending': '正在查找 MIDI 设备…',
  'midi.status.unsupported': '此浏览器不支持 MIDI',
  'midi.status.noPermission': 'MIDI 访问被阻止',
  'midi.status.noDevice': '未连接 MIDI 键盘',
  'midi.status.connected': '已连接：{names}',
  'midi.unnamedDevice': 'MIDI 设备',
  'midi.help.unsupported':
    '此浏览器无法连接 MIDI 键盘。请在电脑上使用 Chrome 或 Edge，也可以先用电脑键盘弹奏。',
  'midi.help.noPermission':
    'dacapo 需要 MIDI 设备权限。请在浏览器的网站设置中允许此网站使用 MIDI，然后重试。',
  'midi.help.noDevice': '用 USB 线连接键盘并打开电源，连接后会自动显示在这里。',
  'midi.retry': '重试',

  'keys.title': '没有 MIDI 键盘？用电脑键盘弹',
  'keys.body': '中间一排字母键弹白键，上面一排弹黑键。',
  'keys.octave': '八度',
  'keys.octaveDown': '降低',
  'keys.octaveUp': '升高',
  'keys.range': '当前音域：{low} 到 {high}',
  'keys.offPiano': '超出钢琴音域',

  'read.title': '识谱',
  'read.placeholder': '这里将显示识谱卡片：大谱表上出现一个音符，你在琴上按出对应的键。',
  'progress.title': '进度',
  'progress.placeholder': '开始练习后，这里会显示你的练习记录和每个音符的薄弱点分布。',

  'settings.title': '设置',
  'settings.language': '语言',
  'settings.language.help': '默认跟随浏览器语言，也可以在这里手动选择。',
  'settings.language.system': '跟随浏览器',
  'settings.theme': '外观',
  'settings.theme.help': '默认跟随系统设置，也可以在这里手动选择。',
  'settings.theme.system': '跟随系统',
  'settings.theme.light': '浅色',
  'settings.theme.dark': '深色',

  'notFound.title': '页面不存在',
  'notFound.back': '返回弹奏',
};
