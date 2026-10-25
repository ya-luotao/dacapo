import { TEMPO_NAMES, tempoRange, tempoWord, type TempoName } from '../core/tempoNames.ts';
import type { LessonLanguage } from './lessons.ts';

// The glossary (docs/GLOSSARY.md): a short entry for each word of music theory a beginner meets in
// a score or a lesson, in the lessons' languages. Here is what the list, the site and llms.txt
// need without loading an entry: its group, its name and other names, its one-line definition,
// and where it leads. Each entry's text is in ui/learn/terms/<group>.<language>.tsx.

export type TermGroup = 'intervals' | 'keys' | 'roadmap' | 'tempo';

type Words = Readonly<Record<LessonLanguage, string>>;

export const TERM_GROUPS: readonly { id: TermGroup; title: Words }[] = [
  { id: 'intervals', title: { en: 'Intervals', 'zh-CN': '音程', 'zh-TW': '音程' } },
  {
    id: 'keys',
    title: { en: 'Keys and key signatures', 'zh-CN': '调与调号', 'zh-TW': '調與調號' },
  },
  {
    id: 'roadmap',
    title: { en: 'Finding your way in a score', 'zh-CN': '乐谱上的路标', 'zh-TW': '樂譜上的路標' },
  },
  {
    id: 'tempo',
    title: { en: 'Tempo and expression', 'zh-CN': '速度与表情', 'zh-TW': '速度與表情' },
  },
];

export interface TermInfo {
  slug: string;
  group: TermGroup;
  title: Words;
  /** Other names and signs it goes by, which a reader may search for. */
  also?: Readonly<Record<LessonLanguage, readonly string[]>>;
  /** What it is, in one sentence: the entry's first line and its page's description. */
  summary: Words;
  /** The lessons that teach it, by slug. */
  lessons: readonly string[];
  /** The entries beside it, by slug. */
  see: readonly string[];
}

const same = (...names: string[]) => ({ en: names, 'zh-CN': names, 'zh-TW': names });

// --- Intervals --------------------------------------------------------------------------------

