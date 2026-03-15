# ずんだもんAIパートナー

デスクトップ最前面に常駐し、PC画面を共有しながら「ずんだもん」とリアルタイムに対話できるElectronアプリです。

## 必要なもの

- **VOICEVOX** — ずんだもんの声を合成するTTSエンジン
- **Gemini API キー** — Google AI Studio で無料取得可能

---

## インストール（リリース版）

1. [VOICEVOX](https://voicevox.hiroshiba.jp/) をダウンロード・起動する
2. `dist/Zundamon AI Partner Setup 1.0.0.exe` を実行してインストール
3. アプリを起動し、パネルに Gemini API キーを入力して **START**

> ポータブル版は `dist/win-unpacked/Zundamon AI Partner.exe` を直接実行してください。

---

## 開発環境セットアップ

### 1. 依存関係のインストール
```bash
npm install
```

### 2. VOICEVOX Engine の起動
[VOICEVOX](https://voicevox.hiroshiba.jp/) を起動してください。
デフォルトで `http://127.0.0.1:50021` で待ち受けている必要があります。

### 3. 開発サーバー起動
```bash
npm run dev
```

### 4. Windowsビルド
```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:win
```

---

## 使い方

1. アプリ右下のキャラクター付近にカーソルを合わせるとパネルが表示されます
2. **APIキーを設定** — 「設定」ボタンから Gemini API キーを入力・保存
3. **START** ボタンで接続開始
4. マイクに向かって話しかけると、ずんだもんがPC画面を見ながら返答します
5. **STOP** で切断、再度 START で再接続できます

**操作:**
- キャラクターをドラッグして移動できます
- ずんだもんが話している途中で話しかけると割り込みできます（Barge-in）
- キャラクター・パネル以外の領域はクリックが透過します

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Electron 31 + React 18 + TypeScript |
| ビルド | electron-vite + Vite 5 |
| スタイル | Tailwind CSS v4 |
| AI | Gemini Multimodal Live API（WebSocket / v1beta） |
| モデル | `gemini-2.5-flash-native-audio-preview-12-2025` |
| 音声合成 | VOICEVOX Engine（スピーカーID 3 = ずんだもん） |
| STT | Gemini ネイティブ音声認識（PCM 16kHz）|
| 画面共有 | desktopCapturer → JPEG 1fps |

### 動作の仕組み

```
マイク → AudioCapture (PCM 16kHz) → Gemini Live API (WebSocket)
画面  → desktopCapturer (JPEG 1fps) → Gemini Live API

Gemini → outputAudioTranscription (テキスト転写)
       → VoiceInteractionManager
       → 感情タグ抽出 → キャラクター表情変化
       → VOICEVOX API → 音声再生 (AudioQueue)
```

---

## APIキーについて

アプリ内パネルから入力したキーは `localStorage` に保存されます（`.env` 不要）。
`.env` に `VITE_GEMINI_API_KEY` を設定した場合はそちらがフォールバックになります。

Gemini API キーは [Google AI Studio](https://aistudio.google.com/apikey) で無料取得できます。
`gemini-2.5-flash-native-audio-preview-12-2025` はプレビューモデルのため、利用にはAPIアクセスの申請が必要な場合があります。

---

## クレジット

- **立ち絵素材**: 製作：坂本アヒル ([@sakamoto_ahr](https://twitter.com/sakamoto_ahr))
