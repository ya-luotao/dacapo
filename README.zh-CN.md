# dacapo

[English](README.md) · 简体中文 · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) ·
[한국어](README.ko.md)

_Da capo_——“从头开始”。

**在真正的乐谱上，用 MIDI 键盘练钢琴。** dacapo 在大谱表上练识谱，为每次作答计时，哪些音、哪几小节、哪条音阶让你慢下来，就多练哪些。它在浏览器里运行，免费开源，数据保存在你自己的设备上。

**[打开 playdacapo.com →](https://playdacapo.com/zh-cn/)** 电脑上的 Chrome 或 Edge，用 USB 连接 MIDI 键盘，或者直接用电脑键盘。无需安装，无需注册。

<p>
  <img src="docs/images/read.webp" alt="大谱表上的一张识谱卡片：低音谱表上一个音，下方是钢琴键盘" width="32%">
  <img src="docs/images/pieces-rhythm-sheet.webp" alt="节奏模式弹完《欢乐颂》后：多少个音合拍，以及每个音的图表" width="32%">
  <img src="docs/images/heatmap-staff.webp" alt="大谱表上的薄弱音热力图，以及其中一个音的详情" width="32%">
</p>

## 能做什么

- **识谱**：大谱表上一次一个音，分级练习；还有音程、调号、和弦、跟着拍子打节奏，以及从没见过的短曲视奏。每次作答都计时，下一题优先出你慢的。
- **曲目**：三十一首公版曲目，从入门到约五级，也可以导入自己的 MusicXML。乐谱会等你弹对，也可以跟着拍子走，弹完告诉你哪里赶了拍；循环、分手、速度阶梯、背谱模式和复习计划。
- **音阶与技巧**：各调音阶和琶音，标有哈农指法，还有照原书排印的哈农练习，逐音测量时间、力度和连奏的均匀度。
- **练耳与和声**：靠耳朵辨认音程、和弦、旋律和节奏；照和弦记号弹和弦；任意调的和弦进行；跟着伴奏即兴。
- **计划与记录**：十五节入门课，按你自己的记录排出的当天计划，薄弱音热力图，练习记录，以及老师可以用链接布置的作业。

全部功能，按练习分项：[docs/FEATURES.zh-CN.md](docs/FEATURES.zh-CN.md)。

## 原则

- **真正的乐谱，不是下落的音块。** 要练的是读印刷的乐谱：用 Verovio 和 VexFlow 以 Bravura 字体刻谱。
- **先测量，再解释。** 每遍弹完的建议由规则根据测量结果给出，并说明理由（[docs/ADVICE.md](docs/ADVICE.md)），不发送给任何模型。
- **数据属于你。** 保存在浏览器里（IndexedDB），随时可以导出成文件；只有登录后才在你自己的设备之间同步（[docs/SYNC.md](docs/SYNC.md)）。网站统计访问量不用 cookie，你的练习记录不会被擅自送出设备。
- **离线可用**：打开过一次后没有网络也能用（[docs/OFFLINE.md](docs/OFFLINE.md)），也不从任何 CDN 加载内容。
- **五种语言**：English、简体中文、繁體中文、日本語、한국어，各有自己的谱表和键盘术语与字体。

## 使用要求

- 电脑上的 Chrome 或 Edge（支持 Web MIDI）。其他浏览器可以用电脑键盘或屏幕上的琴键弹。
- MIDI 键盘推荐但不是必需的。不足 88 键的键盘也能用：在“设置 → 声音 → 你的键盘”里设置。
- 乐器通过 MIDI 发声；乐器没有 MIDI 输出时，由内置的采样三角钢琴（Salamander Grand Piano）发声。避免用蓝牙耳机：延迟变化太大，无法校准。

## 状态

版本 0.2.0。以上功能都已完成、经过测试并已上线；每个版本的内容见 [CHANGELOG.md](CHANGELOG.md)。已知的限制：

- 力度、踏板和按键时长的评判使用暂定阈值，等用真实乐器录下的演奏来确定。
- 日语、韩语和繁体中文文本还在等母语者审阅。
- Apple app（[docs/APPLE.md](docs/APPLE.md)）用同一套代码构建，还没有上架 App Store。

欢迎报告问题。

## 开发

需要 Node.js 22.13 以上和 pnpm（版本见 `package.json` 的 `packageManager`）：

```sh
pnpm install
pnpm dev
```

完整说明以英文 [README](README.md) 为准；参与贡献请看 [CONTRIBUTING.md](CONTRIBUTING.md)（英文），翻译相关请看 [docs/TRANSLATING.md](docs/TRANSLATING.md)。

## 许可证

[MIT](LICENSE)。第三方软件、字体和乐谱的许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
