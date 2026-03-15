export class AudioQueue {
  private queue: ArrayBuffer[] = []
  private isPlaying: boolean = false
  private audioContext: AudioContext | null = null
  private currentSource: AudioBufferSourceNode | null = null
  private analyser: AnalyserNode | null = null
  private dataArray: Uint8Array | null = null

  constructor() {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.analyser = this.audioContext.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.connect(this.audioContext.destination)
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount)
  }

  async push(audioData: ArrayBuffer): Promise<void> {
    // AudioContextがsuspendされていたら再開
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume()
    }
    this.queue.push(audioData)
    if (!this.isPlaying) {
      this.playNext()
    }
  }

  private async playNext(): Promise<void> {
    if (this.queue.length === 0 || !this.audioContext || !this.analyser) {
      this.isPlaying = false
      return
    }

    this.isPlaying = true
    const audioData = this.queue.shift()!
    
    try {
      const audioBuffer = await this.audioContext.decodeAudioData(audioData)
      this.currentSource = this.audioContext.createBufferSource()
      this.currentSource.buffer = audioBuffer
      
      // AnalyserNodeに接続してから出力へ
      this.currentSource.connect(this.analyser)
      
      this.currentSource.onended = () => {
        this.currentSource = null
        this.playNext()
      }
      
      this.currentSource.start()
    } catch (e) {
      console.error('Error decoding/playing audio:', e)
      this.playNext()
    }
  }

  // 現在の音量レベル（0.0〜1.0）を取得する
  public getVolumeLevel(): number {
    if (!this.analyser || !this.dataArray || !this.isPlaying) return 0
    
    this.analyser.getByteTimeDomainData(this.dataArray! as any)
    
    // RMS（二乗平均平方根）で音量を計算
    let sum = 0
    for (let i = 0; i < this.dataArray.length; i++) {
      const amplitude = (this.dataArray[i] - 128) / 128
      sum += amplitude * amplitude
    }
    const rms = Math.sqrt(sum / this.dataArray.length)
    
    // 値を調整して感度を高める（0.3以上ならほぼ最大とみなすなど）
    return Math.min(rms * 5, 1.0)
  }

  // 割り込み（Barge-in）時の処理
  clear(): void {
    this.queue = []
    if (this.currentSource) {
      this.currentSource.stop()
      this.currentSource = null
    }
    this.isPlaying = false
  }

  get isBusy(): boolean {
    return this.isPlaying || this.queue.length > 0
  }
}
