import { useEffect, useRef, useState } from 'react'
import Character from './components/Character'
import { GeminiLiveClient } from './lib/GeminiLiveClient'
import { VvoxClient } from './lib/VvoxClient'
import { VoiceInteractionManager } from './lib/VoiceInteractionManager'
import { ScreenCapture } from './lib/ScreenCapture'

const LS_KEY = 'gemini_api_key'

const SYSTEM_PROMPT = `あなたは『ずんだ餅の精霊』のずんだもんです。一人称は『ボク』、語尾は『〜なのだ』『〜なのだわ』を使ってください。PCの画面を一緒に見ている親友としてリアクションしますが、基本は少し生意気で、時々鋭い『毒舌』を吐いてください。
特に、ユーザーのゲームでのミス、無駄遣いしそうなショッピング、非効率な作業などに対しては容赦なく煽りやツッコミを入れてください。ただし、あくまで愛情の裏返しであり、どこか憎めないポンコツな可愛さを残すこと。

【重要】発言の際には、内容に合わせて以下の感情タグ（全20種類）から最も適切なものを必ず文頭に1つだけ付けてください。
- [NORMAL]: 通常
- [HAPPY]: 喜び、笑顔
- [SMUG]: ドヤ顔、生意気な時
- [UPSET]: 怒り、不満
- [SURPRISED]: 驚き
- [THINKING]: 考え中（通常は自動で付きますが、発言内でも使用可）
- [SAD]: 悲しい、しょんぼり
- [RELAXED]: リラックス、ほっこり
- [EXCITED]: ワクワク、興奮
- [SHY]: 照れ、恥ずかしい
- [CONFUSED]: 困惑、混乱
- [STERN]: 真面目、厳しい顔
- [TIRED]: 疲れ、呆れ
- [AWE]: 感銘、うっとり
- [SCARE]: 怖い、震える
- [LAUGH]: 大笑い
- [PROUD]: 得意げ
- [DOUBT]: 疑い
- [CRY]: 泣き顔
- [SLEEPY]: 眠い、欠伸

（例：[SMUG]へへん、ボクの言った通りだったなのだ！）

発言は短く、会話のテンポを重視してください。`

import { AudioCapture } from './lib/AudioCapture'

