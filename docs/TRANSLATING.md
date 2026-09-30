# Translating dacapo

dacapo is available in English (`en`), Simplified Chinese (`zh-CN`), Traditional Chinese as used
in Taiwan (`zh-TW`), Japanese (`ja`) and Korean (`ko`). This page is for anyone who proofreads a
translation, fixes a string or adds a language.

The goal is the UI a native-speaking piano learner would expect: natural, idiomatic and
consistent, never a word-for-word rendering of the English. If a sentence reads like a
translation, rewrite it.

## Where the strings are

- `src/i18n/en.ts` is the source of truth. Its keys define `MessageKey` and the `Dictionary` type.
- `src/i18n/zh-CN.ts`, `zh-TW.ts`, `ja.ts` and `ko.ts` are typed as `Dictionary`: a missing or an
  extra key is a compile error. Keep the keys in the same order as `en.ts`; a test checks it.
- Only English is part of the main bundle. The other dictionaries are loaded on demand, one chunk
  each (see `LOADERS` in `src/i18n/locale.ts`).
- Components read strings with `useT()`; nothing user-facing is hard-coded.

`pnpm test` checks every dictionary: same keys in the same order, the same placeholders for every
key, no empty strings, every built-in piece named in every language, 「」 quotes in ja and zh-TW,
and no Simplified-only characters in zh-TW.

## Rules for every language

- **Placeholders stay exactly as they are.** `{names}` stays `{names}`: never rename, drop or
  translate one. Move it wherever the sentence needs it.
- **Some strings are pieces of others.** A bar span goes into `pieces.rhythm.faster`, `{stats}` into `read.summary.progress`, `{level}` is a level name, `{time}` is already a formatted
  duration with its unit. Search `src/ui` for the key to see how it is used, then read the whole
  sentence.
- **Note names are letter names in every language**: C4, F♯3, B♭ — scientific pitch notation, C4 =
  middle C (see [MVP.md](MVP.md)). No do-re-mi, no ハニホ, no 다라마, no numbered notation, even
  where learners usually say them. Keys in the titles of built-in pieces follow each language's
  convention for titles (see below); note names in the app never change.
- **Keep product and format names**: dacapo (always lower case), MIDI, MusicXML, MuseScore, USB,
  Chrome, Edge, Web Audio, JSON, BWV, D.C., D.S., Fine, Coda.
- **Controls stay short.** Segmented options, buttons, table headers and the navigation must fit
  on a 375 px phone and keep the practice screens on one 1280 × 800 screen.
- **Plurals**: keys ending in `.one` and `.other` exist because English needs them. Languages
  without plurals still fill both (`1日` / `{n}日`).
- **Lists and sentences**: `app.listSeparator` joins short lists (`, ` or `、`). Whether two
  sentences are joined with a space is set per language in `SENTENCE_GAP` in `locale.ts`.
- **Bar labels are whole templates.** A bar is never "a number inside another string's bar word":
  `pieces.bar.label` is the bar with its word (`bar {bar}`, `{bar}小節目`, `第 {bar} 小節`), and
  `pieces.bar.label.ending`, `.nth` and `.nthEnding` add the volta (`{ending}`, e.g. `1` or `1, 2`)
  and the position in the piece (`{n}`, when a printed number repeats) in your language's order —
  `1番カッコの12小節目`, `第 12 小節（1 房）`. Strings that take `{bar}` from one of them
  (`pieces.done.bar`, `pieces.done.loopBar`, `pieces.status.barRepeat`) must not add a bar word.
  `pieces.bar.number.*` are the same without the word, for pickers and table cells under a "Bar"
  header. `pieces.bar.span` is a plain range (`bars 8–12`); `pieces.bar.span.labels` joins two
  full labels when an end has a volta. English labels are lower case (`bar 12`); the app capitalises
  the first letter where a label starts a line. `src/ui/pieces/format.test.ts` shows the composed
  results in every language.
