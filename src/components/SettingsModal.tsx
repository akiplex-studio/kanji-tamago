import { useState } from 'react';
import type { Grade } from '../store/wordStore';

const GRADE_LABELS: Record<Grade, string> = {
  1: 'しょうがく1ねんせい',
  2: 'しょうがく2ねんせい',
  3: 'しょうがく3ねんせい',
  4: 'しょうがく4ねんせい',
  5: 'しょうがく5ねんせい',
  6: 'しょうがく6ねんせい',
};

export function SettingsModal({
  onClose,
  onExport,
  onImport,
  onRestartTutorial,
  onOpenConversationList,
  onOpenAppInfo,
  onChangeGrade,
  grade,
}: {
  onClose: () => void;
  onExport: () => string;
  onImport: (json: string) => { imported: number; error?: string };
  onRestartTutorial: () => void;
  onOpenConversationList: () => void;
  onOpenAppInfo: () => void;
  onChangeGrade: () => void;
  grade: Grade;
}) {
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  function handleExport() {
    const json = onExport();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kanji-tamago-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage({ text: 'バックアップを かきだしたよ', ok: true });
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = onImport(reader.result as string);
      if (result.error) {
        setMessage({ text: result.error, ok: false });
      } else {
        setMessage({ text: `${result.imported}この しんちょくを よみこんだよ`, ok: true });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ zIndex: 100, backgroundColor: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-3xl shadow-lg p-6"
        style={{ backgroundColor: '#FFF', maxWidth: 340 }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold mb-1" style={{ color: '#333' }}>せってい</h2>
        <p className="text-xs mb-4" style={{ color: '#AAA' }}>しんちょくの バックアップ・ふっかつ</p>

        <button
          onClick={onChangeGrade}
          className="w-full py-2.5 rounded-2xl font-medium text-sm text-left px-4 active:scale-95 transition-all mb-4"
          style={{ backgroundColor: '#FFEBEE', color: '#D32F2F', border: '1px solid #FF8A80' }}
        >
          <span>🎒 がくねん：</span>
          <span className="font-bold">{GRADE_LABELS[grade]}</span>
          <span style={{ color: '#AAA', fontSize: 11, marginLeft: 6 }}>（タップで かえる）</span>
        </button>

        <div className="flex flex-col gap-3 mb-5">
          <button
            onClick={handleExport}
            className="w-full py-3 rounded-2xl font-medium text-sm active:scale-95 transition-all"
            style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
          >
            📤 バックアップを かきだす
          </button>
          <label
            className="w-full py-3 rounded-2xl font-medium text-sm text-center cursor-pointer active:scale-95 transition-all"
            style={{ backgroundColor: '#A0CA5A', color: '#FFF', display: 'block' }}
          >
            📥 バックアップを よみこむ
            <input type="file" accept=".json" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        {message && (
          <p
            className="text-center text-sm mb-4 rounded-xl py-2"
            style={{ color: message.ok ? '#4A8F2A' : '#E05050', backgroundColor: message.ok ? '#F0FAE8' : '#FFF0F0' }}
          >
            {message.ok ? '✅ ' : '❌ '}{message.text}
          </p>
        )}

        <button
          onClick={onRestartTutorial}
          className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all mb-2"
          style={{ backgroundColor: '#FFEBEE', color: '#D32F2F', border: '1px solid #FF8A80' }}
        >
          🥚 チュートリアルを もういちど みる
        </button>
        <button
          onClick={onOpenConversationList}
          className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all mb-2"
          style={{ backgroundColor: '#FFEBEE', color: '#D32F2F', border: '1px solid #FF8A80' }}
        >
          📖 モンスターとの かいわリスト
        </button>

        <button
          onClick={onOpenAppInfo}
          className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all mb-2"
          style={{ backgroundColor: '#F5F5F5', color: '#888', border: '1px solid #E8E8E8' }}
        >
          📋 プライバシー・クレジット・おといあわせ
        </button>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
          style={{ backgroundColor: '#F0F0F0', color: '#888' }}
        >
          とじる
        </button>
      </div>
    </div>
  );
}
