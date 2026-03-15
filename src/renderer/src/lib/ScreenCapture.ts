export class ScreenCapture {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null

  constructor() {
    this.video = document.createElement('video')
    this.canvas = document.createElement('canvas')
    this.ctx = this.canvas.getContext('2d')
  }

  async start(): Promise<void> {
    const sources = await window.api.getDesktopSources()
    // 最初の画面を選択（デスクトップ全体を想定）
    const source = sources[0]
    if (!source) throw new Error('No desktop sources found')

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: source.id,
          minWidth: 1280,
          maxWidth: 1280,
          minHeight: 720,
          maxHeight: 720
        }
      } as any
    })

    if (this.video) {
      this.video.srcObject = this.stream
      this.video.play()
    }
  }

  getFrameBase64(): string | null {
    if (!this.ctx || !this.video || !this.canvas) return null
    if (this.video.videoWidth === 0) return null

    this.canvas.width = 640 // リサイズして負荷を下げる
    this.canvas.height = 360
    this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height)
    
    // image/jpeg でサイズを抑える
    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.6)
    return dataUrl.split(',')[1] // Base64部分のみ返す
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
  }
}
