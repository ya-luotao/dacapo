import { ChoiceQuiz, SequenceExercise, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { OrnamentCard, Ornaments, SpreadAndPause } from '../ornamentFigures.tsx';

const RANGE: readonly [number, number] = [60, 83]; // C4–B5

const LABELS = {
  written: '譜上寫的',
  played: '實際彈的',
  slowly: '慢速',
  atTempo: '原速',
  acciaccatura: '短倚音',
  appoggiatura: '長倚音',
  mordent: '下漣音',
  invertedMordent: '上漣音',
  turn: '迴音',
  trillUpper: '從上方音開始',
  trillMain: '從本音開始',
};

const STAFF_LABELS = {
  acciaccatura: 'G，然後是前面帶短倚音 B 的 A，然後是 G',
  appoggiatura: 'G，然後是前面帶長倚音 B 的 A，然後是 G',
  mordent: 'G 大調小步舞曲第 5 小節：帶下漣音的 C，然後是 D、C、B、A',
  invertedMordent: '帶上漣音的 C，然後是 D、C、B、A',
  turn: '上方帶迴音記號的 D，然後是 C 和 B',
  trillUpper: '帶顫音的 D，以 C、D 結尾，然後是 C',
  trillMain: '帶顫音的 D，以 C、D 結尾，然後是 C',
};

const WHICH = '這是哪一種裝飾音？';
const ORNAMENTS = ['下漣音', '上漣音', '迴音', '顫音'];
const GRACES = ['短倚音', '長倚音'];

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mordent',
    question: WHICH,
    figure: <OrnamentCard name="mordent" label="上方帶裝飾音記號的音符" />,
    options: ORNAMENTS,
    answer: 0,
  },
  {
    id: 'turn',
    question: WHICH,
    figure: <OrnamentCard name="turn" label="上方帶裝飾音記號的音符" />,
    options: ORNAMENTS,
    answer: 2,
  },
  {
    id: 'inverted',
    question: WHICH,
    figure: <OrnamentCard name="invertedMordent" label="上方帶裝飾音記號的音符" />,
    options: ORNAMENTS,
    answer: 1,
  },
  {
    id: 'trill',
    question: WHICH,
    figure: <OrnamentCard name="trillUpper" label="上方帶裝飾音記號的音符" />,
    options: ORNAMENTS,
    answer: 3,
  },
  {
    id: 'acciaccatura',
    question: '這是哪一種倚音？',
    figure: <OrnamentCard name="acciaccatura" label="本音前面的一個小音符" />,
    options: GRACES,
    answer: 0,
  },
  {
    id: 'appoggiatura',
    question: '這個呢？',
    figure: <OrnamentCard name="appoggiatura" label="本音前面的一個小音符" />,
    options: GRACES,
    answer: 1,
  },
  {
    id: 'mordent-notes',
    question: '在 G 大調裡，這個下漣音彈哪幾個音？',
    figure: <OrnamentCard name="mordent" label="上方帶下漣音的 C" />,
    options: ['C B C', 'C D C', 'D C B C'],
    answer: 0,
  },
  {
    id: 'baroque-trill',
    question: '巴哈的音樂裡，顫音從哪個音開始？',
    figure: null,
    options: ['上方的音', '寫出來的那個音', '下方的音'],
    answer: 0,
  },
  {
    id: 'fermata',
    question: '最後一個音上的這個記號是什麼意思？',
    figure: <OrnamentCard name="fermata" label="三個音符，最後一個上方帶延長記號" />,
    options: ['比寫的時值更長', '彈得短', '彈成顫音'],
    answer: 0,
  },
  {
    id: 'arpeggio',
    question: '和弦前面的這條波浪線呢？',
    figure: <OrnamentCard name="arpeggio" label="兩個和弦，第一個前面有一條直的波浪線" />,
    options: ['從下往上把和弦分開彈', '彈得更大聲', '最上面的音彈顫音'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        巴哈、莫札特那個時代的音樂，喜歡替音符加點花樣：音符前面印著小音符，上面畫著記號，一個記號代表一小串很快的音。這些都叫
        <strong>裝飾音</strong>
        。每一種都是一種簡寫，所以這一課把每個記號代表的音都寫出來，放在它下面，並且慢速、原速各彈一遍。
      </p>

      <Section id="grace-notes" title="倚音">
        <p>
          <strong>倚音</strong>
          是印在本音前面的小音符。它在小節裡沒有自己的時值，時間要向旁邊的音借。
        </p>
        <ul>
          <li>
            符桿上有一道斜線的是<strong>短倚音</strong>
            ：彈得越快越好，剛好在拍子之前，讓本音聽起來還是準時出現。
          </li>
          <li>
            沒有斜線的是<strong>長倚音</strong>
            ：它落在拍子上，向本音借時值，通常借一半。本音晚一點出現，也輕一點，像是靠回來。
          </li>
        </ul>
        <Plate caption="兩種倚音，上面是譜上寫的，下面是實際彈的。先慢速聽，再原速聽：短倚音一帶而過，長倚音佔去 A 的一半。">
          <Ornaments
            names={['acciaccatura', 'appoggiatura']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
      </Section>

      <Section id="mordents" title="漣音">
        <p>
          <strong>漣音</strong>
          是在拍子上很快地彈到相鄰的音再回來：本音、相鄰的音、本音，然後把剩下的時值按住。記號中間有一條短直線的，去下方的音，叫
          <strong>下漣音</strong>；沒有直線的，去上方的音，叫<strong>上漣音</strong>。
        </p>
        <p>
          這兩個名字有點亂：有的書只說「漣音」和「逆漣音」，哪個是哪個，各家說法不一；英文把帶直線的叫
          mordent，不帶直線的反而叫 inverted
          mordent（「倒轉的漣音」）。看記號，不要只看名字。相鄰的音是調裡的下一個音，除非記號旁邊有小的升降記號另外註明。
        </p>
        <Plate caption="「樂曲」裡 G 大調小步舞曲的第 5 小節：C 上有一個下漣音，彈 C B C。切換到上漣音，聽 C D C。">
          <Ornaments
            names={['mordent', 'invertedMordent']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="在「樂曲」裡">
          <p>
            G 大調小步舞曲第 3、5 小節的 C 上有下漣音，旋律再次出現時也有；快結束的地方，一個 B
            上有上漣音；第 8 小節末尾的 A 前面有一個小倚音。和它成對的 G
            小調小步舞曲裡，兩種漣音也都有。
          </p>
        </Aside>
      </Section>

      <Section id="turn" title="迴音">
        <p>
          <strong>迴音</strong>
          的記號像一個橫躺的
          S，它繞著本音轉一圈：上方的音、本音、下方的音，再回到本音。寫在音符上方時，它在拍子上立刻開始。寫在兩個音符之間時，先按住前一個音，在它的末尾彈迴音，引到下一個音。
        </p>
        <Plate caption="D 上的迴音：E D C D，然後到 C。">
          <Ornaments names={['turn']} labels={LABELS} staffLabels={STAFF_LABELS} />
        </Plate>
      </Section>

      <Section id="trill" title="顫音">
        <p>
          音符上方的 <strong>tr</strong>，後面常跟一條波浪線，就是<strong>顫音</strong>
          ：在本音和它上方的音之間快速、均勻地來回，一直彈滿這個音的時值。
        </p>
        <p>
          從哪個音開始，要看音樂寫於什麼時代。巴洛克音樂（巴哈、韓德爾）裡，顫音從上方的音開始，落在拍子上；十九世紀以後的音樂裡，通常從寫出來的本音開始。顫音末尾的兩個小音符是一個收尾的迴音：先下方的音，再本音，引到下一個音。
        </p>
        <Plate caption="同一個顫音的兩種彈法：像巴哈那樣從上方的音開始，或者像後來的音樂那樣從本音開始。兩種都以寫出來的迴音收尾，進入 C。一開始慢慢彈，一拍四個音。">
          <Ornaments
            names={['trillUpper', 'trillMain']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="要勻，不要快">
          <p>
            又慢又均勻的顫音，比又快又坑坑疤疤的好聽得多。一開始數著音彈，只有在還能保持均勻時才加快。
          </p>
        </Aside>
      </Section>

      <Section id="spread-and-pause" title="琶音與延長記號">
        <p>
          和弦前面一條直的波浪線，是要你把和弦分開彈，叫<strong>琶音</strong>
          ：從最低的音開始，一個接一個很快地往上彈，每個音都按住，讓最高的音最後響。音符或休止符上方像一隻眼睛的記號是
          <strong>延長記號</strong>
          ：比寫的時值停得更久，常常是兩倍左右，停到感覺剛好為止，再往下彈。
        </p>
        <Plate caption="帶記號和不帶記號各聽一遍：和弦先分開彈，再一起彈；最後一個音先延長，再照原來的時值。">
          <SpreadAndPause
            labels={{
              arpeggio: '琶音',
              fermata: '延長記號',
              with: '有記號',
              without: '沒有記號',
            }}
            staffLabels={{
              arpeggio: '兩個 C 大三和弦，第一個前面有一條直的波浪線',
              fermata: 'E、F、G，G 上方有延長記號',
            }}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先認一認這些記號，再把其中兩個寫出來的音彈一遍，慢慢地、均勻地彈。</p>
        <Plate>
          <ChoiceQuiz prompt="裝飾音。" questions={QUESTIONS} />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[72, 71, 72, 74, 72, 71, 69]}
            prompt="小步舞曲裡的下漣音，寫出來是：C B C，然後是 D C B A。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[76, 74, 72, 74, 72, 71]}
            prompt="D 上的迴音，寫出來是：E D C D，然後是 C 和 B。"
            onComplete={complete}
          />
        </Plate>
        <p>
          「樂曲」裡兩首小步舞曲的裝飾音都畫在譜上，等的是每個裝飾音的本音：裝飾音裡的其他音和倚音既不算對也不算錯，所以裝飾音彈不彈都可以。彈完一遍，「表情」的「裝飾音」一欄會告訴你哪些彈了、哪些只彈了一部分、哪些漏掉了。
        </p>
      </Section>
    </>
  );
}
