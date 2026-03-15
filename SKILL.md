---
name: ずんだもんAIパートナー開発ガイド
description: Gemini Multimodal Live APIとVOICEVOXを活用したずんだもんAIの拡張・保守ガイドラインなのだ！
---

# 開発スキル: ずんだもんAIパートナーシステム

このプロジェクトは、透明な Electron ウィンドウ上でずんだもんが画面を共有しながらユーザーと対話する、高度なAIパートナーシステムなのだ！

## 🛠 技術スタック
- **Frontend**: Electron + React (TypeScript) + Vite
- **AI**: Gemini Multimodal Live API (BidiGenerateContent)
- **Voice**: VOICEVOX Engine (デフォルト: `http://127.0.0.1:50021`)
- **Animation**: リアルタイム音量解析による動的口パク (Lip-Sync)

## 📁 主要なディレクトリと機能
- `src/main/`: Electronのメインプロセス。ウィンドウの透過やマウスイベント透過を制御。
- `src/renderer/src/App.tsx`: メインロジック。Geminiとの接続管理、感情状態の保持。
- `src/renderer/src/components/Character.tsx`: ずんだもんの描画。感情と音量に基づく画像切り替え。
- `src/renderer/src/lib/AudioQueue.ts`: 音声再生と `AnalyserNode` による音量抽出。
- `public/assets/emotions/`: 感情および口パク用の画像アセット配置場所。

## 🎭 感情・口パクシステムのルール
ずんだもんに新しい表情を追加する際は、以下の命名規則に従う必要があるのだ！

1. **基本立ち絵:** `zundamon_感情名.png`
2. **口パク用:** `zundamon_感情名_open.png`
   - システムは `[感情名]` というタグをGeminiの出力から抽出し、画像を切り替える。
   - `_open` 素材がある場合、再生中の音量に合わせて自動でパタパタするのだ。

## 🔐 セキュリティと環境設定
APIキーは絶対にコードにハードコードしてはいけないのだ！

- **.env ファイル**: `VITE_GEMINI_API_KEY` をここに記述する。
- **.gitignore**: `.env` や `node_modules` は必ず除外する設定にする。
- **共有時の注意**: `.env` ファイルを他人に送ったり、公開リポジトリにコミットしたりしてはいけないのだ！

## 💡 拡張のアイデア
- **感情追加**: `Character.tsx` や `VoiceInteractionManager.ts` を修正することなく、画像を追加するだけで表情を増やせる。
- **アニメーション**: CSSアニメーションや更なる画像レイヤーを重ねることで、呼吸や瞬きを実装できる。
- **VOICEVOX設定**: `VvoxClient.ts` の `speakerId` を変えることで、四国めたん等の他のキャラクターにも変えられるのだ。
