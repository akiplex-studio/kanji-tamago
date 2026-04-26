# 漢字タマゴ

小学1〜6年生向けの漢字学習PWA。モンスター育成テーマと短期SRSで、覚えた漢字でモンスターを育てるしかけ。

🔗 **Live**: https://akiplex-studio.github.io/kanji-tamago/

## 特徴

- 小1〜小6（1026語）対応、学年ごとの段階出題
- 2択の「わかる / わからない」だけで答えるシンプルUI
- 全幼児向けひらがな表記、TTS（音声読み上げ）付き
- モンスター育成（卵→大人→Lv99）、クエストモードあり
- 完全クライアント完結（バックエンドなし、`localStorage` のみ）

## 開発

```bash
npm install
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
```

## デプロイ

`main` への push で GitHub Actions が自動で `dist/` を `gh-pages` ブランチへ publish。

## 技術スタック

React 19 / TypeScript / Vite / Tailwind CSS v4