- **Interval and chord names** (`ear.interval.*`, `ear.chord.*`) are the theory terms your
  language's teaching uses: 大三度, 長3度, 장3도, major 3rd. English writes them in lower case in
  running text; the app capitalises the first letter on a button or a title. In zh, ja and ko the
  `.short` chord names (the answer buttons) may equal the full ones. The tritone (`TT`) is one item
  whether written as an augmented 4th or a diminished 5th, so name it as a tritone.
- **Echo** (`ear.echo.*`, `ear.level.EC*`) is the family of melodies played back. Its tab names
  what is practised, as `Intervals` and `Chords` do: 旋律 (zh, ja), 선율 (ko), not a word for
  singing back (模唱). A melodic interval with its direction (`ear.echo.up`, `ear.echo.down`) is
  said as your teaching says it: 上行纯四度, 上行完全4度, 상행 완전4도, perfect 4th up.
- **Theory cards on Read** (`read.what.*`, `theory.*`): an interval is named from two parts,
  `theory.quality.*` (diminished … augmented) and `theory.number.*` (2nd … octave), joined by
  `theory.interval`. Write the parts so the whole reads as your teaching says it — 增二度, 纯八度,
  増2度, 完全8度, 증2도, 완전8도, augmented 2nd, perfect octave — and so each part stands alone on a
  button (减 / 二度, 減 / 2度, 감 / 2도). A chord is `theory.chordName`: the root as written, then
  the chord (`ear.chord.*`): F♯ 小三和弦, F♯の短三和音, F♯ 단3화음. `theory.inversion.*` are the
  positions shortened for a button; the full ones are `ear.inversion.*`.
- **Numbers, dates and lists of devices** are formatted by `Intl` in the active locale; do not
  write them into strings.

## Adding a language

1. Copy `src/i18n/en.ts` to `src/i18n/<locale>.ts`, export it as `export const xx: Dictionary`, and
   translate every value.
2. In `src/i18n/locale.ts`: add the locale to `LOCALES`, its endonym (the name in its own
   language) to `LOCALE_NAMES`, its entry in `SENTENCE_GAP`, its loader in `LOADERS`, and the tags
   that should pick it in `detectLocale`.
3. In `src/i18n/i18n.test.ts`: add the dictionary to `DICTIONARIES`, the loader to `failing()`,
   the endonym to the names test, and the detection cases.
4. In `src/ui/styles.css`: if the language needs its own fonts, add a `:root:lang(xx)` block with
   `--font-serif` and `--font-sans` (system fonts only; no web fonts are downloaded). Scripts
   without Latin case and letter-spacing conventions (Chinese, Japanese, Korean) also join the
   `:is(:lang(zh), :lang(ja), :lang(ko))` rules.
5. Check the Read session, Pieces practice, Progress and Settings at 1280 × 800 and at 375 px in
   both themes.
6. List the language in `README.md`, and add a section with its tone and glossary below.

## Simplified Chinese (`zh-CN`)

Address the learner as 你. Full-width punctuation, “ ” quotes, 《》 for works; a space between
Chinese and Latin letters, digits and placeholders (`第 {n} 张`, `MIDI 键盘`); `、` for lists.

