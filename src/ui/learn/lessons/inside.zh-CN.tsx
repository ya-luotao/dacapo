import { ChoiceQuiz } from '../exercises.tsx';
import { InsideAction, type InsideCopy } from '../InsideAction.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const COPY: InsideCopy = {
  label: '三角钢琴一个键的击弦机剖面图，随着弹奏而运动',
  speeds: { real: '真实速度', slow4: '慢 4 倍', slow10: '慢 10 倍' },
  touch: { key: '按你的力度', soft: '轻', loud: '重' },
  names: '名称',
  sustain: '延音踏板',
  play: '弹一个音',
  pressed: '琴键',
  loudness: '音量',
  pointAt: '把指针移到任意一个部件上，看看它是做什么的。',
  parts: {
    key: {
      name: '琴键',
      text: '（英文 key）架在平衡轨上的一根杠杆：按下前端，后端就抬起来。',
    },
    capstan: {
      name: '顶柱',
      text: '（英文 capstan）琴键上的一颗小螺丝，负责顶起转击器。拧动它可以调节机械多早开始响应。',
    },
    wippen: {
      name: '转击器',
      text: '（英文 wippen）一根杠杆，把琴键的动作传给顶杆和复奏杠杆。',
    },
    jack: {
      name: '顶杆',
      text: '（英文 jack）从琴槌柄下的滚轴把琴槌推上去，在琴槌碰到琴弦之前从它下面脱开。',
    },
    letoff: {
      name: '脱击钮',
      text: '（英文 let-off button）顶杆的脚碰到它，顶杆就倒向一边：琴槌在离琴弦两三毫米的地方被放开。',
    },
    repetition: {
      name: '复奏杠杆',
      text: '（英文 repetition lever）一根带弹簧的杠杆。琴键稍稍抬起时，它把琴槌托住，让顶杆能回到琴槌下面，这个音就能马上再弹一次。',
    },
    hammer: {
      name: '琴槌',
      text: '（英文 hammer）装在木柄上的硬毛毡。它独自飞向琴弦，击中后立刻弹开，琴弦才能继续振动。',
    },
    backcheck: {
      name: '托槌器',
      text: '（英文 backcheck）按住琴键时，它托住落下的琴槌尾部，不让琴槌再弹回去碰到琴弦。',
    },
    damper: {
      name: '制音器',
      text: '（英文 damper）压在琴弦上的一块毛毡。弹奏时琴键把它抬起；松开琴键，它落回弦上，声音就停了。',
    },
    string: {
      name: '琴弦',
      text: '（英文 string）绷得非常紧的钢丝。一台三角钢琴所有琴弦的拉力加起来，大约有二十吨。',
    },
    soundboard: {
      name: '音板',
      text: '（英文 soundboard）琴弦的振动经过琴马传到一大块薄薄的木制音板上，声音才大到能充满整个房间。',
    },
  },
  steps: [
    { phase: 'down', text: '琴键按下。顶柱顶起转击器，顶杆把琴槌往上推。' },
    { phase: 'free', text: '脱击：顶杆的脚碰到脱击钮，顶杆倒开。琴槌独自继续飞。' },
    { phase: 'strike', text: '琴槌击中琴弦，并立刻弹回。' },
    { phase: 'checked', text: '托槌器接住琴槌。制音器是抬起的：只要按着琴键，琴弦就一直在响。' },
    {
      phase: 'repeat',
      text: '把琴键稍稍抬起：复奏杠杆托起琴槌，顶杆回到它下面，这个音就能再弹一次。',
    },
    { phase: 'release', text: '松开：琴槌回到原位，制音器落回琴弦，声音停止。' },
  ],
};

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        钢琴是一台把小小的毛毡琴槌扔向琴弦、再把它接住的机器。从你的手指到琴弦之间，每个键都有一套自己的小机械，叫作
        <strong>击弦机</strong>
        ：木头杠杆、毛毡、呢布和弹簧，调校精度以零点几毫米计。在这里或者在你自己的键盘上弹一个键，看看它是怎么工作的。
      </p>
      <Picture
        src="learn/inside-a-grand.webp"
        alt="打开琴盖的三角钢琴内部：铁骨架、铺展在音板上方的琴弦，以及调音钉。"
        caption="三角钢琴的琴盖下面：铁骨架、音板上方的琴弦、调音钉。击弦机就在琴弦下面、靠键盘的那一端。"
      />

      <Section id="action" title="一个键，慢动作">
        <p>
          这是三角钢琴的一个键，从中间剖开、从侧面看，你坐在左边。按任意一个键，图里就按你按下的速度把它弹出来。真实速度太快、看不清，所以默认慢了四倍。放慢的只是图：声音会立刻响起，比图里的琴槌先到。
        </p>
        <Plate
          wide
          caption="在你的键盘上或下面的键盘上按一个键，或者点「弹一个音」。放慢速度可以看清每一步，下面的步骤会随之亮起。"
        >
          <InsideAction copy={COPY} />
        </Plate>
      </Section>

      <Section id="flying-free" title="琴槌是飞出去的">
        <p>
          钢琴最让人意外的一点是：你从来没有把琴槌按到琴弦上。就在它快要碰到琴弦的时候，顶杆从它下面倒开（这叫
          <strong>脱击</strong>），琴槌自己飞完最后几毫米，击中琴弦后立刻弹开，琴弦才能继续响。
        </p>
        <p>
          所以琴槌一旦飞出去，你再做什么都改变不了这个音。琴键按到底以后再使劲，一点用也没有。让声音变大的只有一件事：琴槌被扔出去的速度，也就是你按键有多快。在上面试试：用
          MIDI
          键盘先慢慢按，再快快按，看看音量。电脑键盘和鼠标点击的速度总是一样的，可以改选「轻」或「重」来比较。
        </p>
        <Aside title="为什么一定要放开">
          <p>
            如果琴槌一直压在琴弦上，就会像手指按在吉他弦上一样，立刻让它停下来：你听到的只会是「咚」的一声，而不是一个音。
          </p>
        </Aside>
      </Section>

      <Section id="pedals" title="制音器与踏板">
        <p>
          除了最高音区的几个键，每个键都有一个<strong>制音器</strong>
          。弹奏时琴键把它抬起，松开时它落下，所以一个音正好响到你松手为止。
        </p>
        <ul>
          <li>
            右踏板是<strong>延音踏板</strong>
            ，一次把所有制音器都抬起来：松开琴键后音还在响，其他琴弦也会跟着共鸣。在上面打开它，再松开一个键试试。
          </li>
          <li>
            左踏板是<strong>弱音踏板</strong>
            ：在三角钢琴上，它把整套击弦机稍稍往旁边推，让每个琴槌少打一两根弦（大部分音有三根弦），声音更轻、更柔。
          </li>
          <li>
            中踏板在多数三角钢琴上只保持已经抬起的那些制音器，这样一个和弦可以持续，后面的音仍然短促。
          </li>
        </ul>
      </Section>

      <Section id="upright" title="三角钢琴与立式钢琴">
        <p>
          立式钢琴的琴弦是竖着的，所以琴槌向前打而不是向上打，靠弹簧而不是自身重量回位。它的击弦机没有这样的复奏杠杆：琴键要抬起大半才能再弹一次。三角钢琴的双重擒纵机构由埃拉尔（Sébastien
          Érard）在 1821
          年取得专利，让演奏者在琴键只抬起一部分时就能再弹同一个音，所以快速同音反复在三角钢琴上更容易。
        </p>
      </Section>

      <Section id="try-it" title="考考你">
        <Plate>
          <ChoiceQuiz
            prompt="关于刚才看到的，四个问题。"
            questions={[
              {
                id: 'loud',
                question: '怎样让一个音更响？',
                figure: null,
                options: ['按键按得更快', '按到底以后再使劲', '按住琴键更久'],
                answer: 0,
              },
              {
                id: 'stop',
                question: '松开琴键时，是什么让声音停下来的？',
                figure: null,
                options: ['琴槌', '制音器', '托槌器'],
                answer: 1,
              },
              {
                id: 'free',
                question: '为什么琴槌不会一直压在琴弦上？',
                figure: null,
                options: ['顶杆在它击弦之前就放开了它', '制音器把它推开了', '琴弦太紧了'],
                answer: 0,
              },
              {
                id: 'pedal',
                question: '延音踏板的作用是什么？',
                figure: null,
                options: ['把所有制音器从琴弦上抬起', '让琴槌离琴弦更近', '让琴弦绷得更紧'],
                answer: 0,
              },
            ]}
            onComplete={complete}
          />
        </Plate>
      </Section>
    </>
  );
}