const INTERVALS: readonly TermInfo[] = [
  {
    slug: 'interval',
    group: 'intervals',
    title: { en: 'Interval', 'zh-CN': '音程', 'zh-TW': '音程' },
    summary: {
      en: 'The distance between two notes, counted in letters with both ends included: C up to E is a third.',
      'zh-CN': '两个音之间的距离，按字母数，两头都算：从 C 数到 E 是三度。',
      'zh-TW': '兩個音之間的距離，按字母數，兩頭都算：從 C 數到 E 是三度。',
    },
    lessons: ['landmarks', 'chords'],
    see: ['interval-quality', 'half-step', 'interval-inversion'],
  },
  {
    slug: 'half-step',
    group: 'intervals',
    title: { en: 'Half step', 'zh-CN': '半音', 'zh-TW': '半音' },
    also: { en: ['semitone'], 'zh-CN': ['小二度'], 'zh-TW': ['小二度'] },
    summary: {
      en: 'The smallest step on the keyboard: from one key to the very next, black or white, as E to F or C to C♯.',
      'zh-CN': '键盘上最小的一步：从一个键到紧挨着的下一个键，不分黑白，比如 E 到 F、C 到 C♯。',
      'zh-TW': '鍵盤上最小的一步：從一個鍵到緊挨著的下一個鍵，不分黑白，比如 E 到 F、C 到 C♯。',
    },
    lessons: ['sharps-and-flats'],
    see: ['whole-step', 'minor-second', 'enharmonic'],
  },
  {
    slug: 'whole-step',
    group: 'intervals',
    title: { en: 'Whole step', 'zh-CN': '全音', 'zh-TW': '全音' },
    also: { en: ['whole tone', 'tone'], 'zh-CN': ['大二度'], 'zh-TW': ['大二度'] },
    summary: {
      en: 'Two half steps, with one key skipped between: C to D, or E to F♯.',
      'zh-CN': '两个半音，中间隔一个键：C 到 D，或 E 到 F♯。',
      'zh-TW': '兩個半音，中間隔一個鍵：C 到 D，或 E 到 F♯。',
    },
    lessons: ['sharps-and-flats', 'major-scale'],
    see: ['half-step', 'major-second'],
  },
  {
    slug: 'enharmonic',
    group: 'intervals',
    title: { en: 'Enharmonic notes', 'zh-CN': '等音', 'zh-TW': '同音異名' },
    also: { en: ['enharmonic equivalents'], 'zh-CN': ['同音异名'], 'zh-TW': ['等音'] },
    summary: {
      en: 'Two names for one key, such as F♯ and G♭, or E and F♭.',
      'zh-CN': '同一个键的两个名字，比如 F♯ 和 G♭，或者 E 和 F♭。',
      'zh-TW': '同一個鍵的兩個名字，比如 F♯ 和 G♭，或者 E 和 F♭。',
    },
    lessons: ['sharps-and-flats'],
    see: ['half-step', 'tritone'],
  },
  {
    slug: 'interval-quality',
    group: 'intervals',
    title: { en: 'Interval quality', 'zh-CN': '音程的性质', 'zh-TW': '音程的性質' },
    also: {
      en: ['perfect', 'major', 'minor', 'augmented', 'diminished'],
      'zh-CN': ['纯', '大', '小', '增', '减'],
      'zh-TW': ['純', '大', '小', '增', '減'],
    },
    summary: {
      en: 'The word before an interval’s number (perfect, major, minor, augmented or diminished), set by how many half steps it spans.',
      'zh-CN': '音程度数前面的那个字：纯、大、小、增、减，由它跨过几个半音决定。',
      'zh-TW': '音程度數前面的那個字：純、大、小、增、減，由它跨過幾個半音決定。',
    },
    lessons: ['chords', 'minor-keys'],
    see: ['interval', 'perfect-fifth', 'major-third', 'tritone'],
  },
  {
    slug: 'minor-second',
    group: 'intervals',
    title: { en: 'Minor second', 'zh-CN': '小二度', 'zh-TW': '小二度' },
    also: same('m2'),
    summary: {
      en: 'An interval of one half step, as from E up to F or B up to C.',
      'zh-CN': '相距一个半音的音程，比如 E 到 F、B 到 C。',
      'zh-TW': '相距一個半音的音程，比如 E 到 F、B 到 C。',
    },
    lessons: ['sharps-and-flats'],
    see: ['half-step', 'major-second', 'major-seventh'],
  },
  {
    slug: 'major-second',
    group: 'intervals',
    title: { en: 'Major second', 'zh-CN': '大二度', 'zh-TW': '大二度' },
    also: same('M2'),
    summary: {
      en: 'An interval of two half steps, as from C up to D: a whole step.',
      'zh-CN': '相距两个半音的音程，比如 C 到 D，也就是一个全音。',
      'zh-TW': '相距兩個半音的音程，比如 C 到 D，也就是一個全音。',
    },
    lessons: ['sharps-and-flats', 'major-scale'],
    see: ['whole-step', 'minor-second', 'minor-seventh'],
  },
  {
    slug: 'minor-third',
    group: 'intervals',
    title: { en: 'Minor third', 'zh-CN': '小三度', 'zh-TW': '小三度' },
    also: same('m3'),
    summary: {
      en: 'An interval of three half steps, as from A up to C: the third of a minor chord.',
      'zh-CN': '相距三个半音的音程，比如 A 到 C，小三和弦里的那个三度。',
      'zh-TW': '相距三個半音的音程，比如 A 到 C，小三和弦裡的那個三度。',
    },
    lessons: ['minor-keys', 'chords'],
    see: ['major-third', 'major-sixth', 'parallel-keys'],
  },
  {
    slug: 'major-third',
    group: 'intervals',
    title: { en: 'Major third', 'zh-CN': '大三度', 'zh-TW': '大三度' },
    also: same('M3'),
    summary: {
      en: 'An interval of four half steps, as from C up to E: the third of a major chord.',
      'zh-CN': '相距四个半音的音程，比如 C 到 E，大三和弦里的那个三度。',
      'zh-TW': '相距四個半音的音程，比如 C 到 E，大三和弦裡的那個三度。',
    },
    lessons: ['chords', 'minor-keys'],
    see: ['minor-third', 'minor-sixth', 'interval-quality'],
  },
  {
    slug: 'perfect-fourth',
    group: 'intervals',
    title: { en: 'Perfect fourth', 'zh-CN': '纯四度', 'zh-TW': '純四度' },
    also: same('P4'),
    summary: {
      en: 'An interval of five half steps, as from C up to F: the first leap of Amazing Grace.',
      'zh-CN': '相距五个半音的音程，比如 C 到 F。《奇异恩典》第一个跳进就是它。',
      'zh-TW': '相距五個半音的音程，比如 C 到 F。〈奇異恩典〉第一個跳進就是它。',
    },
    lessons: ['landmarks'],
    see: ['perfect-fifth', 'tritone', 'interval-inversion'],
  },
  {
    slug: 'tritone',
    group: 'intervals',
    title: { en: 'Tritone', 'zh-CN': '三全音', 'zh-TW': '三全音' },
    also: {
      en: ['augmented fourth', 'diminished fifth', 'TT'],
      'zh-CN': ['增四度', '减五度'],
      'zh-TW': ['增四度', '減五度'],
    },
    summary: {
      en: 'An interval of six half steps, as from F up to B: half an octave, written as an augmented fourth or a diminished fifth.',
      'zh-CN': '相距六个半音的音程，比如 F 到 B。正好半个八度，写作增四度或减五度。',
      'zh-TW': '相距六個半音的音程，比如 F 到 B。正好半個八度，寫作增四度或減五度。',
    },
    lessons: ['chords'],
    see: ['perfect-fourth', 'perfect-fifth', 'consonance-and-dissonance'],
  },
  {
    slug: 'perfect-fifth',
    group: 'intervals',
    title: { en: 'Perfect fifth', 'zh-CN': '纯五度', 'zh-TW': '純五度' },
    also: same('P5'),
    summary: {
      en: 'An interval of seven half steps, as from C up to G: the leap at the start of Twinkle, Twinkle.',
      'zh-CN': '相距七个半音的音程，比如 C 到 G。《小星星》开头那一跳就是它。',
      'zh-TW': '相距七個半音的音程，比如 C 到 G。〈小星星〉開頭那一跳就是它。',
    },
    lessons: ['landmarks', 'chords'],
    see: ['perfect-fourth', 'circle-of-fifths', 'tritone'],
  },
  {
    slug: 'minor-sixth',
    group: 'intervals',
    title: { en: 'Minor sixth', 'zh-CN': '小六度', 'zh-TW': '小六度' },
    also: same('m6'),
    summary: {
      en: 'An interval of eight half steps, as from E up to C: a major third turned upside down.',
      'zh-CN': '相距八个半音的音程，比如 E 到 C，也就是大三度倒过来。',
      'zh-TW': '相距八個半音的音程，比如 E 到 C，也就是大三度倒過來。',
    },
    lessons: ['chords'],
    see: ['major-sixth', 'major-third', 'interval-inversion'],
  },
  {
    slug: 'major-sixth',
    group: 'intervals',
    title: { en: 'Major sixth', 'zh-CN': '大六度', 'zh-TW': '大六度' },
    also: same('M6'),
    summary: {
      en: 'An interval of nine half steps, as from C up to A: a minor third turned upside down.',
      'zh-CN': '相距九个半音的音程，比如 C 到 A，也就是小三度倒过来。',
      'zh-TW': '相距九個半音的音程，比如 C 到 A，也就是小三度倒過來。',
    },
    lessons: ['chords'],
    see: ['minor-sixth', 'minor-third', 'interval-inversion'],
  },
  {
    slug: 'minor-seventh',
    group: 'intervals',
    title: { en: 'Minor seventh', 'zh-CN': '小七度', 'zh-TW': '小七度' },
    also: same('m7'),
    summary: {
      en: 'An interval of ten half steps, as from G up to F: the seventh of a dominant seventh chord.',
      'zh-CN': '相距十个半音的音程，比如 G 到 F，属七和弦里的那个七度。',
      'zh-TW': '相距十個半音的音程，比如 G 到 F，屬七和弦裡的那個七度。',
    },
    lessons: ['chords'],
    see: ['major-seventh', 'major-second', 'scale-degrees'],
  },
  {
    slug: 'major-seventh',
    group: 'intervals',
    title: { en: 'Major seventh', 'zh-CN': '大七度', 'zh-TW': '大七度' },
    also: same('M7'),
    summary: {
      en: 'An interval of eleven half steps, as from C up to B: a half step short of the octave.',
      'zh-CN': '相距十一个半音的音程，比如 C 到 B，比八度少一个半音。',
      'zh-TW': '相距十一個半音的音程，比如 C 到 B，比八度少一個半音。',
    },
    lessons: ['chords'],
    see: ['minor-seventh', 'octave', 'minor-second'],
  },
  {
    slug: 'octave',
    group: 'intervals',
    title: { en: 'Octave', 'zh-CN': '八度', 'zh-TW': '八度' },
    also: { en: ['P8', 'perfect octave'], 'zh-CN': ['纯八度', 'P8'], 'zh-TW': ['純八度', 'P8'] },
    summary: {
      en: 'An interval of twelve half steps, from a note to the next one of the same letter, as C4 to C5.',
      'zh-CN': '相距十二个半音的音程，从一个音到下一个同名的音，比如 C4 到 C5。',
      'zh-TW': '相距十二個半音的音程，從一個音到下一個同名的音，比如 C4 到 C5。',
    },
    lessons: ['keyboard', 'landmarks'],
    see: ['compound-interval', 'ottava', 'perfect-fifth'],
  },
  {
    slug: 'interval-inversion',
    group: 'intervals',
    title: { en: 'Inverting an interval', 'zh-CN': '音程转位', 'zh-TW': '音程轉位' },
    also: { en: ['inversion'], 'zh-CN': ['转位'], 'zh-TW': ['轉位'] },
    summary: {
      en: 'Turning an interval upside down by moving its lower note up an octave: a third becomes a sixth, and major becomes minor.',
      'zh-CN': '把下面的音移高一个八度，音程就倒了过来：三度变成六度，大变成小。',
      'zh-TW': '把下面的音移高一個八度，音程就倒了過來：三度變成六度，大變成小。',
    },
    lessons: ['chords'],
    see: ['interval-quality', 'major-third', 'minor-sixth'],
  },
  {
    slug: 'compound-interval',
    group: 'intervals',
    title: { en: 'Compound interval', 'zh-CN': '复音程', 'zh-TW': '複音程' },
    also: { en: ['ninth', 'tenth'], 'zh-CN': ['九度', '十度'], 'zh-TW': ['九度', '十度'] },
    summary: {
      en: 'An interval wider than an octave, such as a ninth: an octave and a second.',
      'zh-CN': '超过八度的音程，比如九度，就是一个八度加一个二度。',
      'zh-TW': '超過八度的音程，比如九度，就是一個八度加一個二度。',
    },
    lessons: ['chords'],
    see: ['octave', 'interval'],
  },
  {
    slug: 'consonance-and-dissonance',
    group: 'intervals',
    title: {
      en: 'Consonance and dissonance',
      'zh-CN': '协和与不协和音程',
      'zh-TW': '協和與不協和音程',
    },
    also: {
      en: ['consonant', 'dissonant'],
      'zh-CN': ['协和音程', '不协和音程'],
      'zh-TW': ['協和音程', '不協和音程'],
    },
    summary: {
      en: 'How settled two notes sound together: thirds, sixths and perfect intervals rest; seconds, sevenths and the tritone pull towards a resolution.',
      'zh-CN':
        '两个音一起响时听起来稳不稳：三度、六度和纯音程是稳的；二度、七度和三全音有张力，想往下一个和弦走。',
      'zh-TW':
        '兩個音一起響時聽起來穩不穩：三度、六度和純音程是穩的；二度、七度和三全音有張力，想往下一個和弦走。',
    },
    lessons: ['chords'],
    see: ['tritone', 'interval-quality'],
  },
];