| English                                     | zh-CN                                    |
| ------------------------------------------- | ---------------------------------------- |
| Read / flashcards                           | 识谱 / 识谱卡片                          |
| grand staff / treble staff / bass staff     | 大谱表 / 高音谱表 / 低音谱表             |
| ledger lines / sharps and flats             | 加线 / 升号和降号                        |
| bar / right, left, both hands               | 小节 / 右手、左手、双手                  |
| sustain pedal / metronome / count-in        | 延音踏板 / 节拍器 / 预备拍               |
| tap tempo / subdivide / tempo trainer       | 敲击测速 / 细分 / 速度训练               |
| accented / muted beat / time signature      | 重音 / 静音 / 拍号                       |
| wait mode / rhythm mode / weak bars         | 等待 / 节奏 / 薄弱小节                   |
| loop / repeat / run                         | 循环 / 反复 / 遍                         |
| latency calibration                         | 延迟校准                                 |
| built-in piano / sound out through          | 内置钢琴 / 声音输出到                    |
| export / import                             | 导出 / 导入                              |
| Scales (the page) / key (tonic)             | 音阶 / 主音                              |
| major / natural, harmonic, melodic minor    | 大调 / 自然、和声、旋律小调              |
| chromatic / fingering / thumb under         | 半音阶 / 指法 / 拇指穿过                 |
| arpeggio / contrary motion / focus loop     | 琶音 / 反向（双手反向）/ 循环练          |
| free tempo / with the click                 | 自由 / 跟节拍器                          |
| timing spread / hesitation / loudness       | 时间波动 / 迟疑 / 力度                   |
| Ear (the page) / question / Hear again      | 练耳 / 题 / 再听一遍                     |
| interval / chord / triad / seventh chord    | 音程 / 和弦 / 三和弦 / 七和弦            |
| minor, major, perfect 2nd … 12th            | 小、大、纯（小二度、大三度、纯五度）     |
| tritone / octave / compound interval        | 三全音 / 纯八度 / 复音程                 |
| up / down / together (an interval)          | 上行 / 下行 / 和声（同时）               |
| major, minor, diminished, augmented triad   | 大三和弦、小三和弦、减三和弦、增三和弦   |
| dominant, major, minor, half-diminished 7th | 属七和弦、大七和弦、小七和弦、半减七和弦 |
| root position / 1st, 2nd inversion / root   | 原位 / 第一转位、第二转位 / 根音         |
| broken / block (a chord)                    | 分解 / 柱式                              |
| Echo (the family) / melody / note 3         | 旋律 / 一段旋律 / 第 3 个音              |
| step / leap / tonic chord                   | 级进 / 跳进 / 主和弦                     |
| chromatic (neighbour, passing) notes        | 变化音（辅助音、经过音）                 |
| played as (a wrong key)                     | 弹成了                                   |
| What to read: notes, intervals (Read)       | 识谱内容：音符、音程                     |
| key signature / tonic / relative minor      | 调号 / 主音 / 关系小调                   |
| diminished, minor, perfect, major, aug.     | 减、小、纯、大、增（增二度、减五度）     |
| quality / number (of an interval)           | 性质 / 度数（二度……八度）                |
| natural notes / double sharp, flat          | 自然音 / 重升、重降                      |
| natural sign / root pos., 1st inv.          | 还原号 / 原位、第一转位                  |

## Traditional Chinese, Taiwan (`zh-TW`)

Written from the English, not converted from zh-CN: Taiwan vocabulary and Taiwan piano-teaching
terms throughout. Address the learner as 你, as zh-CN does.

- Punctuation: full-width ，。：；（）！？; quotes 「」 (nested 『』), never “ ”; `、` for lists;
  《》 for a book or collection and 〈〉 for a piece inside one; `‧` between parts of a foreign name
  (安娜‧瑪德蓮娜‧巴哈).
- Ellipsis: `⋯` at the end of a button or loading state (匯入檔案⋯), `⋯⋯` in running text.
- A space between Chinese and Latin letters, digits and placeholders, as in zh-CN.
- 紀錄 for the noun (練習紀錄), 記錄 for the verb.
- Counters: 張 cards, 首 pieces, 遍 runs, 輪 laps of a loop and rounds within a run, 次 answers,
  個 notes, 筆 records.
- Enharmonic spellings are 同音異名; the Schumann collection is 《青少年曲集》.

