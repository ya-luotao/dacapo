import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { LegatoPedalling, PedalExercise, PedalledChords } from '../pedalFigures.tsx';

const USES = {
  none: '不踩踏板',
  held: '一直踩着',
  changed: '随和弦换',
  signs: 'Ped. 和 ✱',
  line: '线条',
};

const QUESTIONS: readonly ChoiceQuestion[] = [
  {
    id: 'dampers',
    question: '哪个踏板会把所有制音器从琴弦上抬起来？',
    figure: null,
    options: ['左踏板', '中踏板', '右踏板'],
    answer: 2,
  },
  {
    id: 'una-corda',
    question: '谱上写着 una corda，是要你做什么？',
    figure: null,
    options: ['踩左踏板', '踩右踏板', '只用一个手指弹'],
    answer: 0,
  },
  {
    id: 'star',
    question: '谱表下方，Ped. 之后的 ✱ 是什么意思？',
    figure: null,
    options: ['抬起踏板', '踩下踏板', '这个音弹得更响'],
    answer: 0,
  },
  {
    id: 'notch',
    question: '踏板线上的一个尖角是什么意思？',
    figure: null,
    options: ['抬起再马上踩下：换一次踏板', '抬起踏板，不再踩', '踩一半'],
    answer: 0,
  },
  {
    id: 'when-up',
    question: '连音踏板里，踏板什么时候抬起来？',
    figure: null,
    options: ['新和弦弹下去之后马上抬', '新和弦弹下去之前', '小节线的地方'],
    answer: 0,
  },
  {
    id: 'early',
    question: '还没弹新和弦就先抬了踏板，会听到什么？',
    figure: null,
    options: ['声音断开了', '两个和弦混在一起', '没有区别'],
    answer: 0,
  },
  {
    id: 'late',
    question: '新和弦弹了很久才抬踏板，会听到什么？',
    figure: null,
    options: ['两个和弦混在一起', '声音断开了', '和弦变轻了'],
    answer: 0,
  },
  {
    id: 'harmony',
    question: '一般什么时候换踏板？',
    figure: null,
    options: ['和声变化的时候', '每一拍', '只在曲子结尾'],
    answer: 0,
  },
  {
    id: 'heel',
    question: '踩踏板时，脚跟放在哪里？',
    figure: null,
    options: ['地板上', '踏板上', '悬在空中'],
    answer: 0,
  },
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        三角钢琴有三个踏板，其中右边那个，肖邦以来的曲子几乎首首都要用。用得好，它能把手连不起来的音连起来，让钢琴共鸣起来；用得随便，它会把一切都搅成一团。这一课讲每个踏板做什么，以及怎样干净地换右踏板。
      </p>

      <Section id="three-pedals" title="三个踏板">
        <ul>
          <li>
            <strong>右边：延音踏板</strong>，也叫制音踏板。它把所有制音器一起从琴弦上抬起来（见
            <Link href="/learn/inside">「钢琴里面是什么样的」</Link>
            ）：松开琴键之后，音还在响，别的琴弦也会跟着共鸣。谱上说「踏板」，一般指的就是它。
          </li>
          <li>
            <strong>左边：弱音踏板</strong>，谱上写作 <em>una corda</em>
            （「一根弦」）。在三角钢琴上，它把整个击弦机往旁边挪一点，每个琴槌就少打一根弦：声音变轻，音色也变柔。写着{' '}
            <em>tre corde</em>
            （「三根弦」）就是松开它。在立式钢琴上，它让琴槌离琴弦近一些，只是让声音变轻。
          </li>
          <li>
            <strong>中间：持音踏板</strong>
            ，大多数三角钢琴上有。它只托住踩下时已经抬起的那些制音器：先弹一个低音，踩下中踏板，这个低音就一直响着，后面弹的音照样清楚。很多立式钢琴的中踏板则是弱音练习踏板，它在琴槌和琴弦之间放下一条毛毡，让琴声变得很小。
          </li>
        </ul>
        <p>
          大多数电钢琴有一个延音踏板，有的三个都有。MIDI
          键盘会像发送琴键一样，把延音踏板发给这个应用。
        </p>
        <Aside title="它不是音量旋钮">
          <p>弱音踏板改变的更多是音色，而不是音量。要弹得轻，还是得靠手指。</p>
        </Aside>
      </Section>

      <Section id="pressing" title="怎么踩">
        <ul>
          <li>用右脚，脚跟放在踏板前面的地板上。</li>
          <li>用前脚掌踩，动的是脚踝；踏板抬起时脚也不离开它，这样就不会有拍打声、撞击声。</li>
          <li>踩就踩到底，抬就抬到顶：踩一半，两头都做不好。</li>
          <li>左脚平放在地板上，要用弱音踏板时再放到它旁边。</li>
        </ul>
      </Section>

      <Section id="marks" title="踏板记号">
        <p>
          延音踏板标在低音谱表下方。老一些的乐谱在踩下的地方写 <em>Ped.</em>
          ，抬起的地方画一个星号
          ✱。新一些的乐谱画一条线：线从踩下的地方开始，线上每个尖角就是一次换踏板，抬起再马上踩下。谱上什么都没标的地方，往往也要踩踏板，这要由你和老师来决定。
        </p>
        <Plate caption="同样的踏板用法，两种写法：第一个和弦踩下，每个新和弦换一次，最后抬起。">
          <PedalledChords
            uses={['changed']}
            marks={['signs', 'line']}
            labels={USES}
            staffLabel="大谱表上的四个和弦：C、F、G、C，下方标着踏板"
          />
        </Plate>
      </Section>

      <Section id="legato-pedalling" title="换踏板：连音踏板">
        <p>
          要把一个和弦连到下一个和弦，踏板得放掉旧和弦、接住新和弦，中间既不断开，也不混在一起。诀窍是在新和弦
          <strong>之后</strong>
          换，而不是和它同时：先弹新和弦，手按住不放，再抬起踏板、马上踩下。制音器落下一瞬间，把旧和弦止住；新和弦还在手指下面，正好被踏板接住。
        </p>
        <p>
          脚总是比手晚一点，从不和手同时动：这叫<strong>连音踏板</strong>
          （也叫切分踏板）。新和弦之前就抬踏板，声音会<strong>断开</strong>
          ；抬得太晚，旧和弦会一直响进新和弦里，声音就<strong>混浊</strong>了。
        </p>
        <Plate
          wide
          caption="看四个和弦的三种换法：换得正好、太早、太晚。最上面是琴键，中间是踏板，最下面是你听到的声音。用你自己的键盘和踏板弹和弦，它就跟着你。"
        >
          <LegatoPedalling
            labels={{ clean: '正好', early: '太早', late: '太晚', watch: '看一看' }}
            readouts={{
              clean: '每个和弦之后马上抬起、马上踩下：每个和弦都连进下一个，又各自清楚。',
              early: '每个和弦之前就抬起：声音停了，新和弦在一段空白之后才响起来。',
              late: '每个和弦之后很久才抬起：旧和弦一直在新和弦下面响着。',
            }}
            live="你的琴键和踏板，正在弹。"
          />
        </Plate>
        <Aside title="边弹边念">
          <p>「弹——抬、踩。」先和弦，后脚。一个和弦接一个和弦慢慢练，直到脚自己跟着手走。</p>
        </Aside>
      </Section>

      <Section id="when" title="什么时候换">
        <p>
          和声一变就换踏板，通常就是低音换了新和弦的时候。在同一个和声里一直踩着，这些音会一起共鸣，正是应有的效果；踩进下一个和声，两个和弦就混在一起了。
        </p>
        <Plate caption="这四个和弦三种弹法：不踩踏板，一直踩到底，随每个和弦换。只有最后一种既连得起来，又清清楚楚。">
          <PedalledChords
            uses={['none', 'held', 'changed']}
            marks={['line']}
            labels={USES}
            readouts={{
              none: '手要离开每个和弦才够得到下一个：和弦之间有空隙。',
              held: '每个和弦都响进下一个：一片混浊。',
              changed: '每个和弦都被踏板接住，到下一个和弦时放掉：又连又清楚。',
            }}
            staffLabel="大谱表上的四个和弦：C、F、G、C，下方标着踏板"
          />
        </Plate>
        <p>
          程度深一些的演奏者还会只把踏板抬起一部分，让制音器轻轻擦过琴弦：这种
          <strong>半踏板</strong>
          让声音变薄，又不让它完全停下。
        </p>
        <p>在踏板会把音乐弄浑的地方，就不踩，或者少踩：</p>
        <ul>
          <li>巴赫和他那个时代的大部分音乐，音要靠手指连；</li>
          <li>快速的音阶和跑动，音会堆成一团；</li>
          <li>跳音，踏板会把它们又变长。</li>
        </ul>
        <p>拿不准的时候就听：声音浑了，就换得勤一些，或者踩得浅一些。</p>
      </Section>

      <Section id="try-it" title="试一试：四个和弦">
        <p>
          用右手弹这四个和弦，每个和弦之后换一次踏板：第一个和弦之后踩下，之后每个新和弦都是「弹——抬、踩」。踏板在和弦之后四分之一秒内抬起，0.4
          秒内再踩下，这次换踏板就算干净。这需要一个接在 MIDI 键盘上的延音踏板。
        </p>
        <Plate>
          <PedalExercise
            prompt="C、F、G、C：弹一个和弦，换一次踏板。"
            skipTo="test-yourself"
            needsPedal="这个练习需要 MIDI 键盘上的延音踏板。可以跳过它，做完下面的题目，这一课就完成了。"
            summary="{total} 次换踏板里，{clean} 次是干净的。"
            verdicts={{
              pending: '第 {n} 次：……',
              clean: '第 {n} 次：干净，和弦之后 {up} 毫秒抬起，又过 {down} 毫秒踩下。',
              early: '第 {n} 次：在和弦之前 {ms} 毫秒就抬起了，声音断开。',
              late: '第 {n} 次：在和弦之后 {ms} 毫秒才抬起，声音混浊。',
              held: '第 {n} 次：到下一个和弦都没抬起，和弦混在一起。',
              slow: '第 {n} 次：过了 {ms} 毫秒才踩下，和弦没被接住。',
              none: '第 {n} 次：踏板没有踩着。',
            }}
          />
        </Plate>
      </Section>

      <Section id="test-yourself" title="考考自己">
        <Plate>
          <ChoiceQuiz prompt="关于踏板。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>
          在「弹奏」页面上，被踏板延住的琴键会一直亮着，你能看到哪些音还在响。在那里弹任何曲子的和弦，每换一个和弦就换一次踏板。
        </p>
      </Section>
    </>
  );
}
