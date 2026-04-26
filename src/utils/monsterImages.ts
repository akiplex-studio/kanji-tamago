// モンスター種別ごとの5段階進化画像
// 未登録の種別は絵文字フォールバック

import S01_01 from '../assets/monster/S01-01.png';
import S01_02 from '../assets/monster/S01-02.png';
import S01_03 from '../assets/monster/S01-03.png';
import S01_04 from '../assets/monster/S01-04.png';
import S01_05 from '../assets/monster/S01-05.png';
import S02_01 from '../assets/monster/S02-01.png';
import S02_02 from '../assets/monster/S02-02.png';
import S02_03 from '../assets/monster/S02-03.png';
import S02_04 from '../assets/monster/S02-04.png';
import S02_05 from '../assets/monster/S02-05.png';
import S03_01 from '../assets/monster/S03-01.png';
import S03_02 from '../assets/monster/S03-02.png';
import S03_03 from '../assets/monster/S03-03.png';
import S03_04 from '../assets/monster/S03-04.png';
import S03_05 from '../assets/monster/S03-05.png';
import S04_01 from '../assets/monster/S04-01.png';
import S04_02 from '../assets/monster/S04-02.png';
import S04_03 from '../assets/monster/S04-03.png';
import S04_04 from '../assets/monster/S04-04.png';
import S04_05 from '../assets/monster/S04-05.png';
import S05_01 from '../assets/monster/S05-01.png';
import S05_02 from '../assets/monster/S05-02.png';
import S05_03 from '../assets/monster/S05-03.png';
import S05_04 from '../assets/monster/S05-04.png';
import S05_05 from '../assets/monster/S05-05.png';
import S06_01 from '../assets/monster/S06-01.png';
import S06_02 from '../assets/monster/S06-02.png';
import S06_03 from '../assets/monster/S06-03.png';
import S06_04 from '../assets/monster/S06-04.png';
import S06_05 from '../assets/monster/S06-05.png';
import S07_01 from '../assets/monster/S07-01.png';
import S07_02 from '../assets/monster/S07-02.png';
import S07_03 from '../assets/monster/S07-03.png';
import S07_04 from '../assets/monster/S07-04.png';
import S07_05 from '../assets/monster/S07-05.png';
import S08_01 from '../assets/monster/S08-01.png';
import S08_02 from '../assets/monster/S08-02.png';
import S08_03 from '../assets/monster/S08-03.png';
import S08_04 from '../assets/monster/S08-04.png';
import S08_05 from '../assets/monster/S08-05.png';
import S09_01 from '../assets/monster/S09-01.png';
import S09_02 from '../assets/monster/S09-02.png';
import S09_03 from '../assets/monster/S09-03.png';
import S09_04 from '../assets/monster/S09-04.png';
import S09_05 from '../assets/monster/S09-05.png';
import S10_01 from '../assets/monster/S10-01.png';
import S10_02 from '../assets/monster/S10-02.png';
import S10_03 from '../assets/monster/S10-03.png';
import S10_04 from '../assets/monster/S10-04.png';
import S10_05 from '../assets/monster/S10-05.png';
import S11_01 from '../assets/monster/S11-01.png';
import S11_02 from '../assets/monster/S11-02.png';
import S11_03 from '../assets/monster/S11-03.png';
import S11_04 from '../assets/monster/S11-04.png';
import S11_05 from '../assets/monster/S11-05.png';
// S12: 旧マーメイドのプレースホルダ（既存のセーブデータ互換のため import を残す）
import S12_01 from '../assets/monster/S12-01.png';
import S12_02 from '../assets/monster/S12-02.png';
import S12_03 from '../assets/monster/S12-03.png';
import S12_04 from '../assets/monster/S12-04.png';
import S12_05 from '../assets/monster/S12-05.png';
// M01〜M05: クエスト難度クリア報酬のマーメイド（tier ごとに別種）
import M01_01 from '../assets/monster/M01-01.png';
import M01_02 from '../assets/monster/M01-02.png';
import M01_03 from '../assets/monster/M01-03.png';
import M01_04 from '../assets/monster/M01-04.png';
import M01_05 from '../assets/monster/M01-05.png';
import M02_01 from '../assets/monster/M02-01.png';
import M02_02 from '../assets/monster/M02-02.png';
import M02_03 from '../assets/monster/M02-03.png';
import M02_04 from '../assets/monster/M02-04.png';
import M02_05 from '../assets/monster/M02-05.png';
import M03_01 from '../assets/monster/M03-01.png';
import M03_02 from '../assets/monster/M03-02.png';
import M03_03 from '../assets/monster/M03-03.png';
import M03_04 from '../assets/monster/M03-04.png';
import M03_05 from '../assets/monster/M03-05.png';
import M04_01 from '../assets/monster/M04-01.png';
import M04_02 from '../assets/monster/M04-02.png';
import M04_03 from '../assets/monster/M04-03.png';
import M04_04 from '../assets/monster/M04-04.png';
import M04_05 from '../assets/monster/M04-05.png';
import M05_01 from '../assets/monster/M05-01.png';
import M05_02 from '../assets/monster/M05-02.png';
import M05_03 from '../assets/monster/M05-03.png';
import M05_04 from '../assets/monster/M05-04.png';
import M05_05 from '../assets/monster/M05-05.png';

const MONSTER_IMAGES: Record<string, [string, string, string, string, string]> = {
  'S01': [S01_01, S01_02, S01_03, S01_04, S01_05],
  'S02': [S02_01, S02_02, S02_03, S02_04, S02_05],
  'S03': [S03_01, S03_02, S03_03, S03_04, S03_05],
  'S04': [S04_01, S04_02, S04_03, S04_04, S04_05],
  'S05': [S05_01, S05_02, S05_03, S05_04, S05_05],
  'S06': [S06_01, S06_02, S06_03, S06_04, S06_05],
  'S07': [S07_01, S07_02, S07_03, S07_04, S07_05],
  'S08': [S08_01, S08_02, S08_03, S08_04, S08_05],
  'S09': [S09_01, S09_02, S09_03, S09_04, S09_05],
  'S10': [S10_01, S10_02, S10_03, S10_04, S10_05],
  'S11': [S11_01, S11_02, S11_03, S11_04, S11_05],
  'S12': [S12_01, S12_02, S12_03, S12_04, S12_05],
  'M01': [M01_01, M01_02, M01_03, M01_04, M01_05],
  'M02': [M02_01, M02_02, M02_03, M02_04, M02_05],
  'M03': [M03_01, M03_02, M03_03, M03_04, M03_05],
  'M04': [M04_01, M04_02, M04_03, M04_04, M04_05],
  'M05': [M05_01, M05_02, M05_03, M05_04, M05_05],
};

export function getMonsterImage(species: string, stageIndex: 0 | 1 | 2 | 3 | 4): string | null {
  const set = MONSTER_IMAGES[species];
  if (!set) return null;
  return set[stageIndex];
}

/** コレクション表示用：完成形（stage 4）の画像 */
export function getMonsterFinalImage(species: string): string | null {
  return getMonsterImage(species, 4);
}
