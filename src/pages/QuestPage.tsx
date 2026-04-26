import { useState } from 'react';
import type { MonsterState } from '../utils/monsterState';
import { getMonsterCombatStats, getCurrentStageIndex } from '../utils/monsterState';
import { getMonsterFinalImage, getMonsterImage } from '../utils/monsterImages';
import {
  TIER_LABELS, TIER_TARGET_LEVEL, TIER_ORDER, getDemonStats, PARTY_SIZE_MAX, PARTY_SIZE_MIN, TOTAL_STAGES,
  MERMAID_BY_TIER, listOwnedMermaidEggTiers,
  type DifficultyTier, type QuestState,
} from '../utils/questState';
import BattleScene from '../components/BattleScene';

type Props = {
  monsterState: MonsterState;
  questState: QuestState;
  onClose: () => void;
  onFinishBattle: (victory: boolean, stagesCleared: number) => void;
  onHatchMermaidEgg: (tier: DifficultyTier) => boolean;
};

type SubScreen = 'tier-select' | 'party-select' | 'confirm' | 'battle' | 'result';

/** クエストに連れていける1体のモンスター（育成中 or 卒業済み） */
type SelectableMonster = {
  id: string;
  species: string;
  level: number;
  isCurrent?: boolean;  // 育成中（コレクション外）の場合 true
};

const CURRENT_MONSTER_ID = '__current__';

export default function QuestPage({ monsterState, questState, onClose, onFinishBattle, onHatchMermaidEgg }: Props) {
  const [sub, setSub] = useState<SubScreen>('tier-select');
  const [tier, setTier] = useState<DifficultyTier>(questState.currentTier);
  const [partyIds, setPartyIds] = useState<string[]>([]);
  const [battleResult, setBattleResult] = useState<{ victory: boolean; stagesCleared: number } | null>(null);

  // 連れていける候補：育成中モンスター（fed>0 = タマゴ脱却済）+ 卒業済みコレクション
  const selectables: SelectableMonster[] = [];
  const cur = monsterState.currentMonster;
  if (cur.fed > 0) {
    const stage = getCurrentStageIndex(cur.fed);
    selectables.push({
      id: CURRENT_MONSTER_ID,
      species: cur.species,
      level: stage + 1,  // Lv1〜Lv5
      isCurrent: true,
    });
  }
  for (const m of monsterState.collection) {
    selectables.push({ id: m.id, species: m.species, level: m.level });
  }

  function startParty() {
    setPartyIds([]);
    setSub('party-select');
  }

  function toggleParty(id: string) {
    setPartyIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= PARTY_SIZE_MAX) return prev; // 上限到達
      return [...prev, id];
    });
  }

  function startBattle() {
    setSub('battle');
  }

  function handleBattleEnd(victory: boolean, stagesCleared: number) {
    setBattleResult({ victory, stagesCleared });
    onFinishBattle(victory, stagesCleared);
    setSub('result');
  }

  const partyMonsters = partyIds
    .map(id => selectables.find(m => m.id === id))
    .filter((m): m is SelectableMonster => !!m);

  return (
    <div className="flex flex-col" style={{ minHeight: '100svh', backgroundColor: '#FFF9F0', paddingBottom: 100 }}>
      {/* ヘッダー */}
      <div className="px-4 pt-6 pb-3 flex items-center">
        <button onClick={onClose} className="text-sm" style={{ color: '#888' }}>
          ← もどる
        </button>
        <h1 className="text-xl font-bold flex-1 text-center" style={{ color: '#D32F2F' }}>
          ⚔️ クエスト
        </h1>
        <div className="w-12" />
      </div>

      {sub === 'tier-select' && (
        <TierSelectScreen
          questState={questState}
          selectables={selectables}
          tier={tier}
          onSelectTier={setTier}
          onStart={startParty}
          canHatch={monsterState.currentMonster.fed === 0}
          onHatch={onHatchMermaidEgg}
        />
      )}
      {sub === 'party-select' && (
        <PartySelectScreen
          selectables={selectables}
          tier={tier}
          partyIds={partyIds}
          onToggle={toggleParty}
          onBack={() => setSub('tier-select')}
          onConfirm={() => setSub('confirm')}
        />
      )}
      {sub === 'confirm' && (
        <ConfirmScreen
          tier={tier}
          partyMonsters={partyMonsters}
          onBack={() => setSub('party-select')}
          onStart={startBattle}
        />
      )}
      {sub === 'battle' && (
        <BattleScene
          tier={tier}
          partyMonsters={partyMonsters}
          onEnd={handleBattleEnd}
        />
      )}
      {sub === 'result' && battleResult && (
        <ResultScreen
          tier={tier}
          result={battleResult}
          hasEggForTier={questState.mermaidEggsByTier[tier]}
          canHatch={monsterState.currentMonster.fed === 0}
          onHatch={onHatchMermaidEgg}
          onRetry={() => { setBattleResult(null); setSub('tier-select'); setTier(questState.currentTier); }}
          onClose={onClose}
        />
      )}
    </div>
  );
}