// --- Keys -------------------------------------------------------------------------------------

const KEYS: readonly TermInfo[] = [
  {
    slug: 'key',
    group: 'keys',
    title: { en: 'Key', 'zh-CN': '调', 'zh-TW': '調' },
    also: { en: ['tonality'], 'zh-CN': ['调性'], 'zh-TW': ['調性'] },
    summary: {
      en: 'The scale a piece is built on, named by its home note and whether it is major or minor: G major, D minor.',
      'zh-CN': '一首曲子所用的音阶，用它的主音和大小来称呼：G 大调、D 小调。',
      'zh-TW': '一首曲子所用的音階，用它的主音和大小來稱呼：G 大調、D 小調。',
    },
    lessons: ['major-scale', 'minor-keys'],
    see: ['key-signature', 'scale-degrees', 'modulation'],
  },
  {
    slug: 'key-signature',
    group: 'keys',
    title: { en: 'Key signature', 'zh-CN': '调号', 'zh-TW': '調號' },
    summary: {
      en: 'The sharps or flats written at the start of every line, which apply to every note of those letters in every octave.',
      'zh-CN': '每行谱开头写的升号或降号，对所有八度里同名的音都有效。',
      'zh-TW': '每行譜開頭寫的升記號或降記號，對所有八度裡同名的音都有效。',
    },
    lessons: ['major-scale', 'minor-keys'],
    see: ['order-of-sharps-and-flats', 'circle-of-fifths', 'relative-keys'],
  },
  {
    slug: 'order-of-sharps-and-flats',
    group: 'keys',
    title: {
      en: 'Order of sharps and flats',
      'zh-CN': '升降号的顺序',
      'zh-TW': '升降記號的順序',
    },
    also: same('FCGDAEB', 'BEADGCF'),
    summary: {
      en: 'Sharps are always added in the order F C G D A E B, and flats in the reverse order, B E A D G C F.',
      'zh-CN': '升号总是按 F C G D A E B 的顺序加上去，降号顺序正好相反：B E A D G C F。',
      'zh-TW': '升記號總是按 F C G D A E B 的順序加上去，降記號順序正好相反：B E A D G C F。',
    },
    lessons: ['major-scale'],
    see: ['key-signature', 'circle-of-fifths'],
  },
  {
    slug: 'circle-of-fifths',
    group: 'keys',
    title: { en: 'Circle of fifths', 'zh-CN': '五度圈', 'zh-TW': '五度圈' },
    summary: {
      en: 'The twelve major keys in a ring, each a fifth above the one before: every step clockwise adds a sharp or takes away a flat.',
      'zh-CN': '十二个大调排成一圈，每个比前一个高五度：顺时针每走一步，多一个升号或少一个降号。',
      'zh-TW':
        '十二個大調排成一圈，每個比前一個高五度：順時針每走一步，多一個升記號或少一個降記號。',
    },
    lessons: ['major-scale', 'minor-keys', 'chords'],
    see: ['key-signature', 'relative-keys', 'closely-related-keys', 'perfect-fifth'],
  },
  {
    slug: 'relative-keys',
    group: 'keys',
    title: { en: 'Relative keys', 'zh-CN': '关系大小调', 'zh-TW': '關係大小調' },
    also: {
      en: ['relative minor', 'relative major'],
      'zh-CN': ['关系小调', '关系大调'],
      'zh-TW': ['關係小調', '關係大調'],
    },
    summary: {
      en: 'A major and a minor key with the same key signature: C major and A minor, G major and E minor.',
      'zh-CN': '调号相同的一对大调和小调：C 大调和 A 小调，G 大调和 E 小调。',
      'zh-TW': '調號相同的一對大調和小調：C 大調和 A 小調，G 大調和 E 小調。',
    },
    lessons: ['minor-keys'],
    see: ['parallel-keys', 'circle-of-fifths', 'key-signature'],
  },
  {
    slug: 'parallel-keys',
    group: 'keys',
    title: { en: 'Parallel keys', 'zh-CN': '同主音大小调', 'zh-TW': '同主音大小調' },
    also: {
      en: ['parallel minor', 'tonic minor'],
      'zh-CN': ['同主音小调'],
      'zh-TW': ['平行小調', '同主音小調'],
    },
    summary: {
      en: 'A major and a minor key on the same home note, such as C major and C minor, three flats apart in their signatures.',
      'zh-CN': '主音相同的一对大调和小调，比如 C 大调和 C 小调，调号相差三个降号。',
      'zh-TW': '主音相同的一對大調和小調，比如 C 大調和 C 小調，調號相差三個降記號。',
    },
    lessons: ['minor-keys'],
    see: ['relative-keys', 'minor-third', 'key'],
  },
  {
    slug: 'scale-degrees',
    group: 'keys',
    title: { en: 'Scale degrees', 'zh-CN': '音级', 'zh-TW': '音級' },
    also: {
      en: ['tonic', 'dominant', 'subdominant', 'leading note'],
      'zh-CN': ['主音', '属音', '下属音', '导音'],
      'zh-TW': ['主音', '屬音', '下屬音', '導音'],
    },
    summary: {
      en: 'The notes of a scale by their place in it: the tonic first, then the supertonic, mediant, subdominant, dominant, submediant and leading note.',
      'zh-CN':
        '按在音阶里的位置给每个音起的名字：第一个是主音，然后是上主音、中音、下属音、属音、下中音和导音。',
      'zh-TW':
        '按在音階裡的位置給每個音起的名字：第一個是主音，然後是上主音、中音、下屬音、屬音、下中音和導音。',
    },
    lessons: ['major-scale', 'chords'],
    see: ['key', 'interval'],
  },
  {
    slug: 'transposition',
    group: 'keys',
    title: { en: 'Transposition', 'zh-CN': '移调', 'zh-TW': '移調' },
    also: { en: ['transpose'], 'zh-CN': ['转调演奏'], 'zh-TW': ['移調演奏'] },
    summary: {
      en: 'Moving a whole piece up or down by one interval, so that it sounds the same in another key.',
      'zh-CN': '把整首曲子按同一个音程整体移高或移低，听起来一样，只是换了调。',
      'zh-TW': '把整首曲子按同一個音程整體移高或移低，聽起來一樣，只是換了調。',
    },
    lessons: ['major-scale'],
    see: ['modulation', 'key', 'interval'],
  },
  {
    slug: 'modulation',
    group: 'keys',
    title: { en: 'Modulation', 'zh-CN': '转调', 'zh-TW': '轉調' },
    summary: {
      en: 'A change of key inside a piece, most often to a closely related key, made through a chord the two keys share.',
      'zh-CN': '曲子中间换了调，最常见的是换到近关系调，通过两个调共有的和弦过去。',
      'zh-TW': '曲子中間換了調，最常見的是換到近關係調，通過兩個調共有的和弦過去。',
    },
    lessons: ['chords', 'styles'],
    see: ['closely-related-keys', 'transposition', 'key'],
  },
  {
    slug: 'closely-related-keys',
    group: 'keys',
    title: { en: 'Closely related keys', 'zh-CN': '近关系调', 'zh-TW': '近關係調' },
    summary: {
      en: 'The keys a piece most often moves to: one step either way round the circle of fifths, and their relative keys.',
      'zh-CN': '曲子最常转去的那几个调：五度圈上左右相邻的调，加上它们的关系大小调。',
      'zh-TW': '曲子最常轉去的那幾個調：五度圈上左右相鄰的調，加上它們的關係大小調。',
    },
    lessons: ['chords'],
    see: ['circle-of-fifths', 'relative-keys', 'modulation'],
  },
];

