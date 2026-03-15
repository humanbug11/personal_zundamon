export class SpeechRecognitionManager {
  private recognition: any
  private onResult: (text: string) => void
  private isStarted: boolean = false

  constructor(onResult: (text: string) => void) {
    this.onResult = onResult
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition API is not supported in this browser.')
      return
    }

    this.recognition = new SpeechRecognition()
    this.recognition.lang = 'ja-JP'
    this.recognition.continuous = true
    this.recognition.interimResults = false

    this.recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (result.isFinal) {
        const text = result[0].transcript.trim()
        if (text) {
          this.onResult(text)
        }
      }
    }

    this.recognition.onerror = (event: any) => {
      console.error('Speech Recognition Error:', event.error)
      if (event.error === 'not-allowed') {
        this.isStarted = false
      }
      // network エラー時は少し待ってから onend で再起動させる（ループ防止）
      if (event.error === 'network') {
        this.isStarted = false
        setTimeout(() => { this.isStarted = true }, 2000)
      }
    }

    this.recognition.onend = () => {
      if (this.isStarted) {
        setTimeout(() => {
          try { this.recognition.start() } catch { /* 既に起動中の場合は無視 */ }
        }, 300)
      }
    }
  }

  start(): void {
    if (this.recognition && !this.isStarted) {
      this.isStarted = true
      this.recognition.start()
    }
  }

  stop(): void {
    this.isStarted = false
    if (this.recognition) {
      this.recognition.stop()
    }
  }
}
