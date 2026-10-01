import { SequenceExercise } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { FingerNumbers, FingeringOnStaff, FivePosition } from '../theoryFigures.tsx';

const RANGE: readonly [number, number] = [48, 71]; // C3–B4

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        怎麼坐、手怎麼放，決定了手指做得到什麼。好習慣在一開始養成，比日後再改容易得多，也能讓你一直彈得舒服。
      </p>

      <Section id="sitting" title="坐在鋼琴前">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="從側面看一位坐在琴椅上彈琴的人：前臂與琴鍵齊平，背挺直，雙腳平放在地上。"
          caption="側面看：前臂與琴鍵大致齊平，手肘略在身體前方，背挺直，雙腳放平。"
        />
        <ul>
          <li>坐在琴椅的前半部，面對中央 C。</li>
          <li>
            <strong>高度</strong>
            ：前臂與琴鍵大致齊平。太低，手腕會塌到琴鍵下面；太高，肩膀會聳起來。可以把琴椅調高，或者墊一個結實的坐墊。
          </li>
          <li>
            <strong>距離</strong>
            ：雙手放在琴鍵上時，手肘略在身體前方。如果手肘頂著身體兩側，就把琴椅往後挪。
          </li>
          <li>背挺直，從髖部微微前傾；肩膀放低、放鬆。</li>
          <li>雙腳平放在地上，右腳靠近踏板。</li>
        </ul>
        <Picture
          src="learn/seated-at-middle-c.webp"
          alt="從背後看一位彈琴的人，她坐在直立式鋼琴的正中間，雙手分別放在鍵盤中線的兩側。"
          caption="背後看：坐在鍵盤正中間，兩隻手分別在中央 C 兩側。"
        />
      </Section>

      <Section id="hand-shape" title="手型">
        <Picture
          src="learn/curved-hand.webp"
          alt="從側面看放在琴鍵上的右手：手指自然彎曲，指尖落在琴鍵上，手腕與手背齊平。"
          caption="手指彎曲，像輕輕握著一顆小球；大拇指用指尖側面彈；手腕與手背齊平。"
        />
        <p>
          先讓手臂自然垂在身體兩側，再維持手的形狀抬到琴鍵上：手指會自然彎成一道弧。用指尖彈，不要用平平的指腹；大拇指用指尖外側彈。手腕保持平，既不塌到琴鍵下面，也不高過手背。
        </p>
        <Aside title="保持放鬆">
          <p>
            如果手、手腕或肩膀覺得緊，就停下來甩一甩。緊繃會讓彈琴更費力，忍著痛繼續彈可能會受傷。
          </p>
        </Aside>
      </Section>

      <Section id="finger-numbers" title="指法數字">
        <p>
          鋼琴譜替兩隻手的手指用同一套編號：大拇指是 <strong>1</strong>，食指 <strong>2</strong>
          ，中指 <strong>3</strong>，無名指 <strong>4</strong>，小指 <strong>5</strong>。
        </p>
        <FingerNumbers
          alt="兩隻手掌心朝下，手指張開，兩個大拇指相對。"
          left="左手"
          right="右手"
          caption="兩隻手都是大拇指為 1、小指為 5，編號左右對稱。"
        />
        <p>需要用某一根特定的手指時，樂譜會把數字印在音符上方：</p>
        <Plate caption="C、D、E、F、G 上方的 1 到 5：右手的第一個位置。">
          <FingeringOnStaff label="上方標有指法數字的五個音" />
        </Plate>
      </Section>

      <Section id="five-fingers" title="五指位置">
        <p>
          讓右手每根手指各對準一個白鍵，大拇指放在中央 C：1 在 C，2 在 D，3 在 E，4 在 F，5 在
          G。左手低一個八度、左右對稱：小指在 C3，大拇指在 G3。這就是 <strong>C 位置</strong>
          ，很多入門曲子從頭到尾都在這個位置上。
        </p>
        <Plate caption="每個鍵都標出了彈它的手指。">
          <FivePosition labels={{ left: '左手', right: '右手', both: '雙手' }} />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試">
        <p>一根手指對一個鍵，上去再下來，手指保持彎曲。看著標出的手指彈，不要只看鍵。</p>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[60, 62, 64, 65, 67, 65, 64, 62, 60]}
            fingers={[1, 2, 3, 4, 5, 4, 3, 2, 1]}
            prompt="右手，大拇指從中央 C 開始。"
          />
        </Plate>
        <Plate>
          <SequenceExercise
            range={RANGE}
            keys={[48, 50, 52, 53, 55, 53, 52, 50, 48]}
            fingers={[5, 4, 3, 2, 1, 2, 3, 4, 5]}
            prompt="左手，小指從 C3 開始。"
            onComplete={complete}
          />
        </Plate>
        <p>
          保持這個手型，後面學什麼都會更順。接下來，「彈奏」「識譜」和入門的「樂曲」會把這些都用上。
        </p>
      </Section>
    </>
  );
}