// --- Finding your way in a score --------------------------------------------------------------

const ROADMAP: readonly TermInfo[] = [
  {
    slug: 'barline',
    group: 'roadmap',
    title: { en: 'Barline', 'zh-CN': '小节线', 'zh-TW': '小節線' },
    also: {
      en: ['double barline', 'final barline'],
      'zh-CN': ['双小节线', '终止线'],
      'zh-TW': ['雙小節線', '終止線'],
    },
    summary: {
      en: 'The vertical line that ends a bar. A double barline ends a section; a thin line and a thick one end the piece.',
      'zh-CN': '结束一个小节的竖线。两条细线表示一段结束，一细一粗表示全曲结束。',
      'zh-TW': '結束一個小節的豎線。兩條細線表示一段結束，一細一粗表示全曲結束。',
    },
    lessons: ['rhythm', 'sharps-and-flats'],
    see: ['repeat-sign', 'fine'],
  },
  {
    slug: 'repeat-sign',
    group: 'roadmap',
    title: { en: 'Repeat sign', 'zh-CN': '反复记号', 'zh-TW': '反覆記號' },
    also: same('𝄆 𝄇'),
    summary: {
      en: 'A double barline with two dots: play the music between a pair of them again, or from the beginning when there is only the closing one.',
      'zh-CN': '带两个点的双小节线：一对记号之间的音乐再弹一遍；只有结尾那一个时，从头再弹。',
      'zh-TW': '帶兩個點的雙小節線：一對記號之間的音樂再彈一遍；只有結尾那一個時，從頭再彈。',
    },
    lessons: ['styles'],
    see: ['first-and-second-endings', 'da-capo', 'barline'],
  },
  {
    slug: 'first-and-second-endings',
    group: 'roadmap',
    title: {
      en: 'First and second endings',
      'zh-CN': '第一结尾与第二结尾',
      'zh-TW': '第一結尾與第二結尾',
    },
    also: {
      en: ['volta', '1st and 2nd time bars'],
      'zh-CN': ['一房', '二房'],
      'zh-TW': ['一房', '二房'],
    },
    summary: {
      en: 'Brackets numbered 1. and 2. over the last bars of a repeat: play the first ending the first time, then skip it and play the second after the repeat.',
      'zh-CN': '反复段末尾标着 1. 和 2. 的括线：第一遍弹第一结尾，反复之后跳过它，改弹第二结尾。',
      'zh-TW': '反覆段末尾標著 1. 和 2. 的括線：第一遍彈第一結尾，反覆之後跳過它，改彈第二結尾。',
    },
    lessons: ['styles'],
    see: ['repeat-sign', 'coda'],
  },
  {
    slug: 'da-capo',
    group: 'roadmap',
    title: { en: 'Da capo (D.C.)', 'zh-CN': 'D.C.（从头反复）', 'zh-TW': 'D.C.（從頭反覆）' },
    also: same('D.C.', 'D.C. al Fine', 'D.C. al Coda', 'da capo'),
    summary: {
      en: 'Italian for “from the head”: go back to the beginning. D.C. al Fine then plays to the word Fine; D.C. al Coda to the jump to the coda.',
      'zh-CN':
        '意大利语“从头”：回到曲子开头。D.C. al Fine 是从头弹到 Fine 为止；D.C. al Coda 是从头弹到跳往尾声的地方。',
      'zh-TW':
        '義大利文「從頭」：回到曲子開頭。D.C. al Fine 是從頭彈到 Fine 為止；D.C. al Coda 是從頭彈到跳往尾聲的地方。',
    },
    lessons: ['styles'],
    see: ['dal-segno', 'fine', 'coda'],
  },
  {
    slug: 'dal-segno',
    group: 'roadmap',
    title: {
      en: 'Dal segno (D.S.)',
      'zh-CN': 'D.S.（从记号处反复）',
      'zh-TW': 'D.S.（從記號處反覆）',
    },
    also: same('D.S.', 'D.S. al Fine', 'D.S. al Coda', 'segno', '𝄋'),
    summary: {
      en: 'Italian for “from the sign”: go back to the sign 𝄋 rather than to the beginning, and play on from there.',
      'zh-CN': '意大利语“从记号处”：回到 𝄋 记号，而不是回到开头，从那里接着弹。',
      'zh-TW': '義大利文「從記號處」：回到 𝄋 記號，而不是回到開頭，從那裡接著彈。',
    },
    lessons: ['styles'],
    see: ['da-capo', 'coda', 'fine'],
  },
  {
    slug: 'fine',
    group: 'roadmap',
    title: { en: 'Fine', 'zh-CN': 'Fine（结束）', 'zh-TW': 'Fine（結束）' },
    summary: {
      en: 'Italian for “end”: where the piece stops after a D.C. or a D.S., though there is more music written after it.',
      'zh-CN': '意大利语“结束”：D.C. 或 D.S. 回去之后，曲子在这里停，尽管后面还写着音乐。',
      'zh-TW': '義大利文「結束」：D.C. 或 D.S. 回去之後，曲子在這裡停，儘管後面還寫著音樂。',
    },
    lessons: ['styles'],
    see: ['da-capo', 'dal-segno'],
  },
  {
    slug: 'coda',
    group: 'roadmap',
    title: { en: 'Coda', 'zh-CN': 'Coda（尾声）', 'zh-TW': 'Coda（尾聲）' },
    also: same('To Coda', '𝄌'),
    summary: {
      en: 'A closing section marked 𝄌. After a jump back, “To Coda” shows where to leave the music and skip to it.',
      'zh-CN': '用 𝄌 标出的结尾段落。跳回去重弹时，看到 To Coda 就离开，直接跳到尾声。',
      'zh-TW': '用 𝄌 標出的結尾段落。跳回去重彈時，看到 To Coda 就離開，直接跳到尾聲。',
    },
    lessons: ['styles'],
    see: ['da-capo', 'dal-segno', 'first-and-second-endings'],
  },
  {
    slug: 'ottava',
    group: 'roadmap',
    title: { en: 'Ottava (8va)', 'zh-CN': '8va（移八度记号）', 'zh-TW': '8va（移八度記號）' },
    also: same('8va', '8vb', '15ma', 'ottava'),
    summary: {
      en: '8va over the notes: play them an octave higher than written. 8vb under them: an octave lower. 15ma: two octaves higher.',
      'zh-CN': '音符上方写 8va：比写的高一个八度弹。下方写 8vb：低一个八度。15ma：高两个八度。',
      'zh-TW': '音符上方寫 8va：比寫的高一個八度彈。下方寫 8vb：低一個八度。15ma：高兩個八度。',
    },
    lessons: ['staff', 'landmarks'],
    see: ['octave'],
  },
];

