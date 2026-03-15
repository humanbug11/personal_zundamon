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
2. **Gemini API キー** — アプリ内パネルから入力（`localStorage` に保存）、または `.env` に `VITE_GEMINI_API_KEY=...`

## アーキテクチャ

```
STARTボタン押下
  → GeminiLiveClient.connect()  (WebSocket接続・setupComplete待機)
  → ScreenCapture.start()        (画面キャプチャ開始 1fps JPEG)
  → AudioCapture.start()         (マイク PCM 16kHz → Gemini送信)
  → gemini.sendClientContent()  ← 最初の挨拶

Geminiからの応答フロー:
  WebSocket Blob message (※Electronでは必ずBlob)
  → GeminiLiveClient: serverContent.outputTranscription.text をemit('text')
  → VoiceInteractionManager: 感情タグ抽出 + 句読点でチャンク分割
    → generationIdチェック（割り込み後の古いチャンクを破棄）
  → VvoxClient.generateAudio()  (VOICEVOX HTTP API)
  → AudioQueue.push()            (順次再生)
  → AudioQueue.getVolumeLevel() → Character口パクアニメ

ユーザー割り込み (Barge-in):
  Gemini VAD検知 → interrupted イベント
  → VoiceInteractionManager.handleInterrupt()
    → generationId++（飛行中VOICEVOXコール全て無効化）
    → AudioQueue.clear()（再生中の音声停止）
    → textBuffer=""
```

## 主要ファイル

| ファイル | 役割 |
|---|---|
| `src/renderer/src/App.tsx` | メインロジック・状態管理・接続制御・APIキーUI |
| `src/renderer/src/lib/GeminiLiveClient.ts` | Gemini WebSocket通信 |
| `src/renderer/src/lib/VoiceInteractionManager.ts` | テキスト→感情→音声パイプライン・Barge-in制御 |
| `src/renderer/src/lib/VvoxClient.ts` | VOICEVOX HTTP APIクライアント |
| `src/renderer/src/lib/AudioQueue.ts` | 音声再生キューとAnalyserNode口パク |
| `src/renderer/src/lib/AudioCapture.ts` | マイク入力 → PCM 16kHz → Gemini送信（STT） |
| `src/renderer/src/lib/ScreenCapture.ts` | デスクトップキャプチャ (1fps) |
| `src/main/index.ts` | Electronメインプロセス・IPCハンドラー |
| `src/renderer/public/assets/emotions/` | 感情別立ち絵PNG（20感情×2枚） |

## Gemini API 注意事項

- モデル: `gemini-2.5-flash-native-audio-preview-12-2025`（AUDIOモード・v1beta）
- レスポンスモダリティ: `["AUDIO"]`（このモデルはAUDIO専用。TEXTモード不可）
- テキスト転写は `outputAudioTranscription: {}` をsetupトップレベルに設定して取得
- テキストは `serverContent.outputTranscription.text` で取得
- **Electronでは応答がBlob形式で届く**（string判定で捨てないこと）
- `connect()` は `setupComplete` 受信後に resolve する（その前にメッセージを送ると無視される）
- `outputAudioTranscription` は `BidiGenerateContentSetup` のトップレベルフィールド（`generationConfig` 外）

## STARTボタンで会話しない場合のデバッグ手順

1. **DevToolsで確認**: `Ctrl+Shift+I` → Console タブ
   - `Gemini WebSocket Connected` → `Gemini Setup Complete` の順に出るか確認
   - エラーメッセージはあるか（APIキー不正、モデル名不正等）

2. **VOICEVOXの確認**: ブラウザで `http://127.0.0.1:50021/speakers` にアクセスして応答するか

3. **よくある原因**:
   - VOICEVOXが起動していない（音声生成でエラー、画面にエラー表示）
   - APIキーが未設定または無効（アプリ内パネルまたは `.env` で設定）
   - モデル名が変更されている（Gemini APIのプレビューモデルは頻繁に更新される）
   - Geminiの応答をBlob処理していない（`handleMessage` がstringのみ対応の古いコード）

## 感情システム

- Geminiの出力に `[HAPPY]` 等のタグを付けさせる（システムプロンプトで指示）
- 20種類: `normal`, `happy`, `smug`, `upset`, `surprised`, `thinking`, `sad`, `relaxed`, `excited`, `shy`, `confused`, `stern`, `tired`, `awe`, `scare`, `laugh`, `proud`, `doubt`, `cry`, `sleepy`
- 画像命名: `zundamon_{感情名}.png` / `zundamon_{感情名}_open.png`（口パク用）
- 画像パス: `src/renderer/public/assets/emotions/`

## Barge-in（割り込み）の仕組み

- Gemini Live APIはVAD（音声検知）を内蔵しており、ユーザーが話すと自動で `interrupted` イベントを送信
- `VoiceInteractionManager.handleInterrupt()` が `generationId` をインクリメント
- 飛行中のVOICEVOX非同期コールは完了後に `generationId` が変わっていれば `queue.push()` をスキップ
- `AudioQueue.clear()` で再生中の音声を即停止
- エコー防止: `getVolumeLevel() > 0.05` の間はマイク音声をGeminiに送らない

## Electronウィンドウ設定

- 透過・フレームなし・常に最前面表示
- マウス透過: キャラクターとコントロールパネル上のみ受け付け（それ以外は透過）
- ドラッグ: キャラクター画像エリアをドラッグして移動可能
- IPC: `get-desktop-sources`, `set-ignore-mouse-events`, `window-move`

## クレジット・利用規約

- 立ち絵素材: 製作：坂本アヒル (@sakamoto_ahr)
- キャラクター: ずんだもん（東北ずん子）© SSS合同会社 https://zunko.jp/guideline.html
- 音声合成: VOICEVOX:ずんだもん https://zunko.jp/con_ongen_kiyaku.html
