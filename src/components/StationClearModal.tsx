import { useState } from 'react';

export function StationClearModal({ station, onClose }: { station: { num: number; name: string }; onClose: () => void }) {
  const petals = useState(() =>
    Array.from({ length: 30 }, (_, i) => {
      const angle = (i / 30) * 360 + Math.random() * 12;
      const dist = 90 + Math.random() * 170;
      const rad = (angle * Math.PI) / 180;
      return {
        id: i,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        delay: Math.random() * 0.4,
        scale: 0.8 + Math.random() * 0.9,
      };
    })
  )[0];

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ zIndex: 300 }}
      onClick={onClose}
    >
      {/* 背景（暗赤系のグラデーション・記憶ザクラの桜画像は削除） */}
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at center, #5C0E0E 0%, #1a0505 80%)',
          zIndex: 0,
        }}
      />

      {/* 星（背景と文言の間） */}
      {petals.map(p => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            fontSize: `${18 * p.scale}px`,
            animation: `firework-petal 2s ease-out ${p.delay}s forwards`,
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            zIndex: 6,
            pointerEvents: 'none',
          } as React.CSSProperties}
        >
          🌟
        </div>
      ))}

      {/* 文言 */}
      <div
        style={{
          position: 'relative',
          zIndex: 11,
          textAlign: 'center',
          animation: 'clear-text-pop 0.6s ease-out 0.2s both',
        }}
      >
        <p
          style={{
            fontSize: 22,
            fontWeight: 'bold',
            color: '#FFF',
            textShadow: '-2px -2px 0 #535353, 2px -2px 0 #535353, -2px 2px 0 #535353, 2px 2px 0 #535353, 0 3px 8px rgba(0,0,0,0.7)',
            marginBottom: 8,
          }}
        >
          ステージ{station.num}
        </p>
        <p
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: '#FFD700',
            textShadow: '-2px -2px 0 #d48700, 2px -2px 0 #d48700, -2px 2px 0 #d48700, 2px 2px 0 #d48700, 0 4px 16px rgba(0,0,0,0.6)',
            lineHeight: 1.1,
          }}
        >
          クリア！！
        </p>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 32, textShadow: '-1px -1px 0 #535353, 1px -1px 0 #535353, -1px 1px 0 #535353, 1px 1px 0 #535353' }}>
          タップして とじる
        </p>
      </div>
    </div>
  );
}