// ============================================================
// 難度選択
// ============================================================

function TierSelectScreen({
  questState, selectables, tier, onSelectTier, onStart, canHatch, onHatch,
}: {
  questState: QuestState;
  selectables: SelectableMonster[];
  tier: DifficultyTier;
  onSelectTier: (t: DifficultyTier) => void;
  onStart: () => void;
  canHatch: boolean;
  onHatch: (tier: DifficultyTier) => boolean;
}) {
  const monstersCount = selectables.length;
  const canStart = monstersCount >= PARTY_SIZE_MIN;
  const ownedEggs = listOwnedMermaidEggTiers(questState);

  return (
    <div className="flex-1 px-4 flex flex-col">
      <p className="text-sm text-center mb-4" style={{ color: '#888' }}>
        モンスターを {PARTY_SIZE_MIN}〜{PARTY_SIZE_MAX}たい つれて デーモンと たたかおう！
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {TIER_ORDER.map(t => {
          const cleared = questState.clearedTiers.includes(t);
          const locked = TIER_ORDER.indexOf(t) > TIER_ORDER.indexOf(questState.currentTier);
          const selected = tier === t;
          const targetLv = TIER_TARGET_LEVEL[t];
          return (
            <button
              key={t}
              onClick={() => !locked && onSelectTier(t)}
              disabled={locked}
              className="w-full py-3 px-4 rounded-2xl text-left active:scale-95 transition-all"
              style={{
                backgroundColor: selected ? '#FF8A80' : locked ? '#F5F5F5' : '#FFF',
                border: selected ? '2px solid #D32F2F' : `2px solid ${locked ? '#E0E0E0' : '#FFCDD2'}`,
                color: selected ? '#FFF' : locked ? '#CCC' : '#333',
                opacity: locked ? 0.6 : 1,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-base">
                    {TIER_LABELS[t]}{cleared && ' ✅'}
                  </div>
                  <div style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.85)' : locked ? '#BBB' : '#888', marginTop: 2 }}>
                    {locked ? '🔒 まだ えらべない' : `Lv${targetLv}+ の パーティ ですいしょう`}
                  </div>
                </div>
                {selected && <span style={{ fontSize: 20 }}>✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-center text-xs mb-3" style={{ color: '#999' }}>
        つれていける モンスター: <strong style={{ color: '#D32F2F' }}>{monstersCount}たい</strong>
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        className="w-full py-3.5 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
        style={{
          background: canStart ? 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)' : '#DDD',
          color: '#FFF',
          fontSize: 16,
        }}
      >
        {canStart ? `パーティを えらぶ →` : `モンスターを そだてよう`}
      </button>

      {ownedEggs.length > 0 && (
        <div className="mt-4 p-3 rounded-2xl" style={{ backgroundColor: '#FFEBEE', border: '1px solid #FF8A80' }}>
          <div className="text-center mb-2" style={{ fontSize: 12, color: '#D32F2F', fontWeight: 'bold' }}>
            もっている マーメイドの たまご
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {ownedEggs.map(t => (
              <button
                key={t}
                onClick={() => { if (canHatch) onHatch(t); }}
                disabled={!canHatch}
                className="rounded-2xl px-3 py-2 active:scale-95 transition-all"
                style={{
                  backgroundColor: canHatch ? '#FFF' : '#F5F5F5',
                  border: '1.5px solid #FF8A80',
                  cursor: canHatch ? 'pointer' : 'default',
                  opacity: canHatch ? 1 : 0.7,
                  minWidth: 88,
                }}
              >
                <div style={{ fontSize: 22, lineHeight: 1 }}>🥚</div>
                <div style={{ fontSize: 11, color: '#D32F2F', fontWeight: 'bold', marginTop: 2 }}>
                  {TIER_LABELS[t]}
                </div>
                <div style={{ fontSize: 9, color: '#888', marginTop: 1 }}>
                  ({MERMAID_BY_TIER[t]})
                </div>
              </button>
            ))}
          </div>
          <div className="text-center" style={{ fontSize: 10, color: '#888', marginTop: 6 }}>
            {canHatch
              ? 'タップで いま すぐ かえせるよ'
              : 'いま そだてている モンスターが おとなに なったら かえせるよ'}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// パーティ選択
// ============================================================

function PartySelectScreen({
  selectables, tier, partyIds, onToggle, onBack, onConfirm,
}: {
  selectables: SelectableMonster[];
  tier: DifficultyTier;
  partyIds: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  // レベル降順で表示（強い順）。育成中は末尾に
  const sorted = [...selectables].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return 1;
    if (!a.isCurrent && b.isCurrent) return -1;
    return b.level - a.level;
  });
  const ready = partyIds.length >= PARTY_SIZE_MIN;
  const targetLv = TIER_TARGET_LEVEL[tier];

  return (
    <div className="flex-1 px-3 flex flex-col">
      <p className="text-sm text-center mb-2" style={{ color: '#888' }}>
        パーティに つれていく モンスターを タップで えらんでね（<strong>{PARTY_SIZE_MIN}〜{PARTY_SIZE_MAX}たい</strong>）
      </p>
      <p className="text-xs text-center mb-3" style={{ color: '#AAA' }}>
        ({TIER_LABELS[tier]} ／ Lv{targetLv}+ ですいしょう)
      </p>

      <div className="flex-1 grid grid-cols-3 gap-2 overflow-y-auto pb-3">
        {sorted.map(m => {
          const selected = partyIds.includes(m.id);
          const order = partyIds.indexOf(m.id) + 1;
          // 育成中は現在のステージ画像、卒業済みは最終形
          const img = m.isCurrent
            ? getMonsterImage(m.species, (m.level - 1) as 0 | 1 | 2 | 3 | 4)
            : getMonsterFinalImage(m.species);
          const stats = getMonsterCombatStats(m.level);
          return (
            <button
              key={m.id}
              onClick={() => onToggle(m.id)}
              className="rounded-2xl p-2 text-center active:scale-95 transition-all relative"
              style={{
                backgroundColor: selected ? '#FFE0E0' : '#FFF',
                border: `2px solid ${selected ? '#D32F2F' : '#FFCDD2'}`,
              }}
            >
              {selected && (
                <div style={{
                  position: 'absolute',
                  top: -8, right: -8,
                  width: 26, height: 26,
                  borderRadius: '50%',
                  backgroundColor: '#D32F2F',
                  color: '#FFF',
                  fontSize: 14,
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #FFF',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                }}>{order}</div>
              )}
              {m.isCurrent && (
                <div style={{
                  position: 'absolute',
                  top: -8, left: -8,
                  fontSize: 9,
                  fontWeight: 'bold',
                  backgroundColor: '#FFB600',
                  color: '#FFF',
                  padding: '1px 6px',
                  borderRadius: 8,
                  border: '1.5px solid #FFF',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                  whiteSpace: 'nowrap',
                }}>そだてちゅう</div>
              )}
              <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {img ? (
                  <img
                    src={img}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.3)' }}
                    draggable={false}
                  />
                ) : <span style={{ fontSize: 36 }}>🌟</span>}
              </div>
              <div className="font-bold mt-1" style={{ fontSize: 12, color: '#D32F2F' }}>Lv {m.level}</div>
              <div style={{ fontSize: 9, color: '#888' }}>HP {stats.maxHp} / つよさ {stats.atk}</div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-2xl font-bold active:scale-95 transition-all"
          style={{ backgroundColor: '#F0F0F0', color: '#888' }}
        >
          もどる
        </button>
        <button
          onClick={onConfirm}
          disabled={!ready}
          className="flex-1 py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
          style={{
            background: ready ? 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)' : '#DDD',
            color: '#FFF',
            fontSize: 15,
          }}
        >
          {ready ? `つぎへ → (${partyIds.length}たい)` : `すくなくとも 1たい えらぼう`}
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 確認画面
// ============================================================

function ConfirmScreen({
  tier, partyMonsters, onBack, onStart,
}: {
  tier: DifficultyTier;
  partyMonsters: SelectableMonster[];
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div className="flex-1 px-4 flex flex-col items-center">
      <p className="text-sm mb-1" style={{ color: '#888' }}>このパーティで いどむよ</p>
      <p className="text-base font-bold mb-4" style={{ color: '#D32F2F' }}>{TIER_LABELS[tier]} クエスト</p>

      <div className="flex flex-wrap justify-center gap-1.5 w-full mb-6">
        {partyMonsters.map((m, i) => {
          const img = m.isCurrent
            ? getMonsterImage(m.species, (m.level - 1) as 0 | 1 | 2 | 3 | 4)
            : getMonsterFinalImage(m.species);
          return (
            <div key={m.id} className="rounded-xl p-1.5 text-center" style={{ backgroundColor: '#FFF', border: '2px solid #FF8A80', width: 'calc(20% - 6px)', minWidth: 56 }}>
              <div style={{ height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {img
                  ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scale(1.3)' }} draggable={false} />
                  : <span style={{ fontSize: 28 }}>🌟</span>}
              </div>
              <div style={{ fontSize: 10, color: '#888' }}>{i + 1}</div>
              <div className="font-bold" style={{ fontSize: 11, color: '#D32F2F' }}>Lv{m.level}</div>
            </div>
          );
        })}
      </div>

      <div className="text-center mb-6">
        <div style={{ fontSize: 11, color: '#888' }}>あいて</div>
        <div className="font-bold" style={{ fontSize: 18, color: '#D32F2F' }}>👹 デーモン</div>
        <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
          {TOTAL_STAGES}つの ウェーブを ぜんぶ かつと マーメイドのたまご!
        </div>
      </div>

      <div className="flex gap-2 w-full mt-auto">
        <button
          onClick={onBack}
          className="px-4 py-3 rounded-2xl font-bold active:scale-95 transition-all"
          style={{ backgroundColor: '#F0F0F0', color: '#888' }}
        >
          もどる
        </button>
        <button
          onClick={onStart}
          className="flex-1 py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
          style={{
            background: 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)',
            color: '#FFF',
            fontSize: 16,
          }}
        >
          ⚔️ たたかいだ！
        </button>
      </div>
    </div>
  );
}

// ============================================================
// 結果画面
// ============================================================

function ResultScreen({
  tier, result, hasEggForTier, canHatch, onHatch, onRetry, onClose,
}: {
  tier: DifficultyTier;
  result: { victory: boolean; stagesCleared: number };
  hasEggForTier: boolean;
  canHatch: boolean;
  onHatch: (tier: DifficultyTier) => boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const fullCleared = result.victory && result.stagesCleared >= TOTAL_STAGES;
  const [hatchedNow, setHatchedNow] = useState(false);
  const mermaidSpecies = MERMAID_BY_TIER[tier];
  const mermaidPreviewImg = getMonsterFinalImage(mermaidSpecies);
  const showEgg = fullCleared && hasEggForTier;

  // 参考：難度クリア時のデーモン情報（最終ステージ）
  const finalDemon = getDemonStats(tier, TOTAL_STAGES);

  return (
    <div className="flex-1 px-6 flex flex-col items-center justify-center text-center">
      {fullCleared ? (
        <>
          <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8 }}>🎉</div>
          <h2 className="text-2xl font-black mb-2" style={{ color: '#D32F2F' }}>
            クエスト クリア！
          </h2>
          <p className="text-sm mb-3" style={{ color: '#888' }}>
            {TIER_LABELS[tier]} を ぜんぶ クリア！<br />
            つぎの なんいどが あいたよ
          </p>
          {showEgg ? (
            <div className="rounded-2xl p-5 mb-5 w-full" style={{ backgroundColor: '#FFEBEE', border: '2px solid #FF8A80' }}>
              <div className="flex items-center justify-center gap-3 mb-1">
                <div style={{ fontSize: 48, lineHeight: 1 }}>🥚</div>
                {mermaidPreviewImg && (
                  <img
                    src={mermaidPreviewImg}
                    alt={mermaidSpecies}
                    style={{ width: 64, height: 64, objectFit: 'contain', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                    draggable={false}
                  />
                )}
              </div>
              <div className="font-bold mt-2" style={{ color: '#D32F2F', fontSize: 16 }}>
                {TIER_LABELS[tier]}クリアの マーメイドのたまご を てに いれた！
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                ({mermaidSpecies} の マーメイド)
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-3 mb-5 w-full" style={{ backgroundColor: '#FFF', border: '1px solid #FFCDD2' }}>
              <div style={{ fontSize: 12, color: '#888' }}>
                この なんいどの たまごは すでに もらいずみ
              </div>
            </div>
          )}
          {showEgg && !hatchedNow && canHatch && (
            <button
              onClick={() => { if (onHatch(tier)) setHatchedNow(true); }}
              className="w-full py-3 rounded-2xl font-bold mb-2 shadow-md active:scale-95 transition-all"
              style={{ background: 'linear-gradient(135deg, #FFB7C5 0%, #D32F2F 100%)', color: '#FFF', fontSize: 15 }}
            >
              🥚 いますぐ かえす
            </button>
          )}
          {showEgg && !hatchedNow && !canHatch && (
            <div className="rounded-xl p-2 mb-2 w-full" style={{ backgroundColor: '#FFF8E1', color: '#8B6000', fontSize: 12 }}>
              いま そだてている モンスターが おとなに なったら かえせるよ
            </div>
          )}
          {hatchedNow && (
            <div className="rounded-xl p-3 mb-2 w-full" style={{ backgroundColor: '#F0FAE8', color: '#4A8F2A', fontSize: 13 }}>
              ✨ マーメイドの タマゴを かえしたよ！ホームで そだてよう
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>💔</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#666' }}>
            まけちゃった…
          </h2>
          <p className="text-sm mb-4" style={{ color: '#888' }}>
            {result.stagesCleared} / {TOTAL_STAGES} ウェーブまで クリア<br />
            もっと つよい モンスターを そだてよう！
          </p>
          <div className="rounded-2xl p-3 mb-5 w-full" style={{ backgroundColor: '#FFF', border: '1px solid #FFCDD2' }}>
            <div style={{ fontSize: 11, color: '#888' }}>さいしゅう ウェーブ デーモン</div>
            <div className="font-bold" style={{ fontSize: 14, color: '#D32F2F' }}>
              Lv{finalDemon.level} ／ HP {finalDemon.maxHp} ／ つよさ {finalDemon.atk}
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 w-full mt-auto pb-4">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-2xl font-bold active:scale-95 transition-all"
          style={{ backgroundColor: '#F0F0F0', color: '#888' }}
        >
          ホームへ
        </button>
        <button
          onClick={onRetry}
          className="flex-1 py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #FF8A80 0%, #D32F2F 100%)', color: '#FFF', fontSize: 15 }}
        >
          もう いっかい
        </button>
      </div>
    </div>
  );
}
