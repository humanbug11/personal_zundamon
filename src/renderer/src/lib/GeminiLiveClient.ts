import EventEmitter from 'eventemitter3'

export interface GeminiConfig {
  apiKey: string
  model?: string
  systemPrompt: string
}

export class GeminiLiveClient extends EventEmitter {
  private ws: WebSocket | null = null
  private config: GeminiConfig

  constructor(config: GeminiConfig) {
    super()
    this.config = config
  }

  async connect(): Promise<void> {
    // v1beta: 2.5 は音声出力のみ。転写テキストを VOICEVOX 用に取得する
    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url)
      let setupDone = false

      // 15秒でタイムアウト
      const timeout = setTimeout(() => {
        if (!setupDone) {
          this.ws?.close()
          reject(new Error('接続タイムアウト: Gemini APIに接続できませんでした (15秒)'))
        }
      }, 15000)

      const done = (err?: Error): void => {
        clearTimeout(timeout)
        if (err) reject(err)
        else resolve()
      }

      this.ws.onopen = () => {
        this.sendSetup()
        // setupComplete を受信してから resolve する（その前にメッセージを送ると無視される）
        this.once('setupComplete', () => {
          setupDone = true
          done()
        })
      }

      this.ws.onmessage = (event) => {
        this.handleMessage(event)
      }

      this.ws.onerror = (error) => {
        console.error('Gemini WebSocket Error:', error)
        const message = (error as unknown as Error)?.message ?? 'WebSocket connection error'
        const err = new Error(message)
        if (!setupDone) done(err)
        else this.emit('error', err)
      }

      this.ws.onclose = (ev) => {
        const reason = ev.reason || `code: ${ev.code}`
        if (!setupDone) {
          done(new Error(`接続終了: ${reason}`))
        } else {
          if (ev.code !== 1000 && ev.reason) {
            this.emit('error', new Error(`接続終了: ${ev.reason}`))
          }
          this.emit('close')
        }
      }
    })
  }

  private sendSetup(): void {
    // このモデルはAUDIO出力専用。outputAudioTranscription でテキスト転写を取得し VOICEVOX に渡す
    const setupMsg = {
      setup: {
        model: `models/${this.config.model || 'gemini-2.5-flash-native-audio-preview-12-2025'}`,
        generationConfig: {
          responseModalities: ["AUDIO"]
        },
        outputAudioTranscription: {},
        systemInstruction: {
          parts: [{ text: this.config.systemPrompt }]
        }
      }
    }
    this.send(setupMsg)
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      // BlobでもStringでも両方対応（Gemini実装によって異なる）
      let raw: string
      if (typeof event.data === 'string') {
        raw = event.data
      } else if (event.data instanceof Blob) {
        raw = await event.data.text()
      } else {
        return // ArrayBuffer（音声バイナリ）は無視
      }
      const data = JSON.parse(raw)

      // APIエラー・レート制限を検出
      const err = data?.error ?? data?.message?.error
      if (err) {
        const msg = typeof err === 'string' ? err : (err?.message ?? err?.status ?? JSON.stringify(err))
        const code = typeof err === 'object' && err?.code
        let text = msg
        if (code === 429 || (typeof msg === 'string' && (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')))) {
          text = `API制限: ${msg}`
        }
        this.emit('error', new Error(text))
        return
      }

      if (data.setupComplete) {
        this.emit('setupComplete')
      }

      if (data.serverContent) {
        // AUDIO モデルのテキスト転写（VOICEVOX用）
        if (data.serverContent.outputTranscription?.text) {
          this.emit('text', data.serverContent.outputTranscription.text)
        }

        if (data.serverContent.turnComplete) {
          this.emit('turnComplete')
        }

        if (data.serverContent.interrupted) {
          this.emit('interrupted')
        }
      }

      // トップレベルの outputTranscription にも対応
      if (data.outputTranscription?.text) {
        this.emit('text', data.outputTranscription.text)
      }
    } catch (e) {
      console.error('Error parsing Gemini message:', e)
      this.emit('error', e instanceof Error ? e : new Error(String(e)))
    }
  }

  sendRealtimeInput(input: any): void {
    this.send({ realtimeInput: input })
  }

  sendAudioChunk(base64Pcm: string): void {
    this.sendRealtimeInput({
      mediaChunks: [{
        mimeType: "audio/pcm;rate=16000",
        data: base64Pcm
      }]
    })
  }

  sendImageFrame(base64Img: string): void {
    this.sendRealtimeInput({
      mediaChunks: [{
        mimeType: "image/jpeg",
        data: base64Img
      }]
    })
  }

  private send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data))
    }
  }

  // Barge-in 時に前の文脈をキャンセルさせるための仕組み（ClientContentを送信）
  sendClientContent(text: string, isEnd: boolean = true): void {
    this.send({
      clientContent: {
        turns: [{
          role: "user",
          parts: [{ text }]
        }],
        turnComplete: isEnd
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
