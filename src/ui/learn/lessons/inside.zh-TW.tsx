import { ChoiceQuiz } from '../exercises.tsx';
import { InsideAction, type InsideCopy } from '../InsideAction.tsx';
import { Aside, Picture, Plate, Section } from '../kit.tsx';
import { useCompleteLesson } from '../lesson.ts';

const COPY: InsideCopy = {
  label: '平台鋼琴一個鍵的擊弦機剖面圖，隨著彈奏而運動',
  speeds: { real: '實際速度', slow4: '慢 4 倍', slow10: '慢 10 倍' },
  touch: { key: '照你的力度', soft: '輕', loud: '重' },
  names: '名稱',
  sustain: '延音踏板',
  play: '彈一個音',
  pressed: '琴鍵',
  loudness: '音量',
  pointAt: '把滑鼠移到任何一個零件上，看看它是做什麼的。',
  parts: {
    key: {
      name: '琴鍵',
      text: '（英文 key）架在平衡軌上的一根槓桿：前端按下去，後端就抬起來。',
    },
    capstan: {
      name: '頂柱',
      text: '（英文 capstan）琴鍵上的一顆小螺絲，負責頂起聯動器。轉動它可以調整擊弦機多早開始反應。',
    },
    wippen: {
      name: '聯動器',
      text: '（英文 wippen）一根槓桿，把琴鍵的動作傳給頂桿和複奏槓桿。',
    },
    jack: {
      name: '頂桿',
      text: '（英文 jack）從槌柄下的滾軸把琴槌推上去，在琴槌碰到琴弦之前從它下面脫開。',
    },
    letoff: {
      name: '脫擊鈕',
      text: '（英文 let-off button）頂桿的腳碰到它，頂桿就倒向一邊：琴槌在離琴弦兩三公釐的地方被放開。',
    },
    repetition: {
      name: '複奏槓桿',
      text: '（英文 repetition lever）一根帶彈簧的槓桿。琴鍵稍微抬起時，它把琴槌托住，讓頂桿能回到琴槌下面，這個音就能馬上再彈一次。',
    },
    hammer: {
      name: '琴槌',
      text: '（英文 hammer）裝在木柄上的硬毛氈。它獨自飛向琴弦，擊中後立刻彈開，琴弦才能繼續振動。',
    },
    backcheck: {
      name: '托槌器',
      text: '（英文 backcheck）按住琴鍵時，它接住落下的琴槌尾端，不讓琴槌再彈回去碰到琴弦。',
    },
    damper: {
      name: '制音器',
      text: '（英文 damper）壓在琴弦上的一塊毛氈。彈奏時琴鍵把它抬起；放開琴鍵，它落回弦上，聲音就停了。',
    },
    string: {
      name: '琴弦',
      text: '（英文 string）繃得非常緊的鋼絲。一台平台鋼琴所有琴弦的張力加起來，大約有二十公噸。',
    },
    soundboard: {
      name: '響板',
      text: '（英文 soundboard）琴弦的振動經過琴橋傳到一大片薄薄的木製響板上，聲音才大到能充滿整個房間。',
    },
  },
  steps: [
    { phase: 'down', text: '琴鍵按下。頂柱頂起聯動器，頂桿把琴槌往上推。' },
    { phase: 'free', text: '脫擊：頂桿的腳碰到脫擊鈕，頂桿倒開。琴槌獨自繼續飛。' },
    { phase: 'strike', text: '琴槌擊中琴弦，並立刻彈回。' },
    { phase: 'checked', text: '托槌器接住琴槌。制音器是抬起來的：只要按著琴鍵，琴弦就一直在響。' },
    {
      phase: 'repeat',
      text: '把琴鍵稍微抬起：複奏槓桿托起琴槌，頂桿回到它下面，這個音就能再彈一次。',
    },
    { phase: 'release', text: '放開：琴槌回到原位，制音器落回琴弦，聲音停止。' },
  ],
};

