import { useState, useEffect, useRef } from 'react';
import { getMonsterCombatStats } from '../utils/monsterState';
import { getMonsterFinalImage, getMonsterImage } from '../utils/monsterImages';
import {
  getDemonStats, TIER_LABELS, TOTAL_STAGES,
  type DifficultyTier,
} from '../utils/questState';
import { playHit, playBuzzer, playFanfare } from '../utils/sound';

/** クエストに参加できるモンスターの最小情報 */
export type BattlePartyInput = {
  id: string;
  species: string;
  level: number;
  isCurrent?: boolean;
};

type Props = {
  tier: DifficultyTier;
  partyMonsters: BattlePartyInput[];
  onEnd: (victory: boolean, wavesCleared: number) => void;
};

type PartyMember = {
  id: string;
  species: string;
  level: number;
  isCurrent: boolean;
  maxHp: number;
  hp: number;
  atk: number;
};

type DamagePop = { id: number; value: number; targetSide: 'player' | 'demon'; targetIdx: number };

let damageIdSeq = 0;

function rollDamage(atk: number): number {
  return Math.max(1, Math.floor(atk * (0.9 + 0.2 * Math.random())));
}

// ウェーブ別デーモン見た目
const DEMON_EMOJIS = ['👹', '👺', '🦂', '🐲', '💀'];
// 難度別カラーフィルタ（hue-rotate で色違い）
const TIER_FILTERS: Record<DifficultyTier, string> = {
  beginner: '',
  intermediate: 'hue-rotate(140deg) saturate(1.1)',
  advanced: 'hue-rotate(240deg) saturate(1.2)',
  super: 'hue-rotate(60deg) saturate(1.4) brightness(0.9)',
};

// バトル進行のテンポ（速度を約2倍に）
const ATTACK_MOTION_MS = 150;     // 攻撃モーション
const DAMAGE_DISPLAY_MS = 400;    // ダメージ表示〜次のアクションまで（ゲーム進行）
const DAMAGE_VISIBLE_MS = 1200;   // ダメージ数値が画面に残る時間（視認性のため進行とは独立）
const DEFEAT_DISPLAY_MS = 700;    // 「げきは！」表示時間
const WAVE_CLEAR_DELAY = 800;     // クリア演出
const FINISH_DELAY = 800;         // 結果画面遷移
const INTRO_DELAY = 500;          // ウェーブ開始バナー → 攻撃開始
const HANDOFF_DELAY = 100;        // ターン引き継ぎ間（プレイヤー↔デーモン）