// --- Tempo and expression ---------------------------------------------------------------------

/** A tempo mark's entry: its range is the metronome's own (core/tempoNames.ts). */
function tempoMark(name: TempoName, zhCN: string, zhTW: string, meaning: Words): TermInfo {
  const { from, to } = tempoRange(name);
  const word = tempoWord(name);
  const range = {
    en: to === null ? `from about ${from} beats a minute` : `about ${from} to ${to} beats a minute`,
    'zh-CN': to === null ? `每分钟约 ${from} 拍以上` : `每分钟约 ${from}–${to} 拍`,
    'zh-TW': to === null ? `每分鐘約 ${from} 拍以上` : `每分鐘約 ${from}–${to} 拍`,
  };
  return {
    slug: name,
    group: 'tempo',
    title: { en: word, 'zh-CN': `${word}（${zhCN}）`, 'zh-TW': `${word}（${zhTW}）` },
    summary: {
      en: `${meaning.en}, ${range.en}.`,
      'zh-CN': `${meaning['zh-CN']}，${range['zh-CN']}。`,
      'zh-TW': `${meaning['zh-TW']}，${range['zh-TW']}。`,
    },
    lessons: ['practising'],
    see: [
      'tempo',
      ...[
        TEMPO_NAMES[TEMPO_NAMES.indexOf(name) - 1],
        TEMPO_NAMES[TEMPO_NAMES.indexOf(name) + 1],
      ].filter((neighbour) => neighbour !== undefined),
    ],
  };
}

