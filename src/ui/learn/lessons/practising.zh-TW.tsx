import { Link } from 'wouter';
import { ChoiceQuiz, type ChoiceQuestion } from '../exercises.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';
import { PracticePlan, TempoLadder, type PlanPart } from '../practiceFigures.tsx';

const PARTS: readonly PlanPart[] = [
  {
    id: 'warm-up',
    name: '暖身：',
    what: '一兩條音階，慢慢彈，彈均勻。',
    weight: 15,
  },
  {
    id: 'hard-spots',
    name: '難點：',
    what: '一次一兩個小節，慢速循環，再稍微加快一點。',
    weight: 40,
  },
  {
    id: 'new',
    name: '新內容：',
    what: '新曲子接下來的幾行，或者練一下識譜、練耳。',
    weight: 15,
  },
  {
    id: 'play-through',
    name: '完整彈一遍：',
    what: '一首曲子從頭彈到尾，中間不停，就當作有人在聽。',
    weight: 20,
  },
  {
    id: 'for-fun',
    name: '彈好玩的：',
    what: '彈一首你已經會、又喜歡彈的曲子。',
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
    question: '第 12 小節的同一個音你老是彈錯。怎麼做最有用？',
    figure: null,
    options: [
      '慢慢彈第 12 小節，直到連續幾遍都彈對',
      '整首曲子從頭再彈一遍',
      '把第 12 小節彈快一點，衝過去',
    ],
    answer: 0,
  },
  {
    id: 'tempo',
    question: '一段剛開始學的樂句，應該彈多快？',
    figure: null,
    options: ['慢到一個錯都不出', '照樂譜上標的速度', '能彈多快就彈多快'],
    answer: 0,
  },
  {
    id: 'daily',
    question: '哪一種對你的進步比較有幫助？',
    figure: null,
    options: ['每天專心練二十分鐘', '每星期一次練兩個小時'],
    answer: 0,
  },
  {
    id: 'start',
    question: '練一首曲子，通常從哪裡開始？',
    figure: null,
    options: ['從最難的那段開始，趁精神好', '永遠從第一小節開始', '從彈得最好的地方開始'],
    answer: 0,
  },
  {
    id: 'through',
    question: '什麼時候該把曲子從頭到尾不停地彈一遍？',
    figure: null,
    options: [
      '在一次練習快結束時，還有彈給別人聽之前',
      '從第一天起，每次練都這樣彈',
      '永遠不要：出錯就一定要停下來改',
    ],
    answer: 0,
  },
  {
    id: 'slip',
    question: '彈給家人聽的時候彈錯了一個音。怎麼辦？',
    figure: null,
    options: ['繼續彈，在下一拍重新跟上', '停下來，從頭再來', '停下來，把這一小節彈到對為止'],
    answer: 0,
  },
  {
    id: 'memory',
    question: '背下來的曲子，怎樣在緊張的時候也不會忘？',
    figure: null,
    options: [
      '用好幾種方式記住：它的聲音、和聲、形狀，還有左右手各自單獨會彈',
      '彈得夠多，讓手指自己記住',
      '在腦子裡想著那一頁樂譜',
    ],
    answer: 0,
  },
  {
    id: 'pain',
    question: '練著練著，手腕開始痛了。現在怎麼辦？',
    figure: null,
    options: [
      '停下來休息，之後彈得輕一些；如果還痛，去請教老師或醫師',
      '忍著彈下去，手腕會變強壯',
      '更用力地按鍵',
    ],
    answer: 0,
  },
  {
    id: 'app',
    question: '哪一樣是 App 聽不出來的？',
    figure: null,
    options: ['你的音色，還有你怎麼用手臂和手腕', '你彈了哪些鍵', '你什麼時候彈的'],
    answer: 0,
  },
]);

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        練琴不是把一首曲子彈了一遍又一遍。練琴是找出還彈不好的地方，一點一點把它彈好，讓下一次容易一些。有幾個好習慣，能讓同樣的時間練出好得多的成果。
      </p>

      <Section id="slowly" title="慢練">
        <p>
          手會記住它反覆做的事，錯誤也一樣。一段彈得太快、跌跌撞撞，你練到的就是跌跌撞撞。彈得夠慢，每個音、每個指法、每個節奏都彈對，手記住的就是對的。
        </p>
        <p>
          所以，從一個不會出錯的速度開始，慢到什麼程度都沒關係。連續彈對幾遍，再加快一小步。一旦亂了，就退回一步。感覺很慢，其實這是最快的路。
        </p>
        <Plate caption="通往目標速度的梯子：〈快樂頌〉的開頭，先用目標速度的 60%、70%、80%、90%，最後用目標速度本身。下面一級彈乾淨了，才上一級。">
          <TempoLadder
            labels={{
              target: '目標速度',
              rung: '{percent}%：♩ = {bpm}',
              readout: '連續三遍彈乾淨，再往上走一級。',
            }}
            staffLabel="高音譜表上〈快樂頌〉的前四小節"
          />
        </Plate>
        <p>
          <Link href="/metronome">「節拍器」</Link>
          可以替你爬這座梯子：它的「速度訓練」選「漸快」，就會每隔幾小節快幾拍，從起始速度一直到目標速度。「靜音小節」會不時停掉節拍聲，讓你自己把拍子穩住。在「樂曲」裡，速度可以設成樂譜標示的某個百分比；選「等待」模式時，樂譜會等你彈完每個音，多慢都可以。
        </p>
      </Section>

      <Section id="chunks" title="分段練">
        <p>
          一次只練一兩個小節，不要一下子練一整頁。彈完這一段，再帶上下一小節的第一個音，這樣接縫的地方也練到了。兩段都穩了，把它們連起來，再接上後面一段。
        </p>
        <p>
          在<Link href="/pieces">「樂曲」</Link>
          裡，「循環」可以把同樣幾個小節反覆彈：設好從哪一小節到哪一小節。彈過幾遍之後，「弱點小節」會標出你在哪裡變慢、彈錯，還能直接循環最弱的那幾個小節。
        </p>
      </Section>

      <Section id="hands" title="先分手，再合手">
        <p>
          每隻手單獨練到輕鬆為止，再把兩隻手合起來，慢慢地，一次幾個小節。合手本身就是一門功夫，所以要比單手更慢。哪隻手覺得難，就多給它一些時間；對大多數人來說，是左手。在「樂曲」裡可以只練右手、只練左手，或者雙手一起。
        </p>
      </Section>

      <Section id="stop-or-go" title="停下來改，還是彈下去">
        <p>練一首曲子有兩種方法，兩種都要用。</p>
        <ul>
          <li>
            <strong>停下來改。</strong>
            出了錯就停。弄清楚是哪裡錯了（一個音、一個指法，還是節奏），把那個地方慢慢地、正確地彈幾遍，再連同前後各一小節彈一遍。曲子就是這樣學會的，大部分時間都該花在這裡。
          </li>
          <li>
            <strong>彈下去。</strong>
            從頭彈到尾，不管發生什麼都不停，就像有人在聽。這樣才知道哪些地方真的穩了，練的也是出錯後繼續彈的本事。
          </li>
        </ul>
        <p>
          學一首曲子時主要用第一種；每次練習快結束時用第二種彈一遍，離演出越近，就彈得越多。在「樂曲」裡，「等待」模式適合停下來改：它等你彈對了才往下走。「節奏」模式適合彈下去：樂譜準時往前走，每個音都會計時。
        </p>
      </Section>

      <Section id="hard-first" title="先練最難的那一小節">
        <p>
          如果每次都從頭開始，第一頁會被彈上一百遍，最後一頁卻幾乎沒練過。趁精神好，先練最難的那一段。也可以從不同的地方開始：從中間，從最後一行，從每一段的開頭。一首曲子的結尾，應該是你最熟的地方。
        </p>
      </Section>

      <Section id="daily" title="時間短，分開練，天天練">
        <p>
          每天練一點，勝過偶爾練很多。兩次練習之間，手和大腦還在繼續學，睡覺的時候更是如此。所以每天專心練二十分鐘，比星期天一口氣練兩個小時更有用。關鍵是「專心」：在一個難點上練二十分鐘，勝過把已經會的東西從頭彈一個小時。
        </p>
        <p>
          坐下之前先想好這次練什麼，把最難的放在前面。練得久，中間就休息幾次。
          <Link href="/progress">「進度」</Link>
          頁會記下你連續練了幾天，還有距離今日目標還差幾分鐘。
        </p>
        <Plate caption="把一次練習分成幾個部分。選一選你有多少時間；難點分到的時間最多。">
          <PracticePlan
            parts={PARTS}
            labels={{
              length: '這次練習',
              minutes: '{n} 分鐘',
              total: '一次 {n} 分鐘的練習',
            }}
          />
        </Plate>
        <Aside title="在彈得順的時候收工">
          <p>用一段彈得好的東西結束。隔天你會更願意坐回琴前，最後彈的東西也記得最牢。</p>
        </Aside>
      </Section>

      <Section id="by-heart" title="背譜">
        <p>
          一首曲子彈得多了，手指自己就會記住。可是一緊張，最先靠不住的就是手指的記憶，那時就沒有別的可以依靠了。背得牢的曲子，是同時用好幾種方式記住的：
        </p>
        <ul>
          <li>
            <strong>用耳朵記</strong>：能把旋律唱出來，知道下面是什麼聲音。
          </li>
          <li>
            <strong>用和聲和曲式記</strong>：知道每一小節是什麼和弦，哪些樂句會再出現。
          </li>
          <li>
            <strong>用形狀記</strong>：兩隻手在鍵盤上的位置，手指下面的音型。
          </li>
          <li>
            <strong>左右手各自記</strong>：不靠另一隻手，也能單獨彈出任何一隻手。
          </li>
        </ul>
        <p>背一首曲子的計畫，每天背幾個小節：</p>
        <ol>
          <li>先聽，把旋律唱出來。</li>
          <li>說出每小節的和弦，標出每一段：每個樂句從哪裡開始，哪些地方是重複的。</li>
          <li>看著譜學一個樂句，先分手，再合手。</li>
          <li>不看譜彈，先單手，再合手。實在想不起來才看。</li>
          <li>
            選好<strong>地標</strong>：每個樂句、每一段的開頭。練習從每一個地標開始彈，順序隨意。
          </li>
          <li>離開琴，在腦子裡把它彈一遍，想像手怎麼動。</li>
          <li>隔天，先憑記憶彈一遍，再去看譜。</li>
        </ol>
      </Section>

      <Section id="performing" title="彈給別人聽">
        <p>
          彈給別人聽，誰都會緊張；心跳加快、手發冷，都很正常。多練幾次就會好很多，所以這也要練。
        </p>
        <ul>
          <li>
            <strong>找個人聽你彈</strong>
            ：朋友、家人，或者打一通視訊電話。告訴他們你在練習演出，然後從頭彈到尾。
          </li>
          <li>
            <strong>替自己錄音</strong>
            ，用手機就可以，過一陣子再聽。你會聽到彈的時候聽不到的東西：哪一小節趕了，旋律被和弦蓋住了。
          </li>
          <li>
            <strong>開始前有一套固定的準備</strong>
            ：調好琴椅，手放在膝蓋上，慢慢吐一口氣，在腦子裡照速度把第一小節過一遍，然後開始。
          </li>
          <li>
            <strong>彈錯了，繼續彈。</strong>
            聽的人很少注意到一個錯音，可是停下來誰都聽得出來。在下一拍，或者下一個地標，重新跟上。
          </li>
        </ul>
      </Section>

      <Section id="healthy" title="彈琴不要勉強">
        <Picture
          src="learn/posture-from-the-side.webp"
          alt="從側面看坐在琴椅上的鋼琴演奏者：前臂與琴鍵齊平，背挺直，雙腳平放在地上。"
          caption="照「坐姿、手型與指法」一課那樣坐：前臂與琴鍵齊平，背挺直，雙腳放平。"
        />
        <p>
          彈琴不應該痛。肩膀放低、放鬆，手腕靈活，讓手臂的重量去彈鍵，而不是用力捏。音響起來以後就別再往下壓了：鍵只需要按住，不需要用力壓。
        </p>
        <ul>
          <li>每二三十分鐘休息一下：站起來，甩甩手。</li>
          <li>痛是叫你停下來的訊號，不要硬撐。休息，彈得輕一些；如果還痛，去請教老師或醫師。</li>
          <li>
            手有大有小。不要硬撐著去彈太寬的音程：太寬的和弦可以分開彈，不是旋律也不是低音的音可以省掉，或者交給另一隻手。
          </li>
        </ul>
      </Section>

      <Section id="teacher" title="App 聽不出來的東西">
        <p>
          dacapo 聽得出你彈了哪些鍵、什麼時候彈的，用 MIDI
          鍵盤時還聽得出彈得多重。這已經很多了，但不是全部。它聽不出你的音色，聽不到房間裡的聲音，也聽不出一個樂句有沒有歌唱性。它看不到你的手臂、手腕和肩膀，而緊繃的習慣，預防比改正容易得多。
        </p>
        <p>
          老師聽得到、看得到這一切。就算只是偶爾上幾堂課，讓老師看看你怎麼坐、怎麼動、彈出來是什麼聲音，也很值得；兩堂課之間，再用
          App 來練。
        </p>
      </Section>

      <Section id="try-it" title="試一試">
        <p>回答幾個關於這一課的問題。</p>
        <Plate>
          <ChoiceQuiz prompt="怎麼練琴。" questions={QUESTIONS} onComplete={complete} />
        </Plate>
        <p>然後在「樂曲」裡選一首曲子，找出最難的幾個小節，慢速循環，一級一級往上走。</p>
      </Section>
    </>
  );
}
