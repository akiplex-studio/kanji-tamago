import { useState } from 'react';

type Tab = 'privacy' | 'credits' | 'contact';

export function AppInfoModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('privacy');

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-4"
      style={{ zIndex: 110, backgroundColor: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-3xl shadow-lg flex flex-col"
        style={{ backgroundColor: '#FFF', maxWidth: 340, maxHeight: '80vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold" style={{ color: '#333' }}>アプリの じょうほう</h2>
        </div>

        {/* タブ */}
        <div className="flex px-4 gap-1 mb-3">
          {([
            { id: 'privacy', label: 'プライバシー' },
            { id: 'credits', label: 'クレジット' },
            { id: 'contact', label: 'おといあわせ' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: tab === t.id ? '#FF8A80' : '#F5F5F5',
                color: tab === t.id ? '#FFF' : '#888',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 text-sm" style={{ color: '#444', lineHeight: 1.7 }}>
          {tab === 'privacy' && (
            <div>
              <p className="font-bold mb-2" style={{ color: '#D32F2F' }}>プライバシーポリシー</p>
              <p className="mb-3">
                漢字タマゴ（以下「本アプリ」）は、ユーザーのプライバシーを尊重し、個人情報の保護に努めます。
              </p>
              <p className="font-semibold mb-1">収集する情報</p>
              <p className="mb-3">
                本アプリは、いかなる個人情報も収集・送信しません。
                学習進捗・設定データはすべてお使いの端末内（ブラウザの localStorage）にのみ保存されます。
                外部サーバーへのデータ送信は一切行いません。
              </p>
              <p className="font-semibold mb-1">第三者への提供</p>
              <p className="mb-3">
                ユーザーデータを第三者に提供・販売・共有することはありません。
              </p>
              <p className="font-semibold mb-1">広告・トラッキング</p>
              <p className="mb-3">
                本アプリは広告を表示せず、行動トラッキングも行いません。
              </p>
              <p className="font-semibold mb-1">データの削除</p>
              <p className="mb-3">
                ブラウザ設定からサイトデータを消去するか、アプリをアンインストールすることで、
                すべてのデータを削除できます。
              </p>
              <p className="text-xs mt-4" style={{ color: '#AAA' }}>最終更新: 2026年4月</p>
            </div>
          )}

          {tab === 'credits' && (
            <div>
              <p className="font-bold mb-2" style={{ color: '#D32F2F' }}>クレジット・権利表記</p>

              <p className="font-semibold mb-1">漢字データ</p>
              <p className="mb-3">
                収録漢字は <strong>文部科学省「学年別漢字配当表」</strong>（小学校1年生）
                をベースにしています。
              </p>

              <p className="font-semibold mb-1">アルゴリズム</p>
              <p className="mb-3">
                間隔反復アルゴリズムに <strong>SM-2</strong>（SuperMemo 2）を使用しています。
              </p>

              <p className="font-semibold mb-1">背景・テーマ</p>
              <p className="mb-3">
                モンスター育成をテーマにした学習体験を提供しています。
                漢字を覚えるとタマゴが育ち、モンスターに進化します。
              </p>

              <p className="font-semibold mb-1">アプリ</p>
              <p className="mb-1">
                © 2026 n-hirai. All rights reserved.
              </p>
              <p className="mb-3">
                本アプリは React・TypeScript・Vite・Tailwind CSS を使用して開発されています。
              </p>

              <p className="text-xs" style={{ color: '#AAA' }}>
                バージョン 1.0.0
              </p>
            </div>
          )}

          {tab === 'contact' && (
            <div>
              <p className="font-bold mb-2" style={{ color: '#D32F2F' }}>お問い合わせ</p>
              <p className="mb-4 text-sm leading-relaxed" style={{ color: '#555' }}>
                バグの報告・ご意見・ご要望をお気軽にお送りください。
                いただいたフィードバックはアプリの改善に活用させていただきます。
              </p>
              <a
                href="https://forms.gle/6YGHHJV26emQHczy8"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-2xl text-center font-medium text-sm active:scale-95 transition-all mb-3"
                style={{ backgroundColor: '#FF8A80', color: '#FFF' }}
              >
                おといあわせフォームを ひらく
              </a>
              <a
                href="https://x.com/aki_kantoku"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-2xl text-center font-medium text-sm active:scale-95 transition-all"
                style={{ backgroundColor: '#000', color: '#FFF' }}
              >
                𝕏 @aki_kantoku をフォロー
              </a>
              <p className="text-xs mt-3" style={{ color: '#BBB' }}>
                ※ 返信が必要な場合はフォーム内にメールアドレスをご記入ください
              </p>
              <p className="text-xs mt-1" style={{ color: '#BBB' }}>
                ※ ご返信まで数日いただく場合があります
              </p>
            </div>
          )}
        </div>

        {/* 閉じるボタン */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl font-medium text-sm active:scale-95 transition-all"
            style={{ backgroundColor: '#F0F0F0', color: '#888' }}
          >
            とじる
          </button>
        </div>
      </div>
    </div>
  );
}
