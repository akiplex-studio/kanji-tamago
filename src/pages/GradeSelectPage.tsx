import type { Grade } from '../store/wordStore';

type Props = {
  current?: Grade | null;
  onSelect: (grade: Grade) => void;
  onBack?: () => void;
  title?: string;
};

const GRADES: { grade: Grade; label: string; count: number }[] = [
  { grade: 1, label: 'しょうがく1ねんせい', count: 80 },
  { grade: 2, label: 'しょうがく2ねんせい', count: 160 },
  { grade: 3, label: 'しょうがく3ねんせい', count: 200 },
  { grade: 4, label: 'しょうがく4ねんせい', count: 202 },
  { grade: 5, label: 'しょうがく5ねんせい', count: 193 },
  { grade: 6, label: 'しょうがく6ねんせい', count: 191 },
];

export default function GradeSelectPage({ current, onSelect, onBack, title = 'がくねんを えらんでね' }: Props) {
  return (
    <div
      className="flex flex-col"
      style={{ minHeight: '100svh', backgroundColor: '#FFF9F0' }}
    >
      <div className="px-4 pt-8 pb-4 flex items-center">
        {onBack ? (
          <button onClick={onBack} className="text-sm" style={{ color: '#888' }}>← もどる</button>
        ) : (
          <div className="w-12" />
        )}
        <h1 className="text-xl font-bold flex-1 text-center" style={{ color: '#333' }}>
          🥚 {title}
        </h1>
        <div className="w-12" />
      </div>

      <div className="px-4 pb-6">
        <p className="text-sm text-center" style={{ color: '#888', lineHeight: 1.7 }}>
          えらんだ がくねんの かんじを{'\n'}ステージに わけて がくしゅうするよ。
        </p>
      </div>

      <div className="flex-1 px-4 pb-8 flex flex-col gap-2">
        {GRADES.map(({ grade, label, count }) => {
          const selected = current === grade;
          return (
            <button
              key={grade}
              onClick={() => onSelect(grade)}
              className="w-full rounded-2xl py-4 px-5 text-left active:scale-95 transition-all"
              style={{
                backgroundColor: selected ? '#FF8A80' : '#FFF',
                border: selected ? '2px solid #D32F2F' : '2px solid #FFE0E6',
                color: selected ? '#FFF' : '#333',
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold" style={{ fontSize: 16 }}>{label}</div>
                  <div style={{ fontSize: 12, color: selected ? 'rgba(255,255,255,0.9)' : '#AAA', marginTop: 2 }}>
                    {count}じ
                  </div>
                </div>
                {selected && <span style={{ fontSize: 22 }}>✓</span>}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-center pb-6 px-4" style={{ fontSize: 11, color: '#BBB' }}>
        あとで せっていから へんこうできるよ
      </p>
    </div>
  );
}
