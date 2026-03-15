export class AudioCapture {
  private audioContext: AudioContext | null = null
  private processor: ScriptProcessorNode | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private stream: MediaStream | null = null
  private callback: (base64Pcm: string) => void

  constructor(callback: (base64Pcm: string) => void) {
    this.callback = callback
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 })
    this.source = this.audioContext.createMediaStreamSource(this.stream)
    
    // Simple VAD could be added here, but for now we stream everything
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      const pcmData = this.floatTo16BitPCM(inputData)
      const base64Pcm = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)))
      this.callback(base64Pcm)

      // 簡易的な無音検知/発話開始検知 (VAD) を行う場合はここで inputData の音量をチェックする
      const volume = this.calculateVolume(inputData)
      if (volume > 0.05) {
        this.onSpeechDetected()
      }
    }

    this.source.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  private onSpeechDetected(): void {
    // 外部からフックできるように EventEmitter にしても良い
    window.dispatchEvent(new CustomEvent('speech-detected'))
  }

  private calculateVolume(data: Float32Array): number {
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      sum += data[i] * data[i]
    }
    return Math.sqrt(sum / data.length)
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]))
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return output
  }

  stop(): void {
    if (this.processor) this.processor.disconnect()
    if (this.source) this.source.disconnect()
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
    }
    if (this.audioContext) this.audioContext.close()
  }
}
