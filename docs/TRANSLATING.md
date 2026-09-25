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

| English                                 | zh-CN                        |
| --------------------------------------- | ---------------------------- |
| Read / flashcards                       | 识谱 / 识谱卡片              |
| grand staff / treble staff / bass staff | 大谱表 / 高音谱表 / 低音谱表 |
| ledger lines / sharps and flats         | 加线 / 升号和降号            |
| bar / right, left, both hands           | 小节 / 右手、左手、双手      |
| sustain pedal / metronome / count-in    | 延音踏板 / 节拍器 / 预备拍   |
| tap tempo / subdivide / tempo trainer   | 敲击测速 / 细分 / 速度训练   |
| accented / muted beat / time signature  | 重音 / 静音 / 拍号           |
| wait mode / rhythm mode / weak bars     | 等待 / 节奏 / 薄弱小节       |
| loop / repeat / run                     | 循环 / 反复 / 遍             |
| latency calibration                     | 延迟校准                     |
| export / import                         | 导出 / 导入                  |

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

| English                                 | zh-TW                        | zh-CN, where different     |
| --------------------------------------- | ---------------------------- | -------------------------- |
| Read / flashcards                       | 識譜 / 音符閃卡              | 识谱 / 识谱卡片            |
| level / mastered                        | 等級 / 已熟練                | 级别 / 已掌握              |
| grand staff / treble staff / bass staff | 大譜表 / 高音譜表 / 低音譜表 |                            |
| treble clef / bass clef                 | 高音譜號 / 低音譜號          |                            |
| ledger lines / sharps and flats         | 加線 / 升降記號              |                            |
| bar / both hands                        | 小節 / 雙手                  |                            |
| sustain pedal / metronome / count-in    | 延音踏板 / 節拍器 / 預備拍   |                            |
| tap tempo / subdivide / tempo trainer   | 點按測速 / 細分 / 速度訓練   | 敲击测速 / 细分 / 速度训练 |
| speed up / silent bars / time signature | 漸快 / 靜音小節 / 拍號       | 逐渐加快 / 静音小节 / 拍号 |
| repeat / volta                          | 反覆 / {n} 房                | 反复                       |
| tie / mordent                           | 連結線 / 漣音                | 连音线 / 波音              |
| weak bars / calibrate                   | 弱點小節 / 校正              | 薄弱小节 / 校准            |
| cursor / speakers                       | 游標 / 喇叭                  | 光标 / 音箱                |
| piece / library                         | 樂曲 / 曲庫                  | 曲目 / 曲库                |
| export / import / file / data           | 匯出 / 匯入 / 檔案 / 資料    | 导出 / 导入 / 文件 / 数据  |
| settings / tab / private window         | 設定 / 分頁 / 無痕視窗       | 设置 / 标签页 / 无痕窗口   |
| save / reload / font                    | 儲存 / 重新整理 / 字型       | 保存 / 刷新 / 字体         |

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

| English                               | ja                                               |
| ------------------------------------- | ------------------------------------------------ |
| Read (the feature and its page)       | 譜読み (not 読譜)                                |
| grand staff / staff                   | 大譜表 / 譜表                                    |
| treble staff / bass staff             | ト音記号 / ヘ音記号 (`C4（ト音記号）`)           |
| ledger lines / sharps and flats       | 加線 / シャープとフラット                        |
| bar / right, left, both hands         | 小節 / 右手・左手・両手                          |
| sustain pedal / metronome / count-in  | ダンパーペダル / メトロノーム / 予備カウント     |
| tap tempo / subdivide / tempo trainer | タップ / 細分 / テンポトレーナー                 |
| time signature / accent / mute        | 拍子 / アクセント / ミュート                     |
| flashcards / level / mastered         | フラッシュカード / レベル / 習得済み             |
| grade                                 | グレード{n} (not 級, which counts down in Japan) |
| wrong note / missed note / extra note | ミスタッチ / 弾き逃し / 余分な音                 |
| wait mode / rhythm mode               | 待機モード / リズムモード                        |
| loop / repeat / volta                 | ループ / くり返し / {n}番カッコ                  |
| weak bars / hesitation / steady       | 苦手な小節 / 迷い / 安定                         |
| latency calibration / demo            | 遅延の補正 / お手本                              |
| import / export                       | インポート / エクスポート                        |

Keys in titles follow Japanese editions: ハ長調, ト長調. Middle C is 中央C.

