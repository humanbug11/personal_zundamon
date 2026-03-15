# ずんだもんAIパートナー - Claude開発ガイド

Electron + React + TypeScript製の透過ウィンドウアプリ。ずんだもんがデスクトップに常駐し、Gemini Multimodal Live APIで画面を見ながら会話し、VOICEVOXで音声を出力する。

## コマンド

```bash
npm run dev       # 開発サーバー起動（Electron + Vite HMR）
npm run build     # 型チェック + ビルド
npm run typecheck # 型チェックのみ
```

## 必須前提条件

1. **VOICEVOX Engine** を起動しておく（`http://127.0.0.1:50021`）
2. **`.env` ファイル**に `VITE_GEMINI_API_KEY=...` を設定する

## アーキテクチャ

```
STARTボタン押下
  → GeminiLiveClient.connect()  (WebSocket接続)
  → ScreenCapture.start()        (画面キャプチャ開始)
  → SpeechRecognitionManager.start() (マイク入力)
  → gemini.sendClientContent()  ← 最初の挨拶

Geminiからの応答フロー:
  WebSocket text message
  → GeminiLiveClient: data.outputTranscription.text をemit('text')
  → VoiceInteractionManager: 感情タグ抽出 + 句読点でチャンク分割
  → VvoxClient.generateAudio()  (VOICEVOX HTTP API)
  → AudioQueue.push()            (順次再生)
  → AudioQueue.getVolumeLevel() → Character口パクアニメ
```

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/renderer/src/App.tsx` | メインロジック・状態管理・接続制御 |
| `src/renderer/src/lib/GeminiLiveClient.ts` | Gemini WebSocket通信 |
| `src/renderer/src/lib/VoiceInteractionManager.ts` | テキスト→感情→音声パイプライン |
| `src/renderer/src/lib/VvoxClient.ts` | VOICEVOX HTTP APIクライアント |
| `src/renderer/src/lib/AudioQueue.ts` | 音声再生キューとAnalyserNode口パク |
| `src/renderer/src/lib/SpeechRecognitionManager.ts` | Web Speech API (STT) |
| `src/renderer/src/lib/ScreenCapture.ts` | デスクトップキャプチャ (1fps) |
| `src/main/index.ts` | Electronメインプロセス・IPCハンドラー |
| `src/renderer/public/assets/emotions/` | 感情別立ち絵PNG（20感情×2枚） |

## Gemini API 注意事項

- モデル: `gemini-2.5-flash`（TEXTモード）
- レスポンスはTEXTのみ（`responseModalities: ["TEXT"]`）
- テキストは `serverContent.modelTurn.parts[].text` で取得
- `connect()` は `setupComplete` 受信後に resolve する（その前にメッセージを送ると無視される）
- setupメッセージのJSON構造は camelCase で送る（`responseModalities`, `systemInstruction` 等）
- `outputAudioTranscription` は `BidiGenerateContentSetup` のトップレベルフィールド（`generationConfig` 外）

## STARTボタンで会話しない場合のデバッグ手順

1. **DevToolsで確認**: `Ctrl+Shift+I` → Console タブ
   - `Gemini WebSocket Connected` → `Gemini Setup Complete` の順に出るか確認
   - エラーメッセージはあるか（APIキー不正、モデル名不正等）

2. **VOICEVOXの確認**: ブラウザで `http://127.0.0.1:50021/speakers` にアクセスして応答するか

3. **よくある原因**:
   - VOICEVOXが起動していない（音声生成でエラー、画面にエラー表示）
   - `.env` の `VITE_GEMINI_API_KEY` が未設定または無効
   - モデル名が変更されている（Gemini APIのプレビューモデルは頻繁に更新される）

## 感情システム

- Geminiの出力に `[HAPPY]` 等のタグを付けさせる（システムプロンプトで指示）
- 20種類: `normal`, `happy`, `smug`, `upset`, `surprised`, `thinking`, `sad`, `relaxed`, `excited`, `shy`, `confused`, `stern`, `tired`, `awe`, `scare`, `laugh`, `proud`, `doubt`, `cry`, `sleepy`
- 画像命名: `zundamon_{感情名}.png` / `zundamon_{感情名}_open.png`（口パク用）
- 画像パス: `src/renderer/public/assets/emotions/`

## Electronウィンドウ設定

- 透過・フレームなし・常に最前面表示
- マウス透過: キャラクターとコントロールパネル上のみ受け付け（それ以外は透過）
- ドラッグ: キャラクター画像エリアをドラッグして移動可能
- IPC: `get-desktop-sources`, `set-ignore-mouse-events`, `window-move`
