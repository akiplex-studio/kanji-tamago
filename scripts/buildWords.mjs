// CSV → allWords.json 生成スクリプト
// shogaku1_kanji.csv 〜 shogaku6_kanji.csv を読み込み、
// 学年ごとに 20 語ずつのステージに分割して 1 つの JSON に書き出す。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PRESET_DIR = path.resolve(__dirname, '..', 'src', 'data', 'preset');

const STAGE_SIZE = 20;
const GRADES = [1, 2, 3, 4, 5, 6];

function parseCsv(text) {
  const rows = text.replace(/\r\n?/g, '\n').split('\n').filter(Boolean);
  const out = [];
  // 1 行目はヘッダ（漢字,読み）
  for (let i = 1; i < rows.length; i++) {
    const line = rows[i];
    const idx = line.indexOf(',');
    if (idx < 0) continue;
    const front = line.slice(0, idx).trim();
    const back = line.slice(idx + 1).trim();
    if (!front || !back) continue;
    out.push({ front, back });
  }
  return out;
}

// 端数処理：残り 10 語未満は前ステージに吸収して「だいたい 20 語」のステージを作る
function chunkIntoStages(list) {
  const stages = [];
  for (let i = 0; i < list.length; i += STAGE_SIZE) {
    stages.push(list.slice(i, i + STAGE_SIZE));
  }
  if (stages.length >= 2 && stages[stages.length - 1].length < 10) {
    const tail = stages.pop();
    stages[stages.length - 1] = stages[stages.length - 1].concat(tail);
  }
  return stages;
}

const allWords = [];
let globalRank = 0;

for (const grade of GRADES) {
  const csvPath = path.join(PRESET_DIR, `shogaku${grade}_kanji.csv`);
  if (!fs.existsSync(csvPath)) {
    console.warn(`skip: ${csvPath} が見つかりません`);
    continue;
  }
  const rows = parseCsv(fs.readFileSync(csvPath, 'utf-8'));
  const stages = chunkIntoStages(rows);
  stages.forEach((stage, stageIdx) => {
    const stationNum = stageIdx + 1;
    const stationName = `ステージ${stationNum}`;
    for (const row of stage) {
      globalRank += 1;
      allWords.push({
        id: `kanji-g${grade}-${row.front}`,
        front: row.front,
        back: row.back,
        example_en: '',
        example_ja: '',
        level: grade,
        station: stationNum,
        station_name: stationName,
        sfi_rank: globalRank,
        note: '',
      });
    }
  });
  console.log(`小${grade}: ${rows.length}語 → ${stages.length}ステージ`);
}

const outPath = path.join(PRESET_DIR, 'allWords.json');
fs.writeFileSync(outPath, JSON.stringify(allWords, null, 2) + '\n', 'utf-8');
console.log(`書き出し完了: ${outPath} (${allWords.length} 語)`);