const TEMPO: readonly TermInfo[] = [
  {
    slug: 'tempo',
    group: 'tempo',
    title: { en: 'Tempo', 'zh-CN': '速度', 'zh-TW': '速度' },
    also: { en: ['tempo marking'], 'zh-CN': ['速度记号'], 'zh-TW': ['速度記號'] },
    summary: {
      en: 'How fast the beat goes, given as an Italian word, a number of beats a minute, or both.',
      'zh-CN': '拍子走得多快，用一个意大利语词、每分钟的拍数，或者两者一起标出。',
      'zh-TW': '拍子走得多快，用一個義大利文詞、每分鐘的拍數，或者兩者一起標出。',
    },
    lessons: ['practising', 'rhythm'],
    see: ['metronome-mark', 'andante', 'allegro', 'ritardando'],
  },
  {
    slug: 'metronome-mark',
    group: 'tempo',
    title: { en: 'Metronome mark', 'zh-CN': '节拍器标记', 'zh-TW': '節拍器記號' },
    also: same('BPM', '♩ = 120', 'M.M.'),
    summary: {
      en: '♩ = 120 at the top of a piece: 120 quarter-note beats a minute, as a metronome counts them.',
      'zh-CN': '曲子开头写的 ♩ = 120：每分钟 120 个四分音符拍，节拍器就按这个数打拍子。',
      'zh-TW': '曲子開頭寫的 ♩ = 120：每分鐘 120 個四分音符拍，節拍器就按這個數打拍子。',
    },
    lessons: ['practising', 'rhythm'],
    see: ['tempo', 'moderato'],
  },
  tempoMark('grave', '庄板', '莊板', {
    en: 'Very slow and solemn',
    'zh-CN': '极慢而庄严',
    'zh-TW': '極慢而莊嚴',
  }),
  tempoMark('largo', '广板', '廣板', {
    en: 'Broad and slow',
    'zh-CN': '宽广而缓慢',
    'zh-TW': '寬廣而緩慢',
  }),
  tempoMark('larghetto', '小广板', '小廣板', {
    en: 'A little less slow than largo',
    'zh-CN': '比广板稍快',
    'zh-TW': '比廣板稍快',
  }),
  tempoMark('adagio', '柔板', '慢板', {
    en: 'Slow and at ease',
    'zh-CN': '缓慢、从容',
    'zh-TW': '緩慢、從容',
  }),
  tempoMark('andante', '行板', '行板', {
    en: 'At a walking pace',
    'zh-CN': '步行的速度',
    'zh-TW': '步行的速度',
  }),
  tempoMark('moderato', '中板', '中板', {
    en: 'At a moderate speed',
    'zh-CN': '中等速度',
    'zh-TW': '中等速度',
  }),
  tempoMark('allegro', '快板', '快板', {
    en: 'Fast and bright',
    'zh-CN': '快速而活泼',
    'zh-TW': '快速而活潑',
  }),
  tempoMark('presto', '急板', '急板', {
    en: 'Very fast',
    'zh-CN': '非常快',
    'zh-TW': '非常快',
  }),
  tempoMark('prestissimo', '最急板', '最急板', {
    en: 'As fast as possible',
    'zh-CN': '尽可能快',
    'zh-TW': '盡可能快',
  }),
  {
    slug: 'ritardando',
    group: 'tempo',
    title: { en: 'Ritardando (rit.)', 'zh-CN': '渐慢（rit.）', 'zh-TW': '漸慢（rit.）' },
    also: same('rit.', 'ritard.', 'rall.', 'rallentando'),
    summary: {
      en: 'Gradually slower, until a tempo or the end. Rallentando (rall.) means the same.',
      'zh-CN': '逐渐放慢，直到 a tempo 或曲子结束。rallentando（rall.）意思一样。',
      'zh-TW': '逐漸放慢，直到 a tempo 或曲子結束。rallentando（rall.）意思一樣。',
    },
    lessons: ['styles'],
    see: ['accelerando', 'a-tempo', 'fermata'],
  },
  {
    slug: 'accelerando',
    group: 'tempo',
    title: { en: 'Accelerando (accel.)', 'zh-CN': '渐快（accel.）', 'zh-TW': '漸快（accel.）' },
    also: same('accel.'),
    summary: {
      en: 'Gradually faster, until a new tempo is reached or a tempo brings the old one back.',
      'zh-CN': '逐渐加快，直到新的速度，或者看到 a tempo 回到原速。',
      'zh-TW': '逐漸加快，直到新的速度，或者看到 a tempo 回到原速。',
    },
    lessons: ['practising'],
    see: ['ritardando', 'a-tempo'],
  },
  {
    slug: 'a-tempo',
    group: 'tempo',
    title: { en: 'A tempo', 'zh-CN': 'A tempo（回原速）', 'zh-TW': 'A tempo（回原速）' },
    also: same('a tempo', 'tempo primo', 'Tempo I'),
    summary: {
      en: 'Back to the tempo of before, after a rit., an accel. or a rubato.',
      'zh-CN': '在 rit.、accel. 或 rubato 之后，回到原来的速度。',
      'zh-TW': '在 rit.、accel. 或 rubato 之後，回到原來的速度。',
    },
    lessons: ['styles'],
    see: ['ritardando', 'accelerando', 'rubato'],
  },
  {
    slug: 'rubato',
    group: 'tempo',
    title: { en: 'Rubato', 'zh-CN': 'Rubato（弹性速度）', 'zh-TW': 'Rubato（彈性速度）' },
    also: { en: ['tempo rubato'], 'zh-CN': ['自由速度'], 'zh-TW': ['自由速度'] },
    summary: {
      en: 'Time taken from some notes and given to others, so that a phrase can breathe while the pulse goes on underneath.',
      'zh-CN': '有的音拉长一点，有的赶一点，让乐句有呼吸，底下的拍子照样往前走。',
      'zh-TW': '有的音拉長一點，有的趕一點，讓樂句有呼吸，底下的拍子照樣往前走。',
    },
    lessons: ['styles'],
    see: ['a-tempo', 'espressivo'],
  },
  {
    slug: 'fermata',
    group: 'tempo',
    title: { en: 'Fermata', 'zh-CN': '延长记号', 'zh-TW': '延長記號' },
    also: same('𝄐', 'pause', 'birdseye'),
    summary: {
      en: 'The sign 𝄐 over a note or a rest: hold it longer than written, for as long as feels right, then go on.',
      'zh-CN': '写在音符或休止符上的 𝄐：比写的时值多停一会儿，停多久凭感觉，然后接着弹。',
      'zh-TW': '寫在音符或休止符上的 𝄐：比寫的時值多停一會兒，停多久憑感覺，然後接著彈。',
    },
    lessons: ['ornaments'],
    see: ['ritardando', 'fine'],
  },
  {
    slug: 'dynamic-marks',
    group: 'tempo',
    title: { en: 'Dynamics', 'zh-CN': '力度记号', 'zh-TW': '力度記號' },
    also: same('pp', 'p', 'mp', 'mf', 'f', 'ff', 'piano', 'forte'),
    summary: {
      en: 'How loud or soft to play, written as letters from pp, very soft, to ff, very loud.',
      'zh-CN': '弹多响或多轻，用字母标出：从 pp（很弱）到 ff（很强）。',
      'zh-TW': '彈多響或多輕，用字母標出：從 pp（很弱）到 ff（很強）。',
    },
    lessons: ['dynamics'],
    see: ['crescendo', 'diminuendo'],
  },
  {
    slug: 'crescendo',
    group: 'tempo',
    title: { en: 'Crescendo (cresc.)', 'zh-CN': '渐强（cresc.）', 'zh-TW': '漸強（cresc.）' },
    also: same('cresc.', '<'),
    summary: {
      en: 'Gradually louder, written cresc. or as a hairpin that opens, <.',
      'zh-CN': '逐渐变强，写作 cresc.，或者一个张开的发夹符号 <。',
      'zh-TW': '逐漸變強，寫作 cresc.，或者一個張開的漸強符號 <。',
    },
    lessons: ['dynamics'],
    see: ['diminuendo', 'dynamic-marks'],
  },
  {
    slug: 'diminuendo',
    group: 'tempo',
    title: { en: 'Diminuendo (dim.)', 'zh-CN': '渐弱（dim.）', 'zh-TW': '漸弱（dim.）' },
    also: same('dim.', 'decresc.', 'decrescendo', '>'),
    summary: {
      en: 'Gradually softer, written dim., decresc. or as a hairpin that closes, >.',
      'zh-CN': '逐渐变弱，写作 dim.、decresc.，或者一个合拢的发夹符号 >。',
      'zh-TW': '逐漸變弱，寫作 dim.、decresc.，或者一個合攏的漸弱符號 >。',
    },
    lessons: ['dynamics'],
    see: ['crescendo', 'dynamic-marks'],
  },
  {
    slug: 'legato',
    group: 'tempo',
    title: { en: 'Legato', 'zh-CN': 'Legato（连奏）', 'zh-TW': 'Legato（連奏）' },
    also: { en: ['slur'], 'zh-CN': ['连线', '圆滑线'], 'zh-TW': ['連線', '圓滑線'] },
    summary: {
      en: 'Smoothly joined: each note held until the next begins. A slur over the notes asks for it.',
      'zh-CN': '连贯地弹：每个音一直按到下一个音响起。音符上的连线就是要求连奏。',
      'zh-TW': '連貫地彈：每個音一直按到下一個音響起。音符上的連線就是要求連奏。',
    },
    lessons: ['dynamics'],
    see: ['staccato', 'cantabile'],
  },
  {
    slug: 'staccato',
    group: 'tempo',
    title: { en: 'Staccato', 'zh-CN': 'Staccato（跳音）', 'zh-TW': 'Staccato（斷奏）' },
    also: { en: ['staccato dot'], 'zh-CN': ['断奏'], 'zh-TW': ['跳音'] },
    summary: {
      en: 'Short and detached: a dot over or under a note, played for about half its value.',
      'zh-CN': '短而分开：音符上方或下方的一个点，只弹大约一半时值。',
      'zh-TW': '短而分開：音符上方或下方的一個點，只彈大約一半時值。',
    },
    lessons: ['dynamics'],
    see: ['legato'],
  },
  {
    slug: 'dolce',
    group: 'tempo',
    title: { en: 'Dolce', 'zh-CN': 'Dolce（柔和地）', 'zh-TW': 'Dolce（柔和地）' },
    summary: {
      en: 'Sweetly: soft and gentle in tone, with no edge to the sound.',
      'zh-CN': '甜美地：音色柔和、温和，声音不带棱角。',
      'zh-TW': '甜美地：音色柔和、溫和，聲音不帶稜角。',
    },
    lessons: ['dynamics'],
    see: ['cantabile', 'espressivo'],
  },
  {
    slug: 'cantabile',
    group: 'tempo',
    title: { en: 'Cantabile', 'zh-CN': 'Cantabile（如歌地）', 'zh-TW': 'Cantabile（如歌地）' },
    summary: {
      en: 'In a singing way: the tune smooth and carried over what is under it.',
      'zh-CN': '像唱歌一样：旋律连贯，浮在伴奏之上。',
      'zh-TW': '像唱歌一樣：旋律連貫，浮在伴奏之上。',
    },
    lessons: ['dynamics'],
    see: ['legato', 'dolce'],
  },
  {
    slug: 'espressivo',
    group: 'tempo',
    title: {
      en: 'Espressivo (espress.)',
      'zh-CN': 'Espressivo（有表情地）',
      'zh-TW': 'Espressivo（有表情地）',
    },
    also: same('espress.', 'espr.'),
    summary: {
      en: 'With expression: each phrase shaped more than usual, in loudness and in time.',
      'zh-CN': '有表情地：每个乐句的强弱和快慢都比平常起伏更大。',
      'zh-TW': '有表情地：每個樂句的強弱和快慢都比平常起伏更大。',
    },
    lessons: ['dynamics'],
    see: ['rubato', 'dolce'],
  },
  {
    slug: 'modifiers',
    group: 'tempo',
    title: {
      en: 'Molto, poco, più, meno',
      'zh-CN': 'Molto、poco、più、meno',
      'zh-TW': 'Molto、poco、più、meno',
    },
    also: same('molto', 'poco', 'più', 'meno', 'sempre', 'subito', 'poco a poco', 'non troppo'),
    summary: {
      en: 'Small Italian words that change another: molto (very), poco (a little), più (more), meno (less), sempre (always), subito (suddenly).',
      'zh-CN':
        '修饰别的词的意大利语小词：molto（很）、poco（稍微）、più（更）、meno（较少）、sempre（始终）、subito（突然）。',
      'zh-TW':
        '修飾別的詞的義大利文小詞：molto（很）、poco（稍微）、più（更）、meno（較少）、sempre（始終）、subito（突然）。',
    },
    lessons: ['dynamics'],
    see: ['allegro', 'crescendo', 'ritardando'],
  },
];

export const TERMS: readonly TermInfo[] = [...INTERVALS, ...KEYS, ...ROADMAP, ...TEMPO];

export function termBySlug(slug: string): TermInfo | undefined {
  return TERMS.find((term) => term.slug === slug);
}

export function termsOf(group: TermGroup): readonly TermInfo[] {
  return TERMS.filter((term) => term.group === group);
}
