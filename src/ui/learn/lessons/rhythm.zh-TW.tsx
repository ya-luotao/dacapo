import { ChoiceQuiz } from '../exercises.tsx';
import { Aside, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import {
  BeatPulse,
  RhythmRows,
  RhythmTap,
  TimeSignatures,
  ValueCard,
  type Beat,
} from '../rhythmFigures.tsx';

const w: Beat = { duration: 'whole' };
const h: Beat = { duration: 'half' };
const q: Beat = { duration: 'quarter' };
const e: Beat = { duration: 'eighth' };
const hd: Beat = { duration: 'half', dotted: true };
const qr: Beat = { duration: 'quarter', rest: true };
const hr: Beat = { duration: 'half', rest: true };

const VALUES: readonly [Beat, string, number][] = [
  [w, '全音符', 4],
  [q, '四分音符', 1],
  [h, '二分音符', 2],
  [e, '八分音符', 0],
  [hd, '附點二分音符', 3],
  [hr, '二分休止符', 2],
];

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        音高說的是音在哪裡，節奏說的是什麼時候。幾乎所有音樂底下都有一個穩定的拍子，像脈搏一樣；節奏就是每個音持續多久，用這些拍子來數。
      </p>

      <Section id="beat" title="拍子">
        <p>
          聽歌時跟著用腳打拍子，你打的就是它的<strong>拍子</strong>
          。不管上面的音走得快還是慢，拍子始終穩定。<strong>速度</strong>
          是拍子走得多快，用每分鐘多少拍（BPM）表示：60 就是一秒一拍。
        </p>
        <Plate caption="讓拍子響起來，跟著它隨便按一個鍵。每一下，早了會落在中線左邊，晚了落在右邊：盡量落在中間。">
          <BeatPulse labels={{ tempo: '速度' }} />
        </Plate>
      </Section>

      <Section id="note-values" title="一個音持續多久">
        <p>音符的樣子告訴你它持續幾拍：</p>
        <ul>
          <li>
            <strong>全音符</strong>：空心，沒有符桿。四拍。
          </li>
          <li>
            <strong>二分音符</strong>：空心，有符桿。兩拍。
          </li>
          <li>
            <strong>四分音符</strong>：實心，有符桿。一拍。
          </li>
          <li>
            <strong>八分音符</strong>
            ：實心，帶一條符尾，或者用符槓和旁邊的音連在一起。半拍：兩個八分音符合起來是一拍。
          </li>
        </ul>
        <Plate
          wide
          caption="每一行正好是四拍的一小節。點「聽聽看」：先有一小節預備拍，然後鋼琴彈出這些音，節拍聲一直在下面打著拍子。"
        >
          <RhythmRows
            rows={[
              { title: '全音符：4 拍', rhythm: [w] },
              { title: '二分音符：每個 2 拍', rhythm: [h, h] },
              { title: '四分音符：每個 1 拍', rhythm: [q, q, q, q] },
              { title: '八分音符：每個半拍', rhythm: [e, e, e, e, e, e, e, e] },
            ]}
          />
        </Plate>
        <Aside title="數出聲音來">
          <p>
            邊彈邊數。四分音符數「1、2、3、4」。八分音符在拍與拍之間加一個「and」：「1 and 2 and 3
            and 4 and」，寫作 1 &amp; 2 &amp;。這裡每個節奏下面都印著拍數。
          </p>
        </Aside>
      </Section>

      <Section id="rests-and-dots" title="休止符與附點">
        <p>
          <strong>休止符</strong>
          是一段靜默，時值和音符一一對應：全休止符掛在一條線下面，二分休止符坐在線上，四分休止符像一道閃電，八分休止符像一個小鉤子。遇到休止符要繼續數拍，只是不彈。
        </p>
        <p>
          音符後面的<strong>附點</strong>讓它再延長一半：附點二分音符是 2 + 1 = 3 拍。
        </p>
        <Plate wide caption="休止符和音符一樣要數。附點二分音符佔這一小節的三拍。">
          <RhythmRows
            rows={[
              { title: '四分音符、四分休止符、二分音符', rhythm: [q, qr, h] },
              { title: '二分休止符、兩個四分音符', rhythm: [hr, q, q] },
              { title: '附點二分音符、四分音符', rhythm: [hd, q] },
            ]}
          />
        </Plate>
      </Section>

      <Section id="time-signature" title="小節與拍號">
        <p>
          音樂用小節線分成一個個<strong>小節</strong>，開頭的<strong>拍號</strong>
          說明怎麼分：上面的數字是每小節幾拍，下面的數字表示以什麼音符為一拍（4 表示四分音符）。4/4
          拍每小節四拍，3/4 拍三拍，像圓舞曲；2/4 拍兩拍，像進行曲。
        </p>
        <p>每小節的第一拍最強。仔細聽它。</p>
        <Plate caption="同樣的四分音符，分成四個、三個、兩個一組。音調高的那一下是第 1 拍。">
          <TimeSignatures />
        </Plate>
      </Section>

      <Section id="try-it" title="試一試">
        <p>先說出每個音符和休止符持續幾拍，再跟著拍子把節奏打出來。</p>
        <Plate>
          <ChoiceQuiz
            prompt="它持續幾拍？"
            questions={VALUES.map(([beat, label, answer], i) => ({
              id: `${i}`,
              figure: <ValueCard beat={beat} label={label} />,
              options: ['½', '1', '2', '3', '4'],
              answer,
            }))}
          />
        </Plate>
        <Plate wide>
          <RhythmTap
            prompt="邊數拍子，邊在每個音符上隨便按一個鍵。"
            rhythms={[
              [q, q, q, q],
              [h, q, q],
              [q, q, h],
              [q, e, e, h],
              [hd, q],
              [q, qr, q, q],
            ]}
            onComplete={complete}
          />
        </Plate>
        <p>
          先有四下預備拍，之後節拍聲會在這一小節下面繼續打著。「樂曲」裡的節奏模式會用同樣的方法替真正樂曲裡的每個音計時，練習時也隨時可以打開「節拍器」。
        </p>
      </Section>
    </>
  );
}
