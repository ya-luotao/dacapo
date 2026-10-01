import { ChoiceQuiz, SequenceExercise, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { OrnamentCard, Ornaments, SpreadAndPause } from '../ornamentFigures.tsx';

const RANGE: readonly [number, number] = [60, 83]; // C4–B5

const LABELS = {
  written: '谱上写的',
  played: '实际弹的',
  slowly: '慢速',
  atTempo: '原速',
  acciaccatura: '短倚音',
  appoggiatura: '长倚音',
  mordent: '下波音',
  invertedMordent: '上波音',
  turn: '回音',
  trillUpper: '从上方音起',
  trillMain: '从本音起',
};

const STAFF_LABELS = {
  acciaccatura: 'G，然后是前面带短倚音 B 的 A，然后是 G',
  appoggiatura: 'G，然后是前面带长倚音 B 的 A，然后是 G',
  mordent: 'G 大调小步舞曲第 5 小节：带下波音的 C，然后是 D、C、B、A',
  invertedMordent: '带上波音的 C，然后是 D、C、B、A',
  turn: '上方带回音记号的 D，然后是 C 和 B',
  trillUpper: '带颤音的 D，以 C、D 结尾，然后是 C',
  trillMain: '带颤音的 D，以 C、D 结尾，然后是 C',
};

const WHICH = '这是哪一种装饰音？';
const ORNAMENTS = ['下波音', '上波音', '回音', '颤音'];
const GRACES = ['短倚音', '长倚音'];

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'mordent',
    question: WHICH,
    figure: <OrnamentCard name="mordent" label="上方带装饰音记号的音符" />,
    options: ORNAMENTS,
    answer: 0,
  },
  {
    id: 'turn',
    question: WHICH,
    figure: <OrnamentCard name="turn" label="上方带装饰音记号的音符" />,
    options: ORNAMENTS,
    answer: 2,
  },
  {
    id: 'inverted',
    question: WHICH,
    figure: <OrnamentCard name="invertedMordent" label="上方带装饰音记号的音符" />,
    options: ORNAMENTS,
    answer: 1,
  },
  {
    id: 'trill',
    question: WHICH,
    figure: <OrnamentCard name="trillUpper" label="上方带装饰音记号的音符" />,
    options: ORNAMENTS,
    answer: 3,
  },
  {
    id: 'acciaccatura',
    question: '这是哪一种倚音？',
    figure: <OrnamentCard name="acciaccatura" label="主音前面的一个小音符" />,
    options: GRACES,
    answer: 0,
  },
  {
    id: 'appoggiatura',
    question: '这个呢？',
    figure: <OrnamentCard name="appoggiatura" label="主音前面的一个小音符" />,
    options: GRACES,
    answer: 1,
  },
  {
    id: 'mordent-notes',
    question: '在 G 大调里，这个下波音弹哪几个音？',
    figure: <OrnamentCard name="mordent" label="上方带下波音的 C" />,
    options: ['C B C', 'C D C', 'D C B C'],
    answer: 0,
  },
  {
    id: 'baroque-trill',
    question: '巴赫的音乐里，颤音从哪个音开始？',
    figure: null,
    options: ['上方的音', '写出来的那个音', '下方的音'],
    answer: 0,
  },
  {
    id: 'fermata',
    question: '最后一个音上的这个记号是什么意思？',
    figure: <OrnamentCard name="fermata" label="三个音符，最后一个上方带延长记号" />,
    options: ['比写的时值更长', '弹得短', '弹成颤音'],
    answer: 0,
  },
  {
    id: 'arpeggio',
    question: '和弦前面的这条波浪线呢？',
    figure: <OrnamentCard name="arpeggio" label="两个和弦，第一个前面有一条竖的波浪线" />,
    options: ['从下往上把和弦分开弹', '弹得更响', '最上面的音弹颤音'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        巴赫、莫扎特那个时代的音乐，喜欢给音符加点缀：音符前面印着小音符，上面画着记号，一个记号代表一小串很快的音。这些都叫
        <strong>装饰音</strong>
        。每一种都是一种简写，所以这一课把每个记号代表的音都写出来，放在它下面，并且慢速、原速各弹一遍。
      </p>

      <Section id="grace-notes" title="倚音">
        <p>
          <strong>倚音</strong>
          是印在主音前面的小音符。它在小节里没有自己的时值，时间要从旁边的音那里借。
        </p>
        <ul>
          <li>
            符干上有一道斜线的是<strong>短倚音</strong>
            ：弹得越快越好，刚好在拍子之前，让主音听起来还是准时到来。
          </li>
          <li>
            没有斜线的是<strong>长倚音</strong>
            ：它落在拍子上，从主音那里借时值，通常借一半。主音晚一点出现，也轻一点，像是靠回来。
          </li>
        </ul>
        <Plate caption="两种倚音，上面是谱上写的，下面是实际弹的。先慢速听，再原速听：短倚音一带而过，长倚音占去 A 的一半。">
          <Ornaments
            names={['acciaccatura', 'appoggiatura']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
      </Section>

      <Section id="mordents" title="波音">
        <p>
          <strong>波音</strong>
          是在拍子上很快地弹到相邻的音再回来：本音、相邻的音、本音，然后把剩下的时值保持住。记号中间有一条短竖线的，去下方的音，叫
          <strong>下波音</strong>；没有竖线的，去上方的音，叫<strong>上波音</strong>。
        </p>
        <p>
          这两个名字有点乱：有的书把上波音叫顺波音、下波音叫逆波音；英文把带竖线的叫
          mordent，不带竖线的反而叫 inverted
          mordent（「倒转的波音」）。看记号，不要只看名字。相邻的音是调里的下一个音，除非记号旁边有小的升降号另作说明。
        </p>
        <Plate caption="「曲目」里 G 大调小步舞曲的第 5 小节：C 上有一个下波音，弹 C B C。切换到上波音，听 C D C。">
          <Ornaments
            names={['mordent', 'invertedMordent']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="在「曲目」里">
          <p>
            G 大调小步舞曲第 3、5 小节的 C 上有下波音，旋律再次出现时也有；快结束的地方，一个 B
            上有上波音；第 8 小节末尾的 A 前面有一个小倚音。和它配对的 G
            小调小步舞曲里，两种波音也都有。
          </p>
        </Aside>
      </Section>

      <Section id="turn" title="回音">
        <p>
          <strong>回音</strong>
          的记号像一个横躺的
          S，它绕着本音转一圈：上方的音、本音、下方的音，再回到本音。写在音符上方时，它在拍子上立刻开始。写在两个音符之间时，先保持前一个音，在它的末尾弹回音，引到下一个音。
        </p>
        <Plate caption="D 上的回音：E D C D，然后到 C。">
          <Ornaments names={['turn']} labels={LABELS} staffLabels={STAFF_LABELS} />
        </Plate>
      </Section>

      <Section id="trill" title="颤音">
        <p>
          音符上方的 <strong>tr</strong>，后面常跟一条波浪线，就是<strong>颤音</strong>
          ：在本音和它上方的音之间快速、均匀地来回，一直弹满这个音的时值。
        </p>
        <p>
          从哪个音开始，要看音乐写于什么时代。巴洛克音乐（巴赫、亨德尔）里，颤音从上方的音开始，落在拍子上；十九世纪以后的音乐里，通常从写出来的本音开始。颤音末尾的两个小音符是一个收尾的回音：先下方的音，再本音，引到下一个音。
        </p>
        <Plate caption="同一个颤音的两种弹法：像巴赫那样从上方的音起，或者像后来的音乐那样从本音起。两种都以写出来的回音收尾，进入 C。一开始慢慢弹，一拍四个音。">
          <Ornaments
            names={['trillUpper', 'trillMain']}
            labels={LABELS}
            staffLabels={STAFF_LABELS}
          />
        </Plate>
        <Aside title="要匀，不要快">
          <p>
            又慢又匀的颤音，比又快又疙疙瘩瘩的好听得多。一开始数着音弹，只有在还能保持均匀时才加快。
          </p>
        </Aside>
      </Section>

      <Section id="spread-and-pause" title="琶音与延长记号">
        <p>
          和弦前面一条竖着的波浪线，是要你把和弦分开弹，叫<strong>琶音</strong>
          ：从最低的音开始，一个接一个很快地往上弹，每个音都按住，让最高的音最后响。音符或休止符上方像一只眼睛的记号是
          <strong>延长记号</strong>
          ：比写的时值停得更久，常常是两倍左右，停到感觉合适为止，再往下弹。
        </p>
        <Plate caption="带记号和不带记号各听一遍：和弦先分开弹，再一起弹；最后一个音先延长，再按原来的时值。">
          <SpreadAndPause
            labels={{
              arpeggio: '琶音',
              fermata: '延长记号',
              with: '有记号',
              without: '没有记号',
            }}
            staffLabels={{
              arpeggio: '两个 C 大三和弦，第一个前面有一条竖的波浪线',
              fermata: 'E、F、G，G 上方有延长记号',
            }}
          />
        </Plate>
      </Section>

      <Section id="try-it" title="试一试">
        <p>先认一认这些记号，再把其中两个写出来的音弹一遍，慢慢地、均匀地弹。</p>
        <Plate>
          <ChoiceQuiz prompt="装饰音。" questions={QUESTIONS} />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[72, 71, 72, 74, 72, 71, 69]}
            prompt="小步舞曲里的下波音，写出来是：C B C，然后是 D C B A。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[76, 74, 72, 74, 72, 71]}
            prompt="D 上的回音，写出来是：E D C D，然后是 C 和 B。"
            onComplete={complete}
          />
        </Plate>
        <p>
          「曲目」里两首小步舞曲的装饰音都画在谱上，等的是每个装饰音的本音：装饰音里的其他音和倚音既不算对也不算错，所以装饰音弹不弹都行。弹完一遍，「表现」面板的「装饰音」一栏会告诉你哪些弹了、哪些只弹了一部分、哪些没弹。
        </p>
      </Section>
    </>
  );
}