| English                                   | zh-TW                                | zh-CN, where different     |
| ----------------------------------------- | ------------------------------------ | -------------------------- |
| Read / flashcards                         | 識譜 / 音符閃卡                      | 识谱 / 识谱卡片            |
| level / mastered                          | 等級 / 已熟練                        | 级别 / 已掌握              |
| grand staff / treble staff / bass staff   | 大譜表 / 高音譜表 / 低音譜表         |                            |
| treble clef / bass clef                   | 高音譜號 / 低音譜號                  |                            |
| ledger lines / sharps and flats           | 加線 / 升降記號                      |                            |
| bar / both hands                          | 小節 / 雙手                          |                            |
| sustain pedal / metronome / count-in      | 延音踏板 / 節拍器 / 預備拍           |                            |
| tap tempo / subdivide / tempo trainer     | 點按測速 / 細分 / 速度訓練           | 敲击测速 / 细分 / 速度训练 |
| speed up / silent bars / time signature   | 漸快 / 靜音小節 / 拍號               | 逐渐加快 / 静音小节 / 拍号 |
| repeat / volta                            | 反覆 / {n} 房                        | 反复                       |
| tie / mordent                             | 連結線 / 漣音                        | 连音线 / 波音              |
| weak bars / calibrate                     | 弱點小節 / 校正                      | 薄弱小节 / 校准            |
| cursor / speakers                         | 游標 / 喇叭                          | 光标 / 音箱                |
| piece / library                           | 樂曲 / 曲庫                          | 曲目 / 曲库                |
| export / import / file / data             | 匯出 / 匯入 / 檔案 / 資料            | 导出 / 导入 / 文件 / 数据  |
| settings / tab / private window           | 設定 / 分頁 / 無痕視窗               | 设置 / 标签页 / 无痕窗口   |
| save / reload / font                      | 儲存 / 重新整理 / 字型               | 保存 / 刷新 / 字体         |
| built-in piano / grand piano              | 內建鋼琴 / 平台鋼琴                  | 内置钢琴 / 三角钢琴        |
| Scales (the page) / key (tonic)           | 音階 / 主音                          | 音阶 / 主音                |
| major / harmonic, melodic minor           | 大調 / 和聲小調、旋律小調            | 大调 / 和声小调、旋律小调  |
| chromatic / fingering / hesitation        | 半音階 / 指法 / 遲疑                 | 半音阶 / 指法 / 迟疑       |
| arpeggio / contrary motion / focus loop   | 琶音 / 反向（雙手反向）/ 循環練      | 双手反向、循环练           |
| free tempo / with the click               | 自由 / 跟節拍器                      | 跟节拍器                   |
| Ear (the page) / question / Hear again    | 練耳 / 題 / 再聽一次                 | 练耳 / 题 / 再听一遍       |
| interval / chord / triad / seventh chord  | 音程 / 和弦 / 三和弦 / 七和弦        |                            |
| minor, major, perfect 2nd … 12th          | 小、大、純（小二度、大三度、純五度） | 纯五度                     |
| tritone / octave / compound interval      | 三全音 / 純八度 / 複音程             | 纯八度 / 复音程            |
| up / down / together (an interval)        | 上行 / 下行 / 和聲（同時）           | 和声（同时）               |
| diminished triad / dominant 7th           | 減三和弦 / 屬七和弦                  | 减三和弦 / 属七和弦        |
| half-diminished 7th                       | 半減七和弦                           | 半减七和弦                 |
| root position / 1st, 2nd inversion / root | 原位 / 第一轉位、第二轉位 / 根音     | 第一转位、第二转位         |
| broken / block (a chord)                  | 分解 / 柱式                          |                            |
| Echo (the family) / melody / note 3       | 旋律 / 一段旋律 / 第 3 個音          | 第 3 个音                  |
| step / leap / tonic chord                 | 級進 / 跳進 / 主和弦                 | 级进 / 跳进                |
| chromatic (neighbour, passing) notes      | 變化音                               | 变化音                     |
| played as (a wrong key)                   | 彈成了                               | 弹成了                     |
| What to read: notes, intervals (Read)     | 識譜內容：音符、音程                 | 识谱内容                   |
| key signature / relative minor            | 調號 / 關係小調                      | 调号 / 关系小调            |
| diminished, perfect, augmented            | 減、純、增（增二度、減五度）         | 减、纯、增                 |
| quality / number (of an interval)         | 性質 / 度數                          | 性质 / 度数                |
| natural notes / double sharp, flat        | 自然音 / 重升、重降記號              | 重升、重降                 |
| natural sign / 1st inversion              | 還原記號 / 第一轉位                  | 还原号 / 第一转位          |

Keys in titles: `G 大調`, `C 大調`. Composers as Taiwan writes them: 貝多芬, 巴哈 (not 巴赫), 舒曼,
布爾格彌勒.

## Japanese (`ja`)

