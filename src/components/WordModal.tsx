import type { Word } from '../types/word';
import { STATUS_COLORS, STATUS_LABELS, formatNextReview } from '../utils/reviewSchedule';

export function WordModal({ word, onClose, onToggleStar, onDelete, prevId, nextId, onNavigate }: {
  word: Word; onClose: () => void; onToggleStar: (id: string) => void;
  onDelete?: (id: string) => void;
  prevId?: string | null; nextId?: string | null; onNavigate?: (id: string) => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-2"
      style={{ zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div className="flex items-center gap-1 w-full" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        {/* 前へ */}
        <button
          onClick={() => prevId && onNavigate?.(prevId)}
          disabled={!prevId}
          className="flex-shrink-0 flex items-center justify-center rounded-2xl active:scale-95 transition-all"
          style={{
            width: 28, height: 48,
            backgroundColor: !prevId ? 'transparent' : '#FFF',
            border: `1px solid ${!prevId ? 'transparent' : '#FFC8C8'}`,
            color: !prevId ? 'transparent' : '#FF8A80',
            fontSize: 22,
          }}
        >‹</button>
      <div
        className="flex-1 rounded-3xl shadow-lg p-6 text-center"
        style={{ backgroundColor: '#FFF' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-end mb-1">
          <button
            onClick={() => onToggleStar(word.id)}
            className="text-2xl active:scale-95 transition-all"
            style={{ color: word.starred ? '#FFB600' : '#DDD' }}
          >
            {word.starred ? '★' : '☆'}
          </button>
        </div>
        <div className="text-3xl font-bold mb-1" style={{ color: '#333' }}>
          {word.front}
        </div>
        <div className="text-2xl font-bold mb-1" style={{ color: '#E55757' }}>
          {word.back}
        </div>
        <div className="text-sm mb-3" style={{ color: '#AAA' }}>
          {word.isCustom
            ? <span style={{ color: '#FF8A80', fontWeight: 600 }}>✏️ じぶんの ことば</span>
            : <>No.{word.id} · ステージ{word.station}</>
          }
        </div>
        {word.note && (
          <div
            className="rounded-xl p-3 text-left mb-4"
            style={{ backgroundColor: '#FFF8E8', border: '1px solid #F0DDB0' }}
          >
            <p className="text-xs" style={{ color: '#888' }}>{word.note}</p>
          </div>
        )}
        {word.memo && (
          <div
            className="rounded-xl p-3 text-left mb-4"
            style={{ backgroundColor: '#F0F8FF', border: '1px solid #B0D4F0' }}
          >
            <p className="text-xs font-medium mb-0.5" style={{ color: '#5B9BD5' }}>メモ</p>
            <p className="text-sm whitespace-pre-wrap" style={{ color: '#555' }}>{word.memo}</p>
          </div>
        )}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[word.status] }} />
          <span className="text-sm font-medium" style={{ color: STATUS_COLORS[word.status] }}>
            {STATUS_LABELS[word.status]}
          </span>
          <span className="text-xs" style={{ color: '#AAA' }}>
            {word.nextReviewAt === Number.MAX_SAFE_INTEGER ? '' : `／つぎ: ${formatNextReview(word.nextReviewAt)}`}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-8 py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
          style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
        >
          とじる
        </button>
        {word.isCustom && onDelete && (
          <button
            onClick={() => { onDelete(word.id); onClose(); }}
            className="mt-3 px-6 py-2 rounded-2xl font-medium text-sm active:scale-95 transition-all"
            style={{ backgroundColor: '#FFF0F0', color: '#E88', border: '1px solid #F0C0C0' }}
          >
            🗑️ この ことばを けす
          </button>
        )}
      </div>
        {/* 次へ */}
        <button
          onClick={() => nextId && onNavigate?.(nextId)}
          disabled={!nextId}
          className="flex-shrink-0 flex items-center justify-center rounded-2xl active:scale-95 transition-all"
          style={{
            width: 28, height: 48,
            backgroundColor: !nextId ? 'transparent' : '#FFF',
            border: `1px solid ${!nextId ? 'transparent' : '#FFC8C8'}`,
            color: !nextId ? 'transparent' : '#FF8A80',
            fontSize: 22,
          }}
        >›</button>
      </div>
    </div>
  );
}
