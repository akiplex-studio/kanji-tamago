# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Dev server (auto-runs buildWords.mjs first)
npm run build        # Production build: buildWords + tsc -b + vite build
npm run build:words  # Regenerate src/data/preset/allWords.json from CSVs
npm run lint         # ESLint
npm run preview      # Preview built artifact
npx tsc -b           # Type-check only (no build)
```

Deploy: Pushing to `main` triggers `.github/workflows/deploy.yml` → builds and publishes `dist/` to GitHub Pages. The Vite `base` is `/kanji-tamago/`, so all asset paths are scoped under this path. Live site: https://akiplex-studio.github.io/kanji-tamago/

## Architecture

漢字タマゴ (Kanji Tamago) is a Japanese kanji learning PWA for kids (小1〜小6). It's a fork of 記憶ザクラ (memory-sakura, an NGSL English vocabulary app) refitted with a monster-raising theme and simplified 2-choice SRS. All state lives in `localStorage` — there is **no backend**.

### Data flow: CSV → JSON → app

1. **Source of truth**: `src/data/preset/shogaku{1..6}_kanji.csv` (columns: `漢字,読み`).
   The parser splits each line on the **first comma**, so commas inside the kanji or reading column are not supported — use full-width parens instead. Two extension formats have evolved:
   - **Compound notation** `漢字（熟語）,かな（じゅくご）` — for kanji whose standalone reading is meaningless to kids (e.g. `校（学校）,こう（がっこう）`). The `id` is `kanji-g{N}-{front}`, so renaming a row's front string invalidates its localStorage progress.
   - **Meaning notation** `かな（＝意味）` or `かな（じゅくご＝意味）` — appended inside the answer column for words with archaic/abstract meanings (e.g. `もちいる（＝つかう）`, `き（きしゃ＝むかしのでんしゃ）`). The `＝` distinguishes "meaning" from "compound reading". Note: the back string is also passed to TTS (`speakJa`), which may pronounce the `＝` as "イコール".
2. **`scripts/buildWords.mjs`** runs on `npm run dev`/`build` (prebuild step). It reads all 6 CSVs, auto-chunks each grade into ~20-word stages (merges a trailing stage of <10 words into the previous one), and emits `src/data/preset/allWords.json` (~1026 words total).
3. **`src/data/loadWords.ts`** dynamically imports `allWords.json`; `src/store/wordStore.ts` merges it with saved progress on startup (see `mergeWithMaster`).

**Data version bumps cascade.** When changing the earning/progression model OR renaming any CSV row's `front` (which changes its `id`), bump `CURRENT_DATA_VERSION` in `wordStore.ts`. `resetIfNeeded()` then wipes: words progress, master version, setup-done flag, daily wrong list, stage progress, **and `monsterState`**. Quest state (`kanji-tamago-quest-state`) is **not** wiped.

### State layer (`src/store/wordStore.ts`)

Single React hook `useWordStore()` owns everything. No context/redux. Exposes:

- `words` — **grade-filtered** list (plus custom words). The raw full list is `allWords`.
- `grade` / `setGrade` — persisted selected grade (1..6). `null` triggers `GradeSelectPage` in `App.tsx`.
- `answerWord(id, quality)` — records SRS result **and** earns food (0/2 — see Monster section).
- `monsterState` — `{ schemaVersion: 2, foodInventory, currentMonster: { species, fed }, collection: AdultMonster[], feedTargetId }`, persisted under key `kanji-tamago-monster-state`. `AdultMonster` is `{ id, species, graduatedAt, level, exp }`. See `src/utils/monsterState.ts` (it includes a `migrate()` for the legacy `string[]` collection format).
- `questState` — `{ schemaVersion: 2, currentTier, clearedTiers, mermaidEggsByTier, lastBattle }`, persisted under `kanji-tamago-quest-state`. See `src/utils/questState.ts`.
- `feedMonster()` — consume 1 food, +1 to `currentMonster.fed`. Caps at `MAX_FED` (120); **does not graduate here** (see below).
- `feedAdult(id)` — feed an already-graduated monster in `collection` (post-Lv5 leveling, see Monster system).
- `graduateMonster()` — explicit: push `makeAdult(species)` to `collection`, reset to new egg. Called from `HomePage` on a delay.
- `finishBattle(victory, stagesCleared)` — record quest result, advance tier on full clear, award mermaid egg on first clear of a tier.
- `hatchMermaidEgg(tier)` — consume one stored mermaid egg and replace `currentMonster` with the tier's `M0X` species. Only valid when `currentMonster.fed === 0`.

LocalStorage keys (for migration/debug): `kanji-tamago-words`, `kanji-tamago-grade`, `kanji-tamago-monster-state`, `kanji-tamago-quest-state`, `kanji-tamago-setup-done`, `kanji-tamago-tutorial-done`, `kanji-tamago-tip-index`, `kanji-tamago-cleared-stations`, `kanji-tamago-stage-progress`, `kanji-tamago-daily-wrong`, `kanji-tamago-data-version`, `kanji-tamago-master-version`, `kanji-tamago-grade-promo-{1..6}` (one-shot promo flag per grade).

### SRS (`src/utils/reviewSchedule.ts` + `src/lib/sm2.ts`)

Custom kids-friendly 5-stage schedule layered on top of SM-2. Only 2 qualities are actually used by the UI:

- **わからない (q=1)** → next review in **15 sec** (icon ❌, same-session re-quiz)
- **おぼえた, 1回目 (q=4, rep=0→1)** → next review **the next day** (icon 🌱)
- **おぼえた, 2回目 (rep=1→2)** → next review **3 days later** (icon 🌳)
- **おぼえた, 3回目 (rep=2→3)** → next review **7 days later** (icon 🌷)
- **おぼえた, 4回目 (rep=3→4)** → `nextReviewAt = Number.MAX_SAFE_INTEGER` (永久マスター 🌟, no more reviews)

Mastery rule: `sm2Repetition >= 4`. Status values: `unlearned | learning | overdue | mastered`. **Never introduce hour-scale waits** — this is intentional for kids. The short 15-sec wait on wrong answers is paired with an in-session pending-re-review loop in `ReviewPage` so kids see the word again immediately.

Progression (`src/utils/stationProgress.ts`): `getCurrentStation` advances past a stage when **every word has `sm2Repetition >= 1`** (one correct answer each), **not** when fully mastered. This decouples stage unlock from the slower 1-week confirmation cycle.

Session pacing (`src/utils/reviewSchedule.ts`): `MAX_NEW_PER_SESSION` (default 10) caps how many unlearned words each session introduces. New-word lock condition is **backlog-based**: if `dailyLimit.getReviewBacklogCount(words)` (count of ❌ = `learning && rep=0` plus 💔 = `overdue`) reaches `REVIEW_BACKLOG_LIMIT` (20), the queue is built with `{ excludeUnlearned: true }` and the "そんなに たくさん おぼえれないでしょ！" modal triggers. The "ふくしゅうだけ つづける" button sets a session-only `newWordsLocked` flag that skips remaining unlearned words and re-issues pending re-review items only.

Stage-by-stage review focus: `getTodayReviewWords` computes `stationCap` = lowest `station` containing any ❌ or 💔 (excluding custom words), then drops every non-custom word with `station > stationCap` from the queue. So if stage 1 still has ×s, stage 2 unlearned/overdue words don't appear until stage 1 is cleared.

Word icons (`src/utils/wordIcon.ts`): empty (unlearned) | ❌ (learning rep=0) | 🌱 (rep=1) | 🌳 (rep=2) | 🌷 (rep=3) | 🌟 (mastered, rep≥4) | 💔 (overdue regardless of rep).

### Monster system

Decoupled from stages. One global "current monster" progresses 🥚 → 🐣 → 🐥 → 🐤 → 🌟 via food consumption (see `src/utils/monsterState.ts`):

- **Egg→adult curve**: `STAGE_THRESHOLDS = [10, 20, 35, 55]` (food required for each Lv→Lv+1 transition). `MAX_FED = 120` (sum). Back-loaded so early levels reach quickly to keep kids hooked.
- **Earning** (in `answerWord`): q<3 → 0, q>=3 → +2 (rule duplicated in `ReviewPage.handleAnswer` for the apple-particle count — keep both in sync). The same-session re-review loop in `ReviewPage` ensures wrong words are revisited until correctly answered: pending wrongs are re-issued at the overdue→unlearned boundary and again at queue end. `HomePage.handleMonsterTap` gates the feed action behind a "まずは ふくしゅう しよう" modal when `dailyLimit.getRemainingRecoveryCount(words) > 0`.
- `getLevelProgress(fed)` returns `{ level, maxLevel, current, needed, isMax }` for the top gauge UI (next-level progress, not total). HomePage uses this for the full-width top gauge with `Lv X/5` indicator.
- **Species pools**: `SPECIES_POOL` (regular eggs) is `S01`〜`S11`; mermaid species `M01`〜`M04` are awarded only as quest rewards (see Quest mode). `S12` is a legacy placeholder kept in `MERMAID_BY_TIER` migration paths but no longer in the main pool. `pickNextSpecies()` rotates `SPECIES_POOL` by `collection.length % pool.length`. Add new species by dropping PNGs into `src/assets/monster/` and registering them in both `MONSTER_IMAGES` (in `monsterImages.ts`) and the appropriate pool.
- `src/utils/monsterImages.ts` maps `species` → 5 image URLs (`src/assets/monster/{species}-01.png` 〜 `-05.png`). Source design assets (PSDs, AI-generated drafts) live in `src/assets/monster/NanoBanana/`, which is **gitignored**. Only the final PNG files are committed.

**Graduation flow (important invariant):** `feedMonster` caps `fed` at `MAX_FED` but does NOT reset. The adult form must be visible to the user. `HomePage` detects `fed >= MAX_FED` in a `useEffect`, shows the `🌟 かんせい！` celebration, and calls `graduateMonster()` after ~3.2 s. Use `adultAckedRef` to prevent double-firing. `graduateRef` holds the latest `graduateMonster` callback so dep changes don't cancel the pending timer.

**Post-Lv5 leveling (Lv5 → Lv99):** Adults in `collection` keep accruing levels via `feedAdult(id)`, which routes a food item to a specific adult through `monsterState.feedTargetId` (selected by tapping a background monster on HomePage). XP curve: `xpToNextLevel(level) = 20 + 5 * (level - 5)^1.5` for Lv≥5. `addExpTo()` cascades level-ups in one call. `MAX_LEVEL = 99` is the cap; `MAX_COLLECTION = 100` bounds the array to prevent localStorage bloat. Combat stats for quest battles come from `getMonsterCombatStats(level) → { maxHp: 20 + 12*(L-1), atk: 3 + 3*(L-1) }`.

### Quest mode (`src/pages/QuestPage.tsx` + `src/components/BattleScene.tsx`)

Tier-based party battle, separate from kanji learning loop:

- **Tiers** (`questState.currentTier`): `beginner` → `intermediate` → `advanced` → `super`. `TIER_TARGET_LEVEL` indicates the recommended adult level for each tier (6/8/10/12). Player picks 1〜5 adults from `collection` as the party.
- **Battle structure**: `TOTAL_STAGES = 5` waves per tier. Demon stats from `getDemonStats(tier, stage)` scale by both wave number and tier index. Combat is "all-attack-per-turn" (party of N attacks N times per round).
- **Mermaid reward (`mermaidEggsByTier`)**: First clear of a tier awards one egg of the corresponding mermaid species (`MERMAID_BY_TIER`: `beginner→M01, intermediate→M02, advanced→M03, super→M04`). The egg is held until the player has a fresh `currentMonster` (`fed === 0`), then `hatchMermaidEgg(tier)` swaps it in. Eggs are consumed once each — no second clear bonus.
- Quest state has its own `schemaVersion` and migration; see `loadQuestState()` for the v1→v2 path that fills `mermaidEggsByTier` from legacy `clearedTiers`.

### HomePage animations

All keyframes live in `src/index.css`. Important ones:

- `monster-idle` — sway + vertical breath (no horizontal scale)
- `monster-hop-left` / `monster-hop-right` — occasional jump, scheduled every 4–9 s from HomePage
- `monster-eat` — tap feedback (0.5 s). Composed with idle via the `animation` shorthand: `"monster-eat 0.5s ease-out, monster-idle 3.6s ease-in-out 0.5s infinite"`. `transformOrigin: 'center 90%'` grounds the motion at the feet.
- `smoke-burst` — fires on `species` or `stageIndex` change (tracked via `prevMonsterKey` ref). Uses `src/assets/monster/smoke.png`.
- `apple-fly` / `apple-collect` — `apple-fly` for tap-to-feed (on HomePage); `apple-collect` for earn animation (on ReviewPage).
- `graduation-title` / `graduation-sparkle` — fires when adult is reached.

The HomePage monster has a 3-layer transform to compose independent animations: outer `<button>` (position + idle/eat), inner `<div>` (hop), `<img>` (`scale(1.6)` to compensate for whitespace around the sprite in S01-xx PNGs, `transformOrigin: 'center 60%'`).

Background collection: up to 20 past adult monsters from `monsterState.collection`, placed on a 4×5 jittered grid (`X_MIN..X_MAX`, `Y_MIN..Y_MAX` in HomePage). Sizes 64–86 px, each with random sway duration/delay so they move independently. Position is memoized on `collection.join(',')` to stay stable.

### Page structure (`src/App.tsx`)

Render order (early returns):
1. `grade === null` → `GradeSelectPage`
2. `showTutorial` → `TutorialPage`
3. `screen === 'setup' && !setupDone` → fullscreen `SetupPage` (no footer)
4. Otherwise → footer with 4 visible tabs: ホーム / リスト / **がくしゅう** (center FAB → `ReviewPage`) / クエスト / せってい

The 一括 (`SetupPage`) tab is **hidden behind `false &&`** in the footer (line ~953) since kids don't need bulk setup, but the page and its logic are intact — flip the gate to re-enable. The review lock screen has been removed — `ReviewPage` always renders and shows a "学習完了" message if the queue is empty.

A grade-promotion modal (`showGradePromotion`) fires once per grade when every word in the current grade has `sm2Repetition >= 1`, gated by `kanji-tamago-grade-promo-{grade}` flag.

### Icons for words (`src/utils/wordIcon.ts`)

5-state system based on SRS state:

| Icon | Condition |
|---|---|
| (empty) | `unlearned` |
| 🌱 | learning with `sm2Repetition >= 1` |
| ❌ | learning with `sm2Repetition === 0` (answered わからない, not yet correct) |
| 💔 | `overdue` |
| 🌟 | `mastered` (or `isWordMastered` returns true) |

Do not confuse with the monster progression icons (🥚🐣🐥🐤🌟) — those describe the current monster, not individual words.

### Copy / content

- `src/data/stationTips.ts` — generic stage-clear messages (indexed by stage number, falls back to a generic template for stages ≥ 9)
- `src/data/stationTrivia.ts` — generic kanji trivia pool (returned for any stage via Proxy)
- `TutorialPage.tsx` — copy uses `{grade}` and `{count}` placeholders that are substituted at runtime from the selected grade.

All UI copy is in hiragana/easy Japanese for grade 1–6 readers.
