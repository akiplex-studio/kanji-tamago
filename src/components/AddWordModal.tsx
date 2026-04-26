import { useState } from 'react';

type Props = {
  onClose: () => void;
  onAdd: (w: { back: string; front: string; example_en?: string; example_ja?: string }) => void;
};

export function AddWordModal({ onClose, onAdd }: Props) {
  const [addBack, setAddBack] = useState('');
  const [addFront, setAddFront] = useState('');
  const [addExEn, setAddExEn] = useState('');
  const [addExJa, setAddExJa] = useState('');

  function handleSave() {
    if (!addBack.trim() || !addFront.trim()) return;
    onAdd({
      back: addBack.trim(),
      front: addFront.trim(),
      example_en: addExEn.trim() || undefined,
      example_ja: addExJa.trim() || undefined,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 flex items-end justify-center"
      style={{ zIndex: 120, backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6 pb-10"
        style={{ backgroundColor: '#FFF', maxWidth: 480 }}
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-base font-bold mb-4" style={{ color: '#333' }}>かんじを ついか</h3>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#888' }}>かんじ *</label>
            <input
              value={addFront}
              onChange={e => setAddFront(e.target.value)}
              placeholder="例: 花"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid #FFD8D8', backgroundColor: '#FFF9F0', outline: 'none' }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#888' }}>よみかた *</label>
            <input
              value={addBack}
              onChange={e => setAddBack(e.target.value)}
              placeholder="例: はな"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid #FFD8D8', backgroundColor: '#FFF9F0', outline: 'none' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#AAA' }}>れいぶん・かんじ（にんいです）</label>
            <input
              value={addExJa}
              onChange={e => setAddExJa(e.target.value)}
              placeholder="例: にわに 花が さく。"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid #FFD8D8', backgroundColor: '#FFF9F0', outline: 'none' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: '#AAA' }}>れいぶん・よみかた（にんいです）</label>
            <input
              value={addExEn}
              onChange={e => setAddExEn(e.target.value)}
              placeholder="例: にわに はなが さく。"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ border: '1px solid #FFD8D8', backgroundColor: '#FFF9F0', outline: 'none' }}
            />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-2xl font-medium text-sm active:scale-95 transition-all"
            style={{ backgroundColor: '#F0F0F0', color: '#888' }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!addBack.trim() || !addFront.trim()}
            className="flex-1 py-3 rounded-2xl font-medium text-sm text-white active:scale-95 transition-all"
            style={{
              backgroundColor: addBack.trim() && addFront.trim() ? '#FF8A80' : '#DDD',
            }}
          >
            ついかする
          </button>
        </div>
      </div>
    </div>
  );
}