Plain and friendly: です・ます for explanations, 〜してください for requests, bare nouns or short
verb phrases for labels and buttons (設定, 開始, もう一度, 補正する), no 。 after a label.

- No space between Japanese and Latin letters, digits or placeholders: `{n}枚`, `MIDIキーボード`,
  `{ms}ミリ秒`.
- Full-width punctuation: 、。：（）？; 「」 for UI names and quoted titles (「演奏」ページ), 『』
  for books and collections; `、` for lists; ranges with `〜` (`{from}〜{to}小節`).
- Counters: 枚 cards, 曲 pieces, 回 runs and wrong notes, 件 records, 小節 bars (`{bar}小節目`).

| English                                     | ja                                               |
| ------------------------------------------- | ------------------------------------------------ |
| Read (the feature and its page)             | 譜読み (not 読譜)                                |
| grand staff / staff                         | 大譜表 / 譜表                                    |
| treble staff / bass staff                   | ト音記号 / ヘ音記号 (`C4（ト音記号）`)           |
| ledger lines / sharps and flats             | 加線 / シャープとフラット                        |
| bar / right, left, both hands               | 小節 / 右手・左手・両手                          |
| sustain pedal / metronome / count-in        | ダンパーペダル / メトロノーム / 予備カウント     |
| tap tempo / subdivide / tempo trainer       | タップ / 細分 / テンポトレーナー                 |
| time signature / accent / mute              | 拍子 / アクセント / ミュート                     |
| flashcards / level / mastered               | フラッシュカード / レベル / 習得済み             |
| grade                                       | グレード{n} (not 級, which counts down in Japan) |
| wrong note / missed note / extra note       | ミスタッチ / 弾き逃し / 余分な音                 |
| wait mode / rhythm mode                     | 待機モード / リズムモード                        |
| loop / repeat / volta                       | ループ / くり返し / {n}番カッコ                  |
| weak bars / hesitation / steady             | 苦手な小節 / 迷い / 安定                         |
| latency calibration / demo                  | 遅延の補正 / お手本                              |
| built-in piano                              | 内蔵ピアノ                                       |
| import / export                             | インポート / エクスポート                        |
| Scales (the page) / key (tonic)             | スケール / 主音                                  |
| major / harmonic, melodic minor             | 長音階 / 和声的短音階・旋律的短音階              |
| chromatic / fingering / evenness            | 半音階 / 運指（指番号） / 粒のそろい             |
| arpeggio / contrary motion / focus loop     | アルペジオ / 反行 / 部分ループ                   |
| free tempo / with the click                 | 自由 / クリックに合わせて                        |
| Ear (the page) / question / Hear again      | 聴音 / 問 / もう一度聴く                         |
| interval / chord / triad / seventh chord    | 音程 / 和音 / 三和音 / 七の和音                  |
| minor, major, perfect 2nd … 12th            | 短・長・完全（短2度、長3度、完全5度）            |
| tritone / octave / compound interval        | 三全音 / 完全8度 / 複音程                        |
| up / down / together (an interval)          | 上行 / 下行 / 和声的（同時）                     |
| major, minor, diminished, augmented triad   | 長三和音・短三和音・減三和音・増三和音           |
| dominant, major, minor, half-diminished 7th | 属七の和音・長七の和音・短七の和音・半減七の和音 |
| root position / 1st, 2nd inversion / root   | 基本形 / 第1転回形・第2転回形 / 根音             |
| broken / block (a chord)                    | 分散 / 同時                                      |
| Echo (the family) / melody / note 3         | 旋律 / 旋律 / 3音目                              |
| step / leap / tonic chord                   | 順次進行 / 跳躍 / 主和音                         |
| chromatic (neighbour, passing) notes        | 半音階的な音                                     |
| played as (a wrong key)                     | 〜と弾きました                                   |
| What to read: notes, intervals (Read)       | 読むもの：音符・音程                             |
| key signature / relative minor              | 調号 / 平行調                                    |
| diminished, minor, perfect, major, aug.     | 減・短・完全・長・増（増2度、減5度）             |
| quality / number (of an interval)           | 種類 / 度数（2度〜8度）                          |
| natural notes / double sharp, flat          | 幹音 / ダブルシャープ・ダブルフラット            |
| natural sign / 1st inversion (button)       | ナチュラル / 第1転回                             |

