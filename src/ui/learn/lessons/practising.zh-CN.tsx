import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { PracticePlan, TempoLadder, type PlanPart } from '../practiceFigures.tsx';

const PARTS: readonly PlanPart[] = [
  {
    id: 'warm-up',
    name: '热身：',
    what: '一两条音阶，慢慢弹，弹均匀。',
    weight: 15,
  },
  {
    id: 'hard-spots',
    name: '难点：',
    what: '一次一两个小节，慢速循环，再稍微加快一点。',
    weight: 40,
  },
  {
    id: 'new',
    name: '新内容：',
    what: '新曲子往下的几行，或者练一会儿识谱、练耳。',
    weight: 15,
  },
  {
    id: 'play-through',
    name: '完整弹一遍：',
    what: '一首曲子从头弹到尾，中间不停，就当有人在听。',
    weight: 20,
  },
  {
    id: 'for-fun',
    name: '弹着玩：',
    what: '弹一首你已经会、又喜欢弹的曲子。',
    weight: 10,
  },
];

/** Moves each question's answer, written first, to a place of its own among the options. */
function vary(questions: readonly ChoiceQuestion[]): ChoiceQuestion[] {
  return questions.map((q, i) => {
    const k = i % q.options.length;
    return {
      ...q,
      options: [...q.options.slice(k), ...q.options.slice(0, k)],
      answer: (q.options.length - k) % q.options.length,
    };
  });
}