## Korean (`ko`)

Polite 해요체 in every sentence (~해요, ~하세요, ~할 수 있어요); labels, buttons and table headers
are nouns or short forms (설정, 시작, 다시 하기, 끔/켬). Korean runs long: keep controls short.

- Standard word spacing; counters attach to the number (`{n}장`, `{n}곡`, `{n}회`, `{n}ms`).
- No particle that depends on 받침 right after a placeholder (`{title}을(를)`): rephrase instead.
- Latin punctuation; quotes “ ”; 「 」 for books and collections; `, ` for lists; ranges with `–`.
- Bars as `마디 {n}` in labels, `{m}마디 중 {n}마디` in counts.

| English                               | ko                                                               |
| ------------------------------------- | ---------------------------------------------------------------- |
| Read (the feature and its page)       | 악보 읽기                                                        |
| grand staff / staff                   | 큰보표 / 보표 (오선보 for the heatmap view)                      |
| treble staff / bass staff             | 높은음자리표 / 낮은음자리표                                      |
| ledger lines / sharps and flats       | 덧줄 / 올림표와 내림표                                           |
| bar / right, left, both hands         | 마디 / 오른손·왼손·양손                                          |
| sustain pedal / metronome / count-in  | 댐퍼 페달 / 메트로놈 / 예비 박                                   |
| tap tempo / subdivide / tempo trainer | 두드리기 (not 탭, which reads as “tab”) / 세분 / 빠르기 트레이너 |
| time signature / accent / mute        | 박자 / 강세 (not 셈여림) / 음소거                                |
| flashcards / level / mastered         | 플래시 카드 / 레벨 / 마스터 완료                                 |
| middle C                              | 가운데 C                                                         |
| wait mode / rhythm mode               | 기다리기 모드 / 리듬 모드                                        |
| loop / repeats / volta                | 구간 반복 / 도돌이표 / {n}번 괄호                                |
| run / step                            | 연주 ({n}회) / 스텝                                              |
| weak bars / hesitation / timing       | 약한 마디 / 망설임 / 타이밍                                      |
| latency calibration / demo            | 지연 보정 / 들어 보기                                            |
| import / export                       | 가져오기 / 내보내기                                              |
| session list / answers (records)      | 연습 내역 / 응답 (연습 기록 is the whole log)                    |
| library (built-in pieces)             | 기본 곡                                                          |

Keys in titles use letters: G장조, C장조, matching the letter names in the app. Composer names
follow the National Institute of Korean Language: 루트비히 판 베토벤, 요한 제바스티안 바흐.

## Tempo marks

The Italian tempo marks on the Metronome page (Grave … Prestissimo) stay in Italian in every
language, as printed in scores; `tempo.<name>` is the gloss next to them. Where a language has a
settled name for the mark, the gloss starts with it (zh: 行板, 快板 …), then says how fast it is.

## Built-in pieces

Each piece's title, composer and one-sentence note are in every dictionary
(`library.<id>.title`, `.composer`, `.note`), under the name learners know it by:

| Piece                         | zh-CN          | zh-TW          | ja                | ko              |
| ----------------------------- | -------------- | -------------- | ----------------- | --------------- |
| Ode to Joy                    | 欢乐颂         | 快樂頌         | 歓喜の歌          | 환희의 송가     |
| Minuet in G major             | G 大调小步舞曲 | G 大調小步舞曲 | メヌエット ト長調 | 미뉴에트 G장조  |
| Arabesque, Op. 100 No. 2      | 阿拉伯风格曲   | 阿拉貝斯克     | アラベスク        | 아라베스크      |
| Soldiers' March, Op. 68 No. 2 | 士兵进行曲     | 士兵進行曲     | 兵士の行進        | 병사의 행진     |
| Für Elise                     | 致爱丽丝       | 給愛麗絲       | エリーゼのために  | 엘리제를 위하여 |
| Prelude in C major, BWV 846   | C 大调前奏曲   | C 大調前奏曲   | 前奏曲 ハ長調     | 전주곡 C장조    |

The source and licence lines of a built-in piece stay in English: they are provenance, not UI.

## Reporting a problem

Open a [translation issue](https://github.com/ya-luotao/dacapo/issues/new?template=translation.yml)
with the key (or a screenshot), what the UI says and what it should say. Pull requests that fix a
string are welcome; say in the description whether you are a native speaker.
