import { Plate } from '../kit.tsx';
import { ROADMAPS } from '../roadmapExamples.ts';
import { Barlines, Ottava, RoadMap } from '../roadmapFigures.tsx';
import type { TermTexts } from './index.ts';

const PLAYED = '演奏順序：';
const LISTEN = '播放時每個小節響一個音，跳回去時就會再聽到同樣的音。';

const TEXTS: TermTexts = {
  barline: () => (
    <>
      <p>
        小節線把拍子分成一組一組：4/4
        拍每小節四拍，小節線後的第一拍最強。小節裡寫的升降記號，一直有效到下一條小節線。
      </p>
      <p>
        雙小節線表示一段結束，常常是換調號或換拍號的地方。一細一粗表示全曲結束。在它前面加兩個點，音樂就要回頭：這就是反覆記號。
      </p>
      <Plate caption="由左到右四種小節線。">
        <Barlines
          label="四個小節，分別以小節線、雙小節線、反覆記號和終止線結束"
          names={['小節線', '雙小節線', '反覆', '終止線']}
        />
      </Plate>
    </>
  ),

  'repeat-sign': () => (
    <>
      <p>
        點在直線後面的記號是反覆的開始，點在直線前面的是反覆的結束。彈到結束記號，回到開始記號，第二遍就越過它繼續往下彈。
      </p>
      <p>沒有開始記號時，就回到曲子開頭。除非譜上另有說明，這一段總共彈兩遍。</p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.repeat}
          label="五個小節，第 2 到 4 小節在反覆記號之間"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'first-and-second-endings': () => (
    <>
      <p>
        括線前面的小節兩遍都一樣，只有結尾不同。一房通常把音樂帶回反覆的開頭，二房接著往下走，或者結束全曲。
      </p>
      <p>標著 1. 2. 的括線兩遍都彈。如果有三房 3.，那一段就要彈三遍。</p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.endings}
          label="第 1 到 3 小節反覆，第 3 小節是一房，第 4 小節是二房"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'da-capo': () => (
    <>
      <p>
        capo 是「頭」的意思：D.C. 讓你回到第一小節。只寫 D.C. 時，就是從頭再彈到結尾。dacapo
        的名字就來自它。
      </p>
      <p>
        跳回去以後，反覆通常只彈一遍，有幾個結尾的只彈最後一個。小步舞曲和中段（Trio）就是這樣：中段末尾寫著「小步舞曲
        D.C.」，小步舞曲再彈一遍，不帶反覆。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.daCapo}
          label="四個小節，第 2 小節末尾是 Fine，第 4 小節末尾是 D.C. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  'dal-segno': () => (
    <>
      <p>
        segno 記號寫在回來時開始的那個小節上方，前面常常是一段不再重複的前奏。D.S. al Fine 接著彈到
        Fine 為止；D.S. al Coda 彈到 To Coda，再從那裡跳到尾聲。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.dalSegno}
          label="四個小節，第 2 小節上方有記號，第 3 小節末尾是 Fine，第 4 小節末尾是 D.S. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  fine: () => (
    <>
      <p>
        第一遍經過 Fine 時不用停。只有在 D.C. 或 D.S.
        把你送回去以後它才算數，它常常寫在一段反覆的末尾，而跳回去以後這段只彈一遍。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.fine}
          label="第 1、2 小節反覆，第 2 小節末尾是 Fine，然後是第 3、4 小節和 D.C. al Fine"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  coda: () => (
    <>
      <p>
        coda 在義大利文裡是「尾巴」。它的記號成對出現：一個旁邊寫著 To
        Coda，標出跳回去之後從哪裡離開；另一個寫在結尾段上方，標出落到哪裡。中間的小節不管有多少，都跳過去。
      </p>
      <Plate caption={LISTEN}>
        <RoadMap
          bars={ROADMAPS.coda}
          label="六個小節：第 2 小節上方有記號，第 3 小節末尾是 To Coda，第 4 小節末尾是 D.S. al Coda，尾聲從第 5 小節開始"
          orderLabel={PLAYED}
        />
      </Plate>
    </>
  ),

  ottava: () => (
    <>
      <p>
        遠在譜表上方的音要加很多加線，讀起來慢。寫了 8va
        線，就可以把它們寫低一個八度，寫在眼睛熟悉的位置；線結束的地方，或寫著 loco
        的地方，恢復照譜彈。
      </p>
      <p>
        8vb，或寫在音符下方的 8va，表示低一個八度。col 8va
        是要彈八度：每個音和高它一個八度的音一起彈。
      </p>
      <Plate caption="同樣三個音，一次寫在 8va 線下，一次寫在實際發聲的位置。">
        <Ottava
          label="8va 線下的 C5、D5、E5，然後是實際發聲的 C6、D6、E6"
          written="寫法"
          played="彈法"
        />
      </Plate>
    </>
  ),
};

export default TEXTS;