const QUESTIONS: readonly ChoiceQuestion[] = vary([
  {
    id: 'same-slip',
    question: '第 12 小节的同一个音你老是弹错。怎样最管用？',
    figure: null,
    options: [
      '慢慢弹第 12 小节，直到连续几遍都弹对',
      '整首曲子从头再弹一遍',
      '把第 12 小节弹快一点，冲过去',
    ],
    answer: 0,
  },
  {
    id: 'tempo',
    question: '一段刚开始学的乐句，应该弹多快？',
    figure: null,
    options: ['慢到能一个错都不出', '照乐谱上标的速度', '能弹多快就弹多快'],
    answer: 0,
  },
  {
    id: 'daily',
    question: '哪一种对你的进步更有用？',
    figure: null,
    options: ['每天专心练二十分钟', '每星期一次练两个小时'],
    answer: 0,
  },
  {
    id: 'start',
    question: '练一首曲子，一般从哪里开始？',
    figure: null,
    options: ['从最难的那段开始，趁精神好', '永远从第一小节开始', '从弹得最好的地方开始'],
    answer: 0,
  },
  {
    id: 'through',
    question: '什么时候该把曲子从头到尾不停地弹一遍？',
    figure: null,
    options: [
      '在一次练习快结束时，还有弹给别人听之前',
      '从第一天起，每次练都这样弹',
      '永远不要：出错就一定要停下来改',
    ],
    answer: 0,
  },
  {
    id: 'slip',
    question: '给家人弹的时候弹错了一个音。怎么办？',
    figure: null,
    options: ['接着弹，在下一拍重新跟上', '停下来，从头再来', '停下来，把这一小节弹对为止'],
    answer: 0,
  },
  {
    id: 'memory',
    question: '背下来的曲子，怎样在紧张的时候也不会忘？',
    figure: null,
    options: [
      '用好几种方式记住：它的声音、和声、形状，还有左右手各自单独会弹',
      '弹得够多，让手指自己记住',
      '在脑子里想着那一页乐谱',
    ],
    answer: 0,
  },
  {
    id: 'pain',
    question: '练着练着，手腕开始疼了。现在怎么办？',
    figure: null,
    options: [
      '停下来休息，之后弹得轻一些；如果还疼，去问老师或医生',
      '忍着弹下去，手腕会变结实',
      '更用力地按键',
    ],
    answer: 0,
  },
  {
    id: 'app',
    question: '哪一样是 App 听不出来的？',
    figure: null,
    options: ['你的音色，还有你怎么用手臂和手腕', '你弹了哪些键', '你什么时候弹的'],
    answer: 0,
  },
]);

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        练琴不是把一首曲子弹了一遍又一遍。练琴是找出还弹不好的地方，一点一点把它弹好，让下一次容易一些。有几个好习惯，能让同样的时间练出多得多的效果。
      </p>

      <Section id="slowly" title="慢练">
        <p>
          手会记住它反复做的事，错误也一样。一段弹得太快、磕磕绊绊，你练的就是磕绊。弹得够慢，每个音、每个指法、每个节奏都弹对，手记住的就是对的。
        </p>
        <p>
          所以，从一个能不出错的速度开始，慢到什么程度都没关系。连续弹对几遍，再加快一小步。一旦乱了，就退回一步。感觉很慢，其实这是最快的路。
        </p>
        <Plate caption="通往目标速度的梯子：《欢乐颂》的开头，先用目标速度的 60%、70%、80%、90%，最后用目标速度本身。下面一级弹干净了，才上一级。">
          <TempoLadder
            labels={{
              target: '目标速度',
              rung: '{percent}%：♩ = {bpm}',
              readout: '连续三遍弹干净，再往上走一级。',
            }}
            staffLabel="高音谱表上《欢乐颂》的前四小节"
          />
        </Plate>
        <p>
          <Link href="/metronome">「节拍器」</Link>
          可以替你爬这架梯子：它的「速度训练」能逐渐加快，每隔几小节快几拍，从起始速度一直到目标速度。「静音小节」会时不时停掉嗒嗒声，让你自己把拍子稳住。在「曲目」里，速度可以设成乐谱标记的某个百分比；选「等待」模式时，乐谱会等你弹完每个音，多慢都行。
        </p>
      </Section>

      <Section id="chunks" title="分段练">
        <p>
          一次只练一两个小节，不要一下子练一整页。弹完这一段，再带上下一小节的第一个音，这样接缝处也练到了。两段都稳了，把它们连起来，再连上后面一段。
        </p>
        <p>
          在<Link href="/pieces">「曲目」</Link>
          里，「循环」可以把同几个小节反复弹：设好从哪一小节到哪一小节。弹过几遍之后，「薄弱小节」会标出你在哪里变慢、弹错，还能直接循环最弱的那几个小节。
        </p>
      </Section>

      <Section id="hands" title="先分手，再合手">
        <p>
          每只手单独练到轻松为止，再把两只手合起来，慢慢地，一次几个小节。合手本身就是一门功夫，所以要比单手更慢。哪只手觉得难，就多给它一些时间；对大多数人来说，是左手。在「曲目」里可以只练右手、只练左手，或者双手一起。
        </p>
      </Section>

      <Section id="stop-or-go" title="停下来改，还是弹下去">
        <p>练一首曲子有两种方法，两种都要用。</p>
        <ul>
          <li>
            <strong>停下来改。</strong>
            出了错就停。弄清楚是哪里错了（一个音、一个指法，还是节奏），把那个地方慢慢地、正确地弹几遍，再连同前后各一小节弹一遍。曲子就是这样学会的，大部分时间都该花在这里。
          </li>
          <li>
            <strong>弹下去。</strong>
            从头弹到尾，不管发生什么都不停，就像有人在听。这样才知道哪些地方真的稳了，也练的是出错后接着弹的本事。
          </li>
        </ul>
        <p>
          学一首曲子时主要用第一种；每次练习快结束时用第二种弹一遍，离演奏越近，就弹得越多。在「曲目」里，「等待」模式适合停下来改：它等你弹对了才往下走。「节奏」模式适合弹下去：乐谱按时往前走，每个音都会计时。
        </p>
      </Section>

      <Section id="hard-first" title="先练最难的那一小节">
        <p>
          如果每次都从头开始，第一页会被弹上一百遍，最后一页却几乎没练过。趁精神好，先练最难的那一段。也可以从不同的地方开始：从中间，从最后一行，从每一段的开头。一首曲子的结尾，应该是你最熟的地方。
        </p>
      </Section>

      <Section id="daily" title="时间短，隔开练，天天练">
        <p>
          每天练一点，胜过偶尔练很多。两次练习之间，手和大脑还在继续学，睡觉的时候尤其如此。所以每天专心练二十分钟，比星期天一口气练两个小时更有用。关键是「专心」：在一个难点上练二十分钟，胜过把已经会的东西从头弹一个小时。
        </p>
        <p>
          坐下之前先想好这次练什么，把最难的放在前面。练得久，就中间歇几次。
          <Link href="/progress">「进度」</Link>
          页会记下你连续练了几天，还有今天离每日目标还差几分钟。
        </p>
        <Plate caption="把一次练习分成几部分。选一选你有多少时间；难点分到的时间最多。">
          <PracticePlan
            parts={PARTS}
            labels={{
              length: '这次练习',
              minutes: '{n} 分钟',
              total: '一次 {n} 分钟的练习',
            }}
          />
        </Plate>
        <Aside title="在弹得顺的时候收工">
          <p>用一段弹得好的东西结束。第二天你会更愿意坐回琴前，最后弹的东西也记得最牢。</p>
        </Aside>
      </Section>

      <Section id="by-heart" title="背谱">
        <p>
          一首曲子弹得多了，手指自己就会记住。可是一紧张，最先靠不住的就是手指的记忆，那时就没有别的可依靠了。背得牢的曲子，是同时用好几种方式记住的：
        </p>
        <ul>
          <li>
            <strong>用耳朵记</strong>：能把旋律唱出来，知道下面是什么声音。
          </li>
          <li>
            <strong>用和声和曲式记</strong>：知道每一小节是什么和弦，哪些乐句会再出现。
          </li>
          <li>
            <strong>用形状记</strong>：两只手在键盘上的位置，手指下面的音型。
          </li>
          <li>
            <strong>左右手各自记</strong>：不靠另一只手，也能单独弹出任何一只手。
          </li>
        </ul>
        <p>背一首曲子的计划，每天背几个小节：</p>
        <ol>
          <li>先听，把旋律唱出来。</li>
          <li>说出每小节的和弦，标出每一段：每个乐句从哪里开始，哪些地方是重复的。</li>
          <li>看着谱学一个乐句，先分手，再合手。</li>
          <li>不看谱弹，先单手，再合手。实在想不起来才看。</li>
          <li>
            选好<strong>地标</strong>：每个乐句、每一段的开头。练习从每一个地标开始弹，顺序随意。
          </li>
          <li>离开琴，在脑子里把它弹一遍，想象手怎么动。</li>
          <li>第二天，先凭记忆弹一遍，再去看谱。</li>
        </ol>
      </Section>

      <Section id="performing" title="弹给别人听">
        <p>
          弹给别人听，谁都会紧张；心跳加快、手发凉，都很正常。多练几次就会好很多，所以这也要练。
        </p>
        <ul>
          <li>
            <strong>找个人听你弹</strong>
            ：朋友、家人，或者打个视频电话。告诉他们你在练习演奏，然后从头弹到尾。
          </li>
          <li>
            <strong>给自己录音</strong>
            ，用手机就行，过一阵再听。你会听到弹的时候听不到的东西：哪一小节赶了，旋律被和弦盖住了。
          </li>
          <li>
            <strong>开始前有一套固定的准备</strong>
            ：调好琴凳，手放在膝盖上，慢慢呼一口气，在脑子里按速度把第一小节过一遍，然后开始。
          </li>
          <li>
            <strong>弹错了，接着弹。</strong>
            听的人很少注意到一个错音，可是停下来谁都听得出。在下一拍，或者下一个地标，重新跟上。
          </li>
        </ul>
      </Section>

      <Section id="healthy" title="弹琴不要勉强">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="从侧面看坐在琴凳上的钢琴演奏者：前臂与琴键齐平，背挺直，双脚平放在地上。"
          caption="照「坐姿、手型与指法」一课那样坐：前臂与琴键齐平，背挺直，双脚放平。"
        />
        <p>
          弹琴不应该疼。肩膀放低、放松，手腕灵活，让手臂的重量去弹键，而不是用力捏。音响起来以后就别再往下按了：键只需要保持住，不需要用力压。
        </p>
        <ul>
          <li>每二三十分钟歇一会儿：站起来，甩甩手。</li>
          <li>疼是让你停下来的信号，不要硬撑。休息，弹得轻一些；如果还疼，去问老师或医生。</li>
          <li>
            手有大有小。不要硬去够太宽的音程：太宽的和弦可以分开弹，不是旋律也不是低音的音可以省掉，或者交给另一只手。
          </li>
        </ul>
      </Section>

      <Section id="teacher" title="App 听不出来的东西">
        <p>
          dacapo 能听出你弹了哪些键、什么时候弹的，用 MIDI
          键盘时还能听出弹得多重。这已经很多了，但不是全部。它听不出你的音色，听不到房间里的声音，也听不出一个乐句有没有歌唱性。它看不到你的手臂、手腕和肩膀，而紧张的习惯，防止比纠正容易得多。
        </p>
        <p>
          老师能听到、看到这一切。哪怕只是偶尔上几节课，让老师看看你怎么坐、怎么动、弹出来是什么声音，也很值得；两次课之间，再用
          App 来练。
        </p>
      </Section>

      <Section id="try-it" title="试一试">
        <p>回答几个关于这一课的问题。</p>
        <Plate>
          <ChoiceQuiz prompt="怎样练琴。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>然后在「曲目」里选一首曲子，找出最难的几个小节，慢速循环，一级一级往上走。</p>
      </Section>
    </>
  );
}