Keys in titles follow Japanese editions: ハ長調, ト長調. Middle C is 中央C. Scale names on the Scales
page keep the letter names of the app (`D長音階`, `G♯和声的短音階`), not ニ長音階.

## Korean (`ko`)

Polite 해요체 in every sentence (~해요, ~하세요, ~할 수 있어요); labels, buttons and table headers
are nouns or short forms (설정, 시작, 다시 하기, 끔/켬). Korean runs long: keep controls short.

- Standard word spacing; counters attach to the number (`{n}장`, `{n}곡`, `{n}회`, `{n}ms`).
- No particle that depends on 받침 right after a placeholder (`{title}을(를)`): rephrase instead.
- Latin punctuation; quotes “ ”; 「 」 for books and collections; `, ` for lists; ranges with `–`.
- Bars as `마디 {n}` in labels, `{m}마디 중 {n}마디` in counts.

| English                                     | ko                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------- |
| Read (the feature and its page)             | 악보 읽기                                                            |
| grand staff / staff                         | 큰보표 / 보표 (오선보 for the heatmap view)                          |
| treble staff / bass staff                   | 높은음자리표 / 낮은음자리표                                          |
| ledger lines / sharps and flats             | 덧줄 / 올림표와 내림표                                               |
| bar / right, left, both hands               | 마디 / 오른손·왼손·양손                                              |
| sustain pedal / metronome / count-in        | 댐퍼 페달 / 메트로놈 / 예비 박                                       |
| tap tempo / subdivide / tempo trainer       | 두드리기 (not 탭, which reads as “tab”) / 세분 / 빠르기 트레이너     |
| time signature / accent / mute              | 박자 / 강세 (not 셈여림) / 음소거                                    |
| flashcards / level / mastered               | 플래시 카드 / 레벨 / 마스터 완료                                     |
| middle C                                    | 가운데 C                                                             |
| wait mode / rhythm mode                     | 기다리기 모드 / 리듬 모드                                            |
| loop / repeats / volta                      | 구간 반복 / 도돌이표 / {n}번 괄호                                    |
| run / step                                  | 연주 ({n}회) / 스텝                                                  |
| weak bars / hesitation / timing             | 약한 마디 / 망설임 / 타이밍                                          |
| latency calibration / demo                  | 지연 보정 / 들어 보기                                                |
| built-in piano                              | 내장 피아노                                                          |
| import / export                             | 가져오기 / 내보내기                                                  |
| session list / answers (records)            | 연습 내역 / 응답 (연습 기록 is the whole log)                        |
| library (built-in pieces)                   | 기본 곡                                                              |
| Scales (the page) / key (tonic)             | 스케일 / 으뜸음                                                      |
| major / harmonic, melodic minor             | 장음계 / 화성 단음계, 가락 단음계                                    |
| chromatic / fingering / loudness            | 반음계 / 손가락 번호 / 음량                                          |
| arpeggio / contrary motion / focus loop     | 아르페지오 / 반진행 / 부분 반복                                      |
| free tempo / with the click                 | 자유 / 클릭에 맞춰                                                   |
| Ear (the page) / question / Hear again      | 청음 / 문제 / 다시 듣기                                              |
| interval / chord / triad / seventh chord    | 음정 / 화음 / 3화음 / 7화음                                          |
| minor, major, perfect 2nd … 12th            | 단, 장, 완전 (단2도, 장3도, 완전5도)                                 |
| tritone / octave / compound interval        | 트라이톤 (not 증4도: the item is either spelling) / 완전8도 / 겹음정 |
| up / down / together (an interval)          | 상행 / 하행 / 화성 (동시)                                            |
| major, minor, diminished, augmented triad   | 장3화음, 단3화음, 감3화음, 증3화음                                   |
| dominant, major, minor, half-diminished 7th | 딸림7화음, 장7화음, 단7화음, 반감7화음                               |
| root position / 1st, 2nd inversion / root   | 기본위치 / 제1전위, 제2전위 / 근음                                   |
| broken / block (a chord)                    | 펼친 / 동시                                                          |
| Echo (the family) / melody / note 3         | 선율 / 선율 / 3번째 음                                               |
| step / leap / tonic chord                   | 순차 진행 / 도약 / 으뜸화음                                          |
| chromatic (neighbour, passing) notes        | 반음계적인 음                                                        |
| played as (a wrong key)                     | 친 음은 …                                                            |
| What to read: notes, intervals (Read)       | 읽을 것: 음표, 음정                                                  |
| key signature / relative minor              | 조표 / 나란한조                                                      |
| diminished, minor, perfect, major, aug.     | 감, 단, 완전, 장, 증 (증2도, 감5도)                                  |
| quality / number (of an interval)           | 성질 / 도수 (2도–8도)                                                |
| natural notes / double sharp, flat          | 변화표 없는 음 / 겹올림표, 겹내림표                                  |
| natural sign / 1st inversion (button)       | 제자리표 / 제1전위                                                   |

