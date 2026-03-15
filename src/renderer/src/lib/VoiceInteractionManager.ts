import { GeminiLiveClient } from './GeminiLiveClient'
import { VvoxClient } from './VvoxClient'
import { AudioQueue } from './AudioQueue'

export class VoiceInteractionManager {
  private gemini: GeminiLiveClient
  private vvox: VvoxClient
  private queue: AudioQueue
  private textBuffer: string = ""
  private generationId: number = 0
  private onEmotion: (emotion: string) => void
  private onError: (message: string) => void

  // 句読点など、チャンクとして分割する文字
  private splitChars = /[、。！？\n]/
  // 感情タグの正規表現（任意の英数字タグに対応）
  private emotionRegex = /\[([A-Z0-9_]+)\]/i

  constructor(
    gemini: GeminiLiveClient,
    vvox: VvoxClient,
    onEmotion: (emotion: string) => void,
    onError?: (message: string) => void
  ) {
    this.gemini = gemini
    this.vvox = vvox
    this.queue = new AudioQueue()
    this.onEmotion = onEmotion
    this.onError = onError ?? (() => {})

    this.setupListeners()
  }

  private setupListeners(): void {
    this.gemini.on('text', (text: string) => {
      this.handleIncomingText(text)
    })

    this.gemini.on('interrupted', () => {
      this.handleInterrupt()
    })

    this.gemini.on('turnComplete', () => {
      // ターン終了時に句読点なしで残ったテキストを処理
      const remaining = this.textBuffer.trim()
      if (remaining) {
        this.processChunk(remaining, this.generationId)
      }
      this.textBuffer = ""
    })
  }

  private async handleIncomingText(text: string): Promise<void> {
    this.textBuffer += text

    // 感情タグの抽出
    let emotionMatch: RegExpExecArray | null
    while ((emotionMatch = this.emotionRegex.exec(this.textBuffer)) !== null) {
      const tag = emotionMatch[1].toLowerCase()
      this.onEmotion(tag)
      // タグをバッファから削除
      this.textBuffer = this.textBuffer.replace(emotionMatch[0], '')
    }

    // チャンク分割の試行
    let match: RegExpExecArray | null
    while ((match = this.splitChars.exec(this.textBuffer)) !== null) {
      const splitIndex = match.index + 1
      const chunk = this.textBuffer.slice(0, splitIndex).trim()
      this.textBuffer = this.textBuffer.slice(splitIndex)

      if (chunk) {
        this.processChunk(chunk, this.generationId)
      }
    }
  }

  private async processChunk(chunk: string, genId: number): Promise<void> {
    try {
      const audioData = await this.vvox.generateAudio(chunk)
      // 割り込み後に完了した古い世代のチャンクは捨てる
      if (genId !== this.generationId) return
      this.queue.push(audioData)
    } catch (e) {
      if (genId !== this.generationId) return
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Failed to generate voice for chunk:', chunk, e)
      this.onError(msg)
    }
  }

  public handleInterrupt(): void {
    this.generationId++  // 飛行中のVOICEVOX呼び出しを全て無効化
    this.queue.clear()
    this.textBuffer = ""
  }

  public getVolumeLevel(): number {
    return this.queue.getVolumeLevel()
  }
}
