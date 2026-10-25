import { Plate } from '../kit.tsx';
import { ROADMAPS } from '../roadmapExamples.ts';
import { Barlines, Ottava, RoadMap } from '../roadmapFigures.tsx';
import type { TermTexts } from './index.ts';

const PLAYED = '演奏顺序：';
const LISTEN = '播放时每个小节响一个音，跳回去时就会再听到同样的音。';

const TEXTS: TermTexts = {
  barline: () => (
    <>
      <p>
        小节线把拍子分成组：4/4
        拍每小节四拍，小节线后的第一拍最强。小节里写的升降号，一直管到下一条小节线。
      </p>
      <p>
        双小节线表示一段结束，常常是换调号或换拍号的地方。一细一粗表示全曲结束。在它前面加两个点，音乐就要回头：这就是反复记号。
      </p>
      <Plate caption="从左到右四种小节线。">
        <Barlines
          label="四个小节，分别以小节线、双小节线、反复记号和终止线结束"
          names={['小节线', '双小节线', '反复', '终止线']}
        />
      </Plate>
    </>
  ),

  'repeat-sign': () => (
    <>
      <p>
        点在竖线后面的那个记号是反复的开始，点在竖线前面的是反复的结束。弹到结束记号，回到开始记号，第二遍就越过它往下弹。
      </p>
      <p>没有开始记号时，就回到曲子开头。除非谱上另有说明，这一段一共弹两遍。</p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.repeat}
          label="五个小节，第 2 到 4 小节在反复记号之间"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'first-and-second-endings': () => (
    <>
      <p>
        括线前面的小节两遍一样，只有结尾不同。第一结尾通常把音乐带回反复的开头，第二结尾接着往下走，或者结束全曲。
      </p>
      <p>标着 1. 2. 的括线两遍都弹。如果有第三结尾 3.，那一段就要弹三遍。</p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.endings}
          label="第 1 到 3 小节反复，第 3 小节是第一结尾，第 4 小节是第二结尾"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'da-capo': () => (
    <>
      <p>
        capo 是“头”的意思：D.C. 让你回到第一小节。只写 D.C. 时，就是从头再弹到结尾。dacapo
        的名字就来自它。
      </p>
      <p>
        跳回去以后，反复通常只弹一遍，有几个结尾的只弹最后一个。小步舞曲和三声中部就是这样：三声中部末尾写着“小步舞曲
        D.C.”，小步舞曲再弹一遍，不带反复。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.daCapo}
          label="四个小节，第 2 小节末尾是 Fine，第 4 小节末尾是 D.C. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'dal-segno': () => (
    <>
      <p>
        segno 记号写在回来时开始的那个小节上方，前面常常是一段不再重复的引子。D.S. al Fine 接着弹到
        Fine 为止；D.S. al Coda 弹到 To Coda，再从那里跳到尾声。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.dalSegno}
          label="四个小节，第 2 小节上方有记号，第 3 小节末尾是 Fine，第 4 小节末尾是 D.S. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  fine: () => (
    <>
      <p>
        第一遍经过 Fine 时不用停。只有在 D.C. 或 D.S.
        把你送回去以后它才算数，它常常写在一段反复的末尾，而跳回去以后这段只弹一遍。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.fine}
          label="第 1、2 小节反复，第 2 小节末尾是 Fine，然后是第 3、4 小节和 D.C. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  coda: () => (
    <>
      <p>
        coda 在意大利语里是“尾巴”。它的记号成对出现：一个旁边写着 To
        Coda，标出跳回去之后从哪里离开；另一个写在结尾段上方，标出落到哪里。中间的小节不管有多少，都跳过去。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.coda}
          label="六个小节：第 2 小节上方有记号，第 3 小节末尾是 To Coda，第 4 小节末尾是 D.S. al Coda，尾声从第 5 小节开始"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  ottava: () => (
    <>
      <p>
        远在谱表上方的音要加很多加线，读起来慢。写了 8va
        线，就可以把它们写低一个八度，写在眼睛熟悉的地方；线结束的地方，或者写着 loco
        的地方，恢复按原样弹。
      </p>
      <p>
        8vb，或者写在音符下方的 8va，表示低一个八度。col 8va
        是要弹八度：每个音和高它一个八度的音一起弹。
      </p>
      <Plate caption="同样三个音，一次写在 8va 线下，一次写在实际发声的位置。">
        <Ottava
          label="8va 线下的 C5、D5、E5，然后是实际发声的 C6、D6、E6"
          written="写法"
          played="弹法"
        />
      </Plate>
    </>
  ),
};

export default TEXTS;