export default function Lesson() {
  const complete = useCompleteLesson();
  return (
    <>
      <p>
        鋼琴是一台把小小的毛氈琴槌拋向琴弦、再把它接住的機器。從你的手指到琴弦之間，每個鍵都有一套自己的小機械，叫作
        <strong>擊弦機</strong>
        ：木頭槓桿、毛氈、呢絨和彈簧，調校的精密度以零點幾公釐計。在這裡或者在你自己的鍵盤上彈一個鍵，看看它是怎麼運作的。
      </p>
      <Picture
        src="learn/inside-a-grand.webp"
        alt="打開琴蓋的平台鋼琴內部：鐵骨、鋪展在響板上方的琴弦，以及調音釘。"
        caption="平台鋼琴的琴蓋下面：鐵骨、響板上方的琴弦、調音釘。擊弦機就在琴弦下面、靠鍵盤的那一端。"
      />

      <Section id="action" title="一個鍵，慢動作">
        <p>
          這是平台鋼琴的一個鍵，從中間剖開、從側面看，你坐在左邊。按任何一個鍵，圖裡就照你按下的速度把它彈出來。實際速度太快、看不清楚，所以預設放慢四倍。放慢的只是圖：聲音會立刻響起，比圖裡的琴槌先到。
        </p>
        <Plate
          wide
          caption="在你的鍵盤上或下面的鍵盤上按一個鍵，或者點「彈一個音」。放慢速度可以看清楚每一步，下面的步驟會跟著亮起。"
        >
          <InsideAction copy={COPY} />
        </Plate>
      </Section>

      <Section id="flying-free" title="琴槌是飛出去的">
        <p>
          鋼琴最讓人意外的一點是：你從來沒有把琴槌按到琴弦上。就在它快要碰到琴弦的時候，頂桿從它下面倒開（這叫
          <strong>脫擊</strong>），琴槌自己飛完最後幾公釐，擊中琴弦後立刻彈開，琴弦才能繼續響。
        </p>
        <p>
          所以琴槌一旦飛出去，你再做什麼都改變不了這個音。琴鍵按到底以後再用力，一點用也沒有。讓聲音變大的只有一件事：琴槌被拋出去的速度，也就是你按鍵有多快。在上面試試看：用
          MIDI
          鍵盤先慢慢按，再快快按，看看音量。電腦鍵盤和滑鼠點按的速度永遠一樣，可以改選「輕」或「重」來比較。
        </p>
        <Aside title="為什麼一定要放開">
          <p>
            如果琴槌一直壓在琴弦上，就會像手指按在吉他弦上一樣，立刻讓它停下來：你聽到的只會是「咚」的一聲，而不是一個音。
          </p>
        </Aside>
      </Section>

      <Section id="pedals" title="制音器與踏板">
        <p>
          除了最高音域的幾個鍵，每個鍵都有一個<strong>制音器</strong>
          。彈奏時琴鍵把它抬起，放開時它落下，所以一個音正好響到你放手為止。
        </p>
        <ul>
          <li>
            右踏板是<strong>延音踏板</strong>
            ，一次把所有制音器都抬起來：放開琴鍵後音還在響，其他琴弦也會跟著共鳴。在上面打開它，再放開一個鍵試試看。
          </li>
          <li>
            左踏板是<strong>弱音踏板</strong>
            ：在平台鋼琴上，它把整套擊弦機稍微往旁邊推，讓每個琴槌少打一兩根弦（大部分的音有三根弦），聲音更輕、更柔。
          </li>
          <li>
            中踏板在多數平台鋼琴上只維持已經抬起的那些制音器，這樣一個和弦可以持續，後面的音仍然短促。
          </li>
        </ul>
      </Section>

      <Section id="upright" title="平台鋼琴與直立式鋼琴">
        <p>
          直立式鋼琴的琴弦是直立的，所以琴槌向前打而不是向上打，靠彈簧而不是本身的重量回位。它的擊弦機沒有這樣的複奏槓桿：琴鍵要抬起大半才能再彈一次。平台鋼琴的雙重擒縱機構由艾拉爾（Sébastien
          Érard）在 1821
          年取得專利，讓演奏者在琴鍵只抬起一部分時就能再彈同一個音，所以快速的同音反覆在平台鋼琴上比較容易。
        </p>
      </Section>

      <Section id="try-it" title="考考你">
        <Plate>
          <ChoiceQuiz
            prompt="關於剛才看到的，四個問題。"
            questions={[
              {
                id: 'loud',
                question: '怎樣讓一個音更大聲？',
                figure: null,
                options: ['按鍵按得更快', '按到底以後再用力', '按住琴鍵更久'],
                answer: 0,
              },
              {
                id: 'stop',
                question: '放開琴鍵時，是什麼讓聲音停下來的？',
                figure: null,
                options: ['琴槌', '制音器', '托槌器'],
                answer: 1,
              },
              {
                id: 'free',
                question: '為什麼琴槌不會一直壓在琴弦上？',
                figure: null,
                options: ['頂桿在它擊弦之前就放開了它', '制音器把它推開了', '琴弦太緊了'],
                answer: 0,
              },
              {
                id: 'pedal',
                question: '延音踏板的作用是什麼？',
                figure: null,
                options: ['把所有制音器從琴弦上抬起', '讓琴槌離琴弦更近', '讓琴弦繃得更緊'],
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
