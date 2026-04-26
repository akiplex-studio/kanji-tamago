/**
 * ステージクリア時のモンスターのセリフ
 * 学年に依存しない汎用メッセージ。ステージ番号ごとに違う演出を用意。
 * ステージ9以降は generic なセリフ。
 */

export interface TipEntry {
  title: string;
  pages: string[];
}

const STAGE_TIP_TEMPLATES: TipEntry[] = [
  {
    title: 'ステージ1 クリア！',
    pages: [
      `さいしょの ステージ クリア！\nすごい すごい！\n\nたまごが ピクピク うごいたよ…\nなにかが うまれそう…🥚`,
    ],
  },
  {
    title: 'ステージ2 クリア！',
    pages: [
      `2つめの ステージも バッチリ！\n\nたまごから ピヨコに\nしんかしたよ！🐣`,
    ],
  },
  {
    title: 'ステージ3 クリア！',
    pages: [
      `3つめの ステージ クリア！\n\nピヨコが げんきに\nはばたいているよ！🐥`,
    ],
  },
  {
    title: 'ステージ4 クリア！',
    pages: [
      `4つめの ステージ クリア！\n\nピヨコが ぼうけんの\nたびに でかけたよ！🌳`,
    ],
  },
  {
    title: 'ステージ5 クリア！',
    pages: [
      `5つめの ステージ クリア！\n\nピヨコが おおきく なって\nヒヨッピに しんかしたよ！✨`,
    ],
  },
  {
    title: 'ステージ6 クリア！',
    pages: [
      `6つめの ステージ クリア！\n\nヒヨッピが にじいろに\nひかっているよ！🌈`,
    ],
  },
  {
    title: 'ステージ7 クリア！',
    pages: [
      `7つめの ステージ クリア！\n\nあと すこしで つぎの\nしんかだよ！がんばれ！📚`,
    ],
  },
  {
    title: 'ステージ8 クリア！',
    pages: [
      `8つめの ステージ クリア！\n\nヒヨッピが トリサマに\nしんかしたよ！👑`,
    ],
  },
];

const MAX_STAGES = 20; // どの学年でも余裕のある上限

export function tipForStage(stage: number): TipEntry {
  if (stage >= 1 && stage <= STAGE_TIP_TEMPLATES.length) {
    return STAGE_TIP_TEMPLATES[stage - 1];
  }
  return {
    title: `ステージ${stage} クリア！`,
    pages: [
      `ステージ${stage} クリア！\nすごいぞ！\n\nモンスターが ますます\nたくましく なったよ！🌟`,
    ],
  };
}

// 会話一覧などで使う配列表示用。上限分だけ生成。
export const STATION_TIPS: TipEntry[] = Array.from({ length: MAX_STAGES }, (_, i) => tipForStage(i + 1));

/**
 * 全ステージクリア時のエンディングセリフ（学年問わず共通）
 */
export const ENDING_TIP: TipEntry = {
  title: 'ぜんぶクリア！',
  pages: [
    `おめでとう！！\n\nえらんだ がくねんの かんじを\nぜんぶ おぼえられたね！\n\nきみは もう\nかんじマスターだよ！🌟`,
    `たまごから そだてた モンスターも\nりっぱな トリサマに なったね。\n\nつぎの がくねんにも\nちょうせんしてみよう！\n\nまた あそぼうね！🐣✨`,
  ],
};