export default function BattleScene({ tier, partyMonsters, onEnd }: Props) {
  const [party, setParty] = useState<PartyMember[]>(() =>
    partyMonsters.map(m => {
      const s = getMonsterCombatStats(m.level);
      return {
        id: m.id, species: m.species, level: m.level,
        isCurrent: !!m.isCurrent,
        maxHp: s.maxHp, hp: s.maxHp, atk: s.atk,
      };
    })
  );
  const [waveNum, setWaveNum] = useState(1);
  const [demonHp, setDemonHp] = useState(() => getDemonStats(tier, 1).maxHp);
  const [demonMaxHp, setDemonMaxHp] = useState(() => getDemonStats(tier, 1).maxHp);
  const [demonAtk, setDemonAtk] = useState(() => getDemonStats(tier, 1).atk);
  const [demonLevel, setDemonLevel] = useState(() => getDemonStats(tier, 1).level);

  type Phase = 'intro' | 'player-turn' | 'demon-attack' | 'demon-defeated' | 'wave-cleared' | 'finished';
  const [phase, setPhase] = useState<Phase>('intro');
  // プレイヤーターン中：これから攻撃する生存メンバーのインデックス列
  const [playerQueue, setPlayerQueue] = useState<number[]>([]);
  const [activeAttackerIdx, setActiveAttackerIdx] = useState<number | null>(null);
  const [demonAttacking, setDemonAttacking] = useState(false);
  const [damages, setDamages] = useState<DamagePop[]>([]);
  const [waveBanner, setWaveBanner] = useState<{ wave: number; id: number } | null>(null);
  const [showDefeat, setShowDefeat] = useState(false);

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  function timer(fn: () => void, ms: number) {
    const t = setTimeout(fn, ms);
    timersRef.current.push(t);
    return t;
  }
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; }, []);

  // タイマー内から最新値を参照するための ref（依存配列に入れずに最新値を読む）
  const partyRef = useRef(party);
  const demonHpRef = useRef(demonHp);
  const demonAtkRef = useRef(demonAtk);
  const waveNumRef = useRef(waveNum);
  useEffect(() => { partyRef.current = party; }, [party]);
  useEffect(() => { demonHpRef.current = demonHp; }, [demonHp]);
  useEffect(() => { demonAtkRef.current = demonAtk; }, [demonAtk]);
  useEffect(() => { waveNumRef.current = waveNum; }, [waveNum]);

  function spawnDamage(value: number, targetSide: 'player' | 'demon', targetIdx: number) {
    const id = ++damageIdSeq;
    setDamages(prev => [...prev, { id, value, targetSide, targetIdx }]);
    timer(() => setDamages(prev => prev.filter(d => d.id !== id)), DAMAGE_VISIBLE_MS);
  }

  // ============================================================
  // ウェーブ開始：intro → player-turn
  // ============================================================
  useEffect(() => {
    if (phase !== 'intro') return;
    setWaveBanner({ wave: waveNumRef.current, id: Date.now() });
    timer(() => setWaveBanner(null), 700);
    timer(() => {
      const p = partyRef.current;
      const aliveIndexes = p.map((m, i) => (m.hp > 0 ? i : -1)).filter(i => i >= 0);
      if (aliveIndexes.length === 0) {
        setPhase('finished');
        timer(() => onEnd(false, waveNumRef.current - 1), FINISH_DELAY);
        return;
      }
      setPlayerQueue(aliveIndexes);
      setPhase('player-turn');
    }, INTRO_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ============================================================
  // プレイヤーターン：キューから順番に1人ずつ攻撃
  // 依存は phase + playerQueue のみ。party/demonHp は ref 経由で読み、
  // 攻撃中の setDemonHp() で再発火しないようにする
  // ============================================================
  useEffect(() => {
    if (phase !== 'player-turn') return;
    if (playerQueue.length === 0) {
      setActiveAttackerIdx(null);
      timer(() => setPhase('demon-attack'), HANDOFF_DELAY);
      return;
    }
    const idx = playerQueue[0];
    const currentParty = partyRef.current;
    if (currentParty[idx].hp <= 0) {
      setPlayerQueue(q => q.slice(1));
      return;
    }
    setActiveAttackerIdx(idx);
    timer(() => {
      const attacker = partyRef.current[idx];
      const dmg = rollDamage(attacker.atk);
      const newDemonHp = Math.max(0, demonHpRef.current - dmg);
      setDemonHp(newDemonHp);
      spawnDamage(dmg, 'demon', 0);
      playHit();

      timer(() => {
        if (newDemonHp <= 0) {
          setActiveAttackerIdx(null);
          setPhase('demon-defeated');
        } else {
          setActiveAttackerIdx(null);
          setPlayerQueue(q => q.slice(1));
        }
      }, DAMAGE_DISPLAY_MS);
    }, ATTACK_MOTION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, playerQueue]);

  // ============================================================
  // デーモン撃破演出
  // ============================================================
  useEffect(() => {
    if (phase !== 'demon-defeated') return;
    setShowDefeat(true);
    playFanfare();
    timer(() => {
      setShowDefeat(false);
      setPhase('wave-cleared');
    }, DEFEAT_DISPLAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ============================================================
  // ウェーブクリア → 次へ
  // ============================================================
  useEffect(() => {
    if (phase !== 'wave-cleared') return;
    timer(() => {
      if (waveNum >= TOTAL_STAGES) {
        setPhase('finished');
        timer(() => onEnd(true, TOTAL_STAGES), FINISH_DELAY);
      } else {
        const next = waveNum + 1;
        const ds = getDemonStats(tier, next);
        setWaveNum(next);
        setDemonMaxHp(ds.maxHp);
        setDemonHp(ds.maxHp);
        setDemonAtk(ds.atk);
        setDemonLevel(ds.level);
        setPhase('intro');
      }
    }, WAVE_CLEAR_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, waveNum, tier]);

  // ============================================================
  // デーモン反撃（依存は phase のみ。party 等は ref 経由で読む）
  // 戦略：生存者の中で「もっとも弱い（現HPが低い→同HPならLvが低い）」を狙う
  // ============================================================
  function pickWeakestTarget(p: PartyMember[]): number {
    let best = -1;
    for (let i = 0; i < p.length; i++) {
      if (p[i].hp <= 0) continue;
      if (best === -1) { best = i; continue; }
      const cur = p[best], cand = p[i];
      if (cand.hp < cur.hp || (cand.hp === cur.hp && cand.level < cur.level)) {
        best = i;
      }
    }
    return best;
  }

  useEffect(() => {
    if (phase !== 'demon-attack') return;
    const initialAlive = pickWeakestTarget(partyRef.current);
    if (initialAlive === -1) {
      setPhase('finished');
      timer(() => onEnd(false, waveNumRef.current - 1), FINISH_DELAY);
      return;
    }
    setDemonAttacking(true);
    timer(() => {
      const dmg = rollDamage(demonAtkRef.current);
      const p = partyRef.current;
      const targetIdx = pickWeakestTarget(p);
      if (targetIdx === -1) {
        setDemonAttacking(false);
        setPhase('finished');
        timer(() => onEnd(false, waveNumRef.current - 1), FINISH_DELAY);
        return;
      }
      const newHp = Math.max(0, p[targetIdx].hp - dmg);
      setParty(prev => prev.map((m, i) => i === targetIdx ? { ...m, hp: newHp } : m));
      spawnDamage(dmg, 'player', targetIdx);
      playBuzzer();
      timer(() => {
        setDemonAttacking(false);
        timer(() => {
          const latest = partyRef.current;
          const alive = latest.map((m, i) => (m.hp > 0 ? i : -1)).filter(i => i >= 0);
          if (alive.length === 0) {
            setPhase('finished');
            timer(() => onEnd(false, waveNumRef.current - 1), FINISH_DELAY);
            return;
          }
          setPlayerQueue(alive);
          setPhase('player-turn');
        }, HANDOFF_DELAY);
      }, DAMAGE_DISPLAY_MS);
    }, ATTACK_MOTION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ============================================================
  // 描画
  // ============================================================

  const monsterSize = 64;
  const demonEmoji = DEMON_EMOJIS[(waveNum - 1) % DEMON_EMOJIS.length];
  const demonFilter = TIER_FILTERS[tier];

  return (
    <div className="flex-1 flex flex-col px-3 pt-2 pb-4" style={{ minHeight: '100svh', background: 'linear-gradient(180deg, #FFE0E0 0%, #FFF9F0 100%)' }}>
      {/* 上部バナー */}
      <div className="text-center mb-2">
        <div style={{ fontSize: 11, color: '#888' }}>{TIER_LABELS[tier]}</div>
        <div className="font-bold" style={{ fontSize: 16, color: '#D32F2F' }}>ウェーブ {waveNum} / {TOTAL_STAGES}</div>
      </div>

      <div style={{ position: 'relative', flex: 1, minHeight: 380 }}>
        {/* プレイヤー側（左、縦並び・詰め気味） */}
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: '46%',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          gap: 4,
          paddingLeft: 4,
        }}>
          {party.map((m, idx) => {
            const img = m.isCurrent
              ? getMonsterImage(m.species, (m.level - 1) as 0 | 1 | 2 | 3 | 4)
              : getMonsterFinalImage(m.species);
            const fainted = m.hp <= 0;
            const isActive = activeAttackerIdx === idx;
            const isHit = damages.some(d => d.targetSide === 'player' && d.targetIdx === idx);
            const dmgPop = damages.find(d => d.targetSide === 'player' && d.targetIdx === idx);
            return (
              <div key={m.id} style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                opacity: fainted ? 0.35 : 1,
                animation: isActive ? 'attack-lunge-right 0.5s ease-in-out' : isHit ? 'hit-shake 0.3s ease-in-out' : undefined,
              }}>
                <div style={{
                  width: monsterSize, height: monsterSize,
                  flexShrink: 0, position: 'relative',
                  filter: isActive
                    ? 'drop-shadow(0 0 8px #FFB600) drop-shadow(0 2px 3px rgba(0,0,0,0.3))'
                    : 'drop-shadow(0 2px 3px rgba(0,0,0,0.25))',
                }}>
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      draggable={false}
                      style={{
                        width: '100%', height: '100%',
                        objectFit: 'contain',
                        transform: 'scaleX(-1) scale(1.3)',
                        transformOrigin: 'center 60%',
                        filter: fainted ? 'grayscale(1)' : undefined,
                      }}
                    />
                  ) : <span style={{ fontSize: monsterSize * 0.7 }}>🌟</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 9, color: '#FFF', fontWeight: 'bold', textShadow: '1px 1px 0 #333', lineHeight: 1 }}>
                    Lv{m.level} HP {m.hp}/{m.maxHp}
                  </div>
                  <div style={{ width: '100%', height: 6, backgroundColor: '#000', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.5)', marginTop: 1 }}>
                    <div style={{
                      width: `${(m.hp / m.maxHp) * 100}%`,
                      height: '100%',
                      background: m.hp / m.maxHp > 0.5
                        ? 'linear-gradient(90deg, #7ED957 0%, #2EA043 100%)'
                        : m.hp / m.maxHp > 0.2 ? '#FFB600' : '#D32F2F',
                      transition: 'width 0.3s ease-out',
                    }} />
                  </div>
                </div>
                {dmgPop && (
                  <div style={{
                    position: 'absolute',
                    // HPゲージ（モンスターの右側、行の右半分）の上あたりに配置
                    left: '70%',
                    top: '50%',
                    transform: 'translate(-50%, -120%)',
                    fontSize: 24,
                    fontWeight: 900,
                    color: '#FF3030',
                    textShadow: '2px 2px 0 #FFF, -2px -2px 0 #FFF, 2px -2px 0 #FFF, -2px 2px 0 #FFF, 0 4px 8px rgba(0,0,0,0.4)',
                    pointerEvents: 'none',
                    animation: `damage-pop ${DAMAGE_VISIBLE_MS / 1000}s ease-out forwards`,
                    zIndex: 12,
                  }}>{dmgPop.value}</div>
                )}
                {fainted && (
                  <div style={{ position: 'absolute', left: monsterSize / 2, top: '50%', transform: 'translate(-50%, -50%)', fontSize: 28, pointerEvents: 'none' }}>💔</div>
                )}
              </div>
            );
          })}
        </div>

        {/* デーモン側（右、ウェーブごとに見た目変わる） */}
        <div style={{
          position: 'absolute',
          right: 0, top: 0, bottom: 0,
          width: '50%',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center',
          paddingRight: 4,
        }}>
          <div style={{
            position: 'relative',
            width: 140, height: 140,
            textAlign: 'center',
            // 撃破後 → ウェーブクリア中もデーモンを消したまま、復活して見えないように
            opacity: (phase === 'demon-defeated' || phase === 'wave-cleared') ? 0 : 1,
            transition: 'opacity 0.5s ease-out',
            animation: phase === 'intro'
              ? 'demon-spawn 0.5s ease-out forwards'
              : demonAttacking
                ? 'attack-lunge-left 0.5s ease-in-out'
                : damages.some(d => d.targetSide === 'demon')
                  ? 'hit-shake 0.3s ease-in-out'
                  : undefined,
          }}>
            <div style={{
              fontSize: 110,
              lineHeight: 1,
              filter: `${demonFilter} drop-shadow(0 4px 6px rgba(0,0,0,0.3))`,
            }}>{demonEmoji}</div>
            <div style={{ marginTop: 6, padding: '0 4px' }}>
              <div style={{ fontSize: 11, color: '#FFF', fontWeight: 'bold', textShadow: '1px 1px 0 #333', lineHeight: 1.1 }}>
                Lv{demonLevel}
              </div>
              <div style={{ fontSize: 10, color: '#FFF', fontWeight: 'bold', textShadow: '1px 1px 0 #333', lineHeight: 1.2, marginTop: 1 }}>
                HP {demonHp}/{demonMaxHp}
              </div>
              <div style={{ width: '100%', height: 8, backgroundColor: '#000', borderRadius: 4, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.5)', marginTop: 2 }}>
                <div style={{
                  width: `${(demonHp / demonMaxHp) * 100}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #FF6B6B 0%, #C71010 100%)',
                  transition: 'width 0.3s ease-out',
                }} />
              </div>
            </div>
            {damages.filter(d => d.targetSide === 'demon').map(d => (
              <div key={d.id} style={{
                position: 'absolute',
                // デーモンスプライト直下、HPバーの上あたり
                left: '50%',
                top: '78%',
                transform: 'translate(-50%, -50%)',
                fontSize: 36,
                fontWeight: 900,
                color: '#FFB600',
                textShadow: '2px 2px 0 #FFF, -2px -2px 0 #FFF, 2px -2px 0 #FFF, -2px 2px 0 #FFF, 0 4px 8px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
                animation: `damage-pop ${DAMAGE_VISIBLE_MS / 1000}s ease-out forwards`,
                zIndex: 12,
              }}>{d.value}</div>
            ))}
          </div>
        </div>

        {/* ウェーブ開始バナー */}
        {waveBanner && (
          <div
            key={`wb-${waveBanner.id}`}
            style={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: 32,
              fontWeight: 900,
              color: '#FFF',
              textShadow: '0 0 8px #D32F2F, 3px 3px 0 #D32F2F, -3px -3px 0 #D32F2F, 3px -3px 0 #D32F2F, -3px 3px 0 #D32F2F',
              animation: 'levelup-title 1.3s ease-out forwards',
              zIndex: 15,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            ウェーブ {waveBanner.wave}
          </div>
        )}

        {/* 撃破！演出 */}
        {showDefeat && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 48,
            fontWeight: 900,
            color: '#FFB600',
            textShadow: '0 0 10px #FFF, 0 0 20px #FFB600, 4px 4px 0 #D32F2F, -4px -4px 0 #D32F2F, 4px -4px 0 #D32F2F, -4px 4px 0 #D32F2F',
            animation: 'levelup-title 1.3s ease-out forwards',
            zIndex: 16,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            letterSpacing: '-1px',
          }}>
            💥 げきは！ 💥
          </div>
        )}

        {/* ウェーブクリア表示 */}
        {phase === 'wave-cleared' && waveNum < TOTAL_STAGES && (
          <div style={{
            position: 'absolute',
            top: '40%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 36,
            fontWeight: 900,
            color: '#FFB600',
            textShadow: '0 0 8px #FFF, 3px 3px 0 #D32F2F, -3px -3px 0 #D32F2F, 3px -3px 0 #D32F2F, -3px 3px 0 #D32F2F',
            animation: 'levelup-title 1.5s ease-out forwards',
            zIndex: 15,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            ウェーブ {waveNum} クリア！
          </div>
        )}
      </div>
    </div>
  );
}
