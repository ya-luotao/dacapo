# dacapo

[English](README.md) · [简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) ·
한국어

_Da capo_ — “처음부터”.

dacapo는 MIDI 키보드로 피아노를 연습하는 오픈 소스 웹 앱이에요. 진짜 큰보표로 악보 읽기를 연습하고, 음마다 반응 시간을
기록해서 약한 음을 히트맵으로 보여 줘요. 진짜 악보로 곡도 연습할 수 있어요(기다리기 모드와 리듬 모드). 모든 데이터는
브라우저에만 저장돼요.

**바로 써 보기:** [ya-luotao.github.io/dacapo](https://ya-luotao.github.io/dacapo/) — 설치도 회원 가입도 필요 없어요.

## 기능

- **악보 읽기 플래시 카드**: 큰보표에 나온 음을 옥타브까지 맞춰 건반에서 쳐요. 가운데 C 자리부터 덧줄, 올림표와
  내림표까지 7개 레벨이 있어요. 답할 때마다 정답 여부와 시간을 기록하고, 느리거나 헷갈리는 음이 더 자주 나와요.
- **약한 음 히트맵**: 오선보나 건반 위에 음을 찾는 속도를 색으로 보여 줘요.
- **곡 연습**: 퍼블릭 도메인 곡 6곡이 들어 있고, 내 MusicXML도 가져올 수 있어요. 기다리기 모드에서는 맞게 칠 때까지
  커서가 기다리고, 리듬 모드에서는 메트로놈에 맞춰 친 뒤 빠르거나 늦은 경향과 빨라지거나 느려진 구간을 알려 줘요.
- **연습 기록**: 오늘 연습한 시간, 연속 연습일, 최근 30일 그래프.
- 화면 언어: English, 简体中文, 繁體中文, 日本語, 한국어. 음이름은 모든 언어에서 알파벳(C4, F♯)으로 써요.

## 필요한 것

- 컴퓨터의 Chrome이나 Edge(Web MIDI 지원). 다른 브라우저에서도 컴퓨터 키보드나 마우스로 칠 수 있어요.
- MIDI 키보드를 추천하지만 꼭 필요하지는 않아요. USB 케이블로 연결하면 돼요.
- 계정도 서버도 없어요. 데이터는 설정에서 JSON 파일로 내보내 백업하거나 다른 컴퓨터로 옮길 수 있어요.

## 개발

Node.js 22.13 이상과 pnpm(버전은 `package.json`의 `packageManager`)이 필요해요.

```sh
pnpm install
pnpm dev
```

기준이 되는 설명은 영어 [README](README.md)예요. 기여 방법은 [CONTRIBUTING.md](CONTRIBUTING.md)(영어), 번역은
[docs/TRANSLATING.md](docs/TRANSLATING.md)를 보세요.

## 라이선스

[MIT](LICENSE). 서드파티 소프트웨어, 글꼴, 악보의 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)에 있어요.
