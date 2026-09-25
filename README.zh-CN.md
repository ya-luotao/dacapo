# dacapo

[English](README.md) · 简体中文 · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) ·
[한국어](README.ko.md)

_Da capo_——“从头开始”。

dacapo 是一个开源的钢琴练习网页应用，配合 MIDI 键盘使用：在真正的大谱表上做识谱练习，记录你每个音的反应时间，用热力图标出最薄弱的音，还能在真正的乐谱上练曲子（等待模式和节奏模式）。所有数据都只保存在你的浏览器里。

**在线试用：** [ya-luotao.github.io/dacapo](https://ya-luotao.github.io/dacapo/)——无需安装，无需注册。

## 功能

- **识谱卡片**：大谱表上出现一个音，在琴上弹出它，八度也要对。七个级别，从中央 C 位置到加线和升降号；每次作答都记录对错和用时，下一张会优先出你慢或不熟的音。
- **薄弱音热力图**：在五线谱或键盘上，按你找到每个音的速度着色。
- **曲目练习**：内置六首公版曲目，也可以导入自己的 MusicXML。等待模式下光标会等你弹对；节奏模式有节拍器，弹完告诉你偏早还是偏晚、在哪几小节越弹越快。
- **节拍器**：梅尔策尔式摆锤在你听到的拍点正好摆过中线，滑块位置随速度升降；20–300 BPM，敲击测速、拍号、重音与静音拍、细分、三种音色、只看不响，还有逐渐加快和静音小节两种速度训练。弹奏、识谱和练曲时，页头的小按钮就能开关，并可一键设为曲目的速度；节奏模式会先暂停它。
- **练习记录**：今日分钟数、连续打卡天数和最近 30 天的图表。
- 界面支持 English、简体中文、繁體中文、日本語、한국어。音名在所有语言里都用字母（C4、F♯）。

## 使用要求

- 电脑上的 Chrome 或 Edge（支持 Web MIDI）。其他浏览器可以用电脑键盘或鼠标弹。
- MIDI 键盘推荐但不是必需的，用 USB 线连接即可。
- 没有账号，没有服务器。数据可以在“设置”里导出为 JSON 文件备份或迁移。

## 开发

需要 Node.js 22.13 以上和 pnpm（版本见 `package.json` 的 `packageManager`）：

```sh
pnpm install
pnpm dev
```

完整说明以英文 [README](README.md) 为准；参与贡献请看 [CONTRIBUTING.md](CONTRIBUTING.md)（英文），翻译相关请看 [docs/TRANSLATING.md](docs/TRANSLATING.md)。

## 许可证

[MIT](LICENSE)。第三方软件、字体和乐谱的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
