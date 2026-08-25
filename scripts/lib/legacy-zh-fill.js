/**
 * 旧 App 里翻译练习的题面/答案只有英文（Cindy 的讲义是英文教学）。
 * 中文是主语言，这些必须补上 —— 手写在这里，extract-legacy.js 重跑也不会丢。
 *
 * 键 = 旧数据里的英文原文（精确匹配），值 = 中文。
 * 标点跟随现有内容的风格（半角 , ? !），引号用「」。
 */
export const ZH_FILL = {
  /* L4 · udah（已经） */
  "I've already eaten.": '我已经吃过了。',
  "She's already slept.": '她已经睡了。',
  "I've already had coffee.": '我已经喝过咖啡了。',
  "He's already worked.": '他已经上过班了。',
  "I've already showered.": '我已经洗过澡了。',

  /* L4 · belum（还没） */
  "I'm not ready yet.": '我还没准备好。',
  "She hasn't come yet.": '她还没来。',
  "I haven't eaten yet.": '我还没吃。',
  "He hasn't slept yet.": '他还没睡。',
  "I haven't studied yet.": '我还没学。',

  /* L5 · banget / paling / terlalu —— 印尼语 → 中文 */
  'So happy.': '超开心。',
  'Super hungry.': '超饿。',
  'So sleepy.': '超困。',
  'Super busy.': '超忙。',
  'The richest.': '最有钱。',
  'The easiest.': '最简单。',
  'The most famous.': '最有名。',
  'Too spicy.': '太辣了。',
  'Too expensive.': '太贵了。',
  'Too hot.': '太热了。',

  /* L5 · 中文 → 印尼语 */
  'The smartest': '最聪明',
  'Very difficult': '超难',
  'Too busy': '太忙了',
  'Too spicy': '太辣了',
  'Very stupid': '超笨',
  'The most handsome': '最帅',
  'The most popular': '最有名',
  'Very funny': '超好笑',
  'Too cheap': '太便宜了',
  'The smallest': '最小',

  /* L6 · 疑问词复习 */
  'What is this?': '这是什么?',
  'Who is your teacher?': '你老师是谁?',
  'Where do you work?': '你在哪儿上班?',
  'How is Indonesian food?': '印尼菜怎么样?',
  'When does she go to Singapore?': '她什么时候去新加坡?',
  'Why is he learning Japanese?': '他为什么学日语?',
  "I like Indomie because it's tasty.": '我喜欢 Indomie,因为好吃。',
  'Who is that singer?': '那个歌手是谁?',
  'Where do they study?': '他们在哪儿学习?',
  'Why do you like watching anime?': '你为什么喜欢看动漫?',
  'When will you go to the Netherlands?': '你什么时候去荷兰?',
  "Because it's spicy.": '因为辣。',
  'Where is your office?': '你公司在哪?',
  'How do you go to Bali?': '你怎么去巴厘岛?',
  'Who are they?': '他们是谁?',
  'Why do you learn Indonesian?': '你为什么学印尼语?',
  'Where is the hospital?': '医院在哪?',
  'How is Jakarta?': '雅加达怎么样?',

  /* L6 · 时态复习 */
  'She went to Paris yesterday.': '她昨天去了巴黎。',
  "They're playing at the beach.": '他们正在海滩玩。',
  'I haven\'t eaten dinner yet.': '我还没吃晚饭。',
  "We'll buy coffee at the coffee shop.": '我们要去咖啡店买咖啡。',
  'I will learn Japanese.': '我要学日语。',
};

/**
 * 练习标题里写死了「英文」，但主语言是中文。
 * 键 = 旧标题，值 = {zh, en}（ja 留空，暂缓）。
 */
export const TITLE_FIX = {
  '① 印尼语 → 英文(答案可遮挡)': {
    zh: '① 印尼语 → 中文(答案可遮挡)',
    en: '① Indonesian → English (tap to reveal)',
  },
  '② 英文 → 印尼语(答案可遮挡)': {
    zh: '② 中文 → 印尼语(答案可遮挡)',
    en: '② English → Indonesian (tap to reveal)',
  },
};