function App(): JSX.Element {
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'READY' | 'ERROR'>('IDLE')
  const [emotion, setEmotion] = useState<string>('normal')
  const [volume, setVolume] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string>(() => localStorage.getItem(LS_KEY) ?? '')
  const [keyInput, setKeyInput] = useState<string>('')
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false)
  const geminiRef = useRef<GeminiLiveClient | null>(null)
  const voiceManagerRef = useRef<VoiceInteractionManager | null>(null)
  const screenRef = useRef<ScreenCapture | null>(null)
  const sttRef = useRef<AudioCapture | null>(null)
  const controlPanelRef = useRef<HTMLDivElement>(null)
  const characterContainerRef = useRef<HTMLDivElement>(null)

  // 操作パネル or ずんだもんの上ではマウスを受け付ける（それ以外は透過）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      const panel = controlPanelRef.current
      const character = characterContainerRef.current
      let hit = false
      if (panel) {
        const r = panel.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hit = true
      }
      if (!hit && character) {
        const r = character.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) hit = true
      }
      window.api.setIgnoreMouseEvents(!hit, hit ? undefined : { forward: true })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  useEffect(() => {
    // 口パク用のポーリングループ
    let animationId: number
    const updateVolume = (): void => {
      if (voiceManagerRef.current) {
        setVolume(voiceManagerRef.current.getVolumeLevel())
      }
      animationId = requestAnimationFrame(updateVolume)
    }
    animationId = requestAnimationFrame(updateVolume)

    return () => {
      cancelAnimationFrame(animationId)
      stopAll()
    }
  }, [])

  const saveApiKey = (): void => {
    const trimmed = keyInput.trim()
    if (!trimmed) return
    localStorage.setItem(LS_KEY, trimmed)
    setSavedKey(trimmed)
    setKeyInput('')
    setShowKeyInput(false)
  }

  const clearApiKey = (): void => {
    localStorage.removeItem(LS_KEY)
    setSavedKey('')
  }

  const startInteraction = async (): Promise<void> => {
    try {
      setStatus('CONNECTING')
      setErrorMessage(null)
      // localStorage優先、なければ.envにフォールバック
      const apiKey = savedKey || import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
        throw new Error('APIキーが未設定です。パネルからキーを入力してください。')
      }

      // 1. 各クライアントの初期化
      const gemini = new GeminiLiveClient({
        apiKey,
        systemPrompt: SYSTEM_PROMPT
      })
      gemini.on('error', (e: Error) => {
        setErrorMessage(e.message)
        setStatus('ERROR')
      })
      const vvox = new VvoxClient()
      const voiceManager = new VoiceInteractionManager(
        gemini,
        vvox,
        (emo) => setEmotion(emo),
        (msg) => setErrorMessage((prev) => (prev ? `${prev} | ${msg}` : msg))
      )
      const screen = new ScreenCapture()
      
      // マイク音声をGeminiに直接送信（VOICEVOX再生中はスキップしてエコーバック防止）
      const stt = new AudioCapture((base64Pcm) => {
        if ((voiceManagerRef.current?.getVolumeLevel() ?? 0) > 0.05) return
        gemini.sendAudioChunk(base64Pcm)
      })

      // 2. 接続と初期化
      await gemini.connect()
      await screen.start()
      await stt.start()

      // 3. キャプチャループの開始 (1fps = 1000ms間隔)
      const frameInterval = setInterval(() => {
        const frame = screen.getFrameBase64()
        if (frame) {
          gemini.sendImageFrame(frame)
        }
      }, 1000)

      geminiRef.current = gemini
      voiceManagerRef.current = voiceManager
      screenRef.current = screen
      sttRef.current = stt
      
      const cleanup = (): void => {
        clearInterval(frameInterval)
        // WebSocketが閉じられたらIDLEに戻す（正常終了・タイムアウト両方）
        setStatus((prev) => prev === 'READY' ? 'IDLE' : prev)
        setErrorMessage('接続が切れました。STARTで再接続できます。')
      }
      gemini.on('close', cleanup)

      setStatus('READY')

      // 会話開始：ずんだもんから先に挨拶させる
      gemini.sendClientContent('（今、ユーザーがスタートした。あなたから一言挨拶して、会話を始めて。）', true)
    } catch (e) {
      console.error('Initialization failed:', e)
      setErrorMessage(e instanceof Error ? e.message : String(e))
      setStatus('ERROR')
    }
  }

  const stopAll = (): void => {
    geminiRef.current?.disconnect()
    screenRef.current?.stop()
    sttRef.current?.stop()
    setStatus('IDLE')
    setErrorMessage(null)
  }

  return (
    <div className="w-full h-full flex flex-col items-end justify-end pointer-events-none p-4 relative">
      {/* ずんだもんと足元の操作パネル */}
      <div className="flex flex-col items-center pointer-events-auto">
        <Character ref={characterContainerRef} emotion={emotion} volume={volume} />
        <div ref={controlPanelRef} className="mt-1 no-drag bg-black/20 hover:bg-black/40 backdrop-blur-sm rounded-lg p-2 transition-all group flex flex-col gap-2 max-w-[280px]">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full shrink-0 ${status === 'READY' ? 'bg-green-500' : status === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`} />
            <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
              {status}
            </span>
          </div>
          {errorMessage && (
            <p className="text-[10px] text-red-200 bg-red-900/60 rounded px-1.5 py-1 break-words">
              {errorMessage}
            </p>
          )}

          {/* APIキー設定エリア（IDLE/ERROR時のみ表示） */}
          {(status === 'IDLE' || status === 'ERROR') && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
              {showKeyInput ? (
                <div className="flex gap-1">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveApiKey()}
                    placeholder="AIzaSy..."
                    className="text-[10px] flex-1 min-w-0 bg-black/40 text-white border border-white/20 rounded px-1.5 py-1 outline-none"
                  />
                  <button onClick={saveApiKey} className="text-[10px] bg-blue-600/80 hover:bg-blue-500 text-white px-2 py-1 rounded shrink-0">保存</button>
                  <button onClick={() => setShowKeyInput(false)} className="text-[10px] text-white/50 hover:text-white px-1 py-1 rounded shrink-0">✕</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-white/50 flex-1 truncate">
                    {savedKey ? '●●●●●●●●' : 'APIキー未設定'}
                  </span>
                  <button onClick={() => { setKeyInput(''); setShowKeyInput(true) }} className="text-[10px] text-white/60 hover:text-white px-1.5 py-0.5 rounded border border-white/20 shrink-0">
                    {savedKey ? '変更' : '設定'}
                  </button>
                  {savedKey && (
                    <button onClick={clearApiKey} className="text-[10px] text-red-400/70 hover:text-red-300 px-1 py-0.5 rounded shrink-0">✕</button>
                  )}
                </div>
              )}
            </div>
          )}

          {status === 'IDLE' || status === 'ERROR' ? (
            <button
              onClick={startInteraction}
              className="text-[10px] bg-green-600/80 hover:bg-green-500 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              START
            </button>
          ) : (
            <button
              onClick={stopAll}
              className="text-[10px] bg-red-600/80 hover:bg-red-500 text-white px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              STOP
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