Keys in titles use letters: G장조, C장조, matching the letter names in the app. Composer names
follow the National Institute of Korean Language: 루트비히 판 베토벤, 요한 제바스티안 바흐.

## Tempo marks

The Italian tempo marks on the Metronome page (Grave … Prestissimo) stay in Italian in every
language, as printed in scores; `tempo.<name>` is the gloss next to them. Where a language has a
settled name for the mark, the gloss starts with it (zh: 行板, 快板 …), then says how fast it is.

## Built-in pieces

Each piece's title, composer and one-sentence note are in every dictionary
(`library.<id>.title`, `.composer`, `.note`), under the name learners know it by:

| Piece                             | zh-CN           | zh-TW           | ja                | ko                |
| --------------------------------- | --------------- | --------------- | ----------------- | ----------------- |
| Ode to Joy                        | 欢乐颂          | 快樂頌          | 歓喜の歌          | 환희의 송가       |
| Minuet in G major                 | G 大调小步舞曲  | G 大調小步舞曲  | メヌエット ト長調 | 미뉴에트 G장조    |
| Arabesque, Op. 100 No. 2          | 阿拉伯风格曲    | 阿拉貝斯克      | アラベスク        | 아라베스크        |
| Soldiers' March, Op. 68 No. 2     | 士兵进行曲      | 士兵進行曲      | 兵士の行進        | 병사의 행진       |
| Für Elise                         | 致爱丽丝        | 給愛麗絲        | エリーゼのために  | 엘리제를 위하여   |
| Prelude in C major, BWV 846       | C 大调前奏曲    | C 大調前奏曲    | 前奏曲 ハ長調     | 전주곡 C장조      |
| Minuet in G minor                 | G 小调小步舞曲  | G 小調小步舞曲  | メヌエット ト短調 | 미뉴에트 G단조    |
| Musette in D major                | D 大调风笛舞曲  | D 大調風笛舞曲  | ミュゼット ニ長調 | 뮈제트 D장조      |
| La Candeur, Op. 100 No. 1         | 纯洁            | 純潔            | 素直な心          | 순수 (La Candeur) |
| Old French Song, Op. 39 No. 16    | 古老的法国歌曲  | 古老的法國歌曲  | 古いフランスの歌  | 옛 프랑스 노래    |
| Morning Prayer, Op. 39 No. 1      | 晨祷            | 晨禱            | 朝の祈り          | 아침 기도         |
| Prelude in C minor, Op. 28 No. 20 | C 小调前奏曲    | C 小調前奏曲    | 前奏曲 ハ短調     | 전주곡 C단조      |
| Gymnopédie No. 1                  | 裸体歌舞第 1 号 | 裸體歌舞第 1 號 | ジムノペディ第1番 | 짐노페디 제1번    |

The source and licence lines of a built-in piece stay in English: they are provenance, not UI.

## Reporting a problem

Open a [translation issue](https://github.com/ya-luotao/dacapo/issues/new?template=translation.yml)
with the key (or a screenshot), what the UI says and what it should say. Pull requests that fix a
string are welcome; say in the description whether you are a native speaker.
