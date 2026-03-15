export class VvoxClient {
  private baseUrl: string

  constructor(baseUrl: string = 'http://127.0.0.1:50021') {
    this.baseUrl = baseUrl
  }

  async generateAudio(text: string, speakerId: number = 3): Promise<ArrayBuffer> {
    try {
      return await this.doGenerateAudio(text, speakerId)
    } catch (e) {
      if (e instanceof Error && (e.message.startsWith('VOICEVOX(') || e.message.startsWith('VOICEVOX:'))) throw e
      const msg = e instanceof Error ? e.message : String(e)
      if (/fetch|network|failed to fetch/i.test(msg)) {
        throw new Error('VOICEVOX に接続できません。エンジンが起動しているか確認してください。(127.0.0.1:50021)')
      }
      throw e
    }
  }

  private async doGenerateAudio(text: string, speakerId: number): Promise<ArrayBuffer> {
    // 1. audio_query を作成
    const queryResponse = await fetch(`${this.baseUrl}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`, {
      method: 'POST'
    })
    if (!queryResponse.ok) {
      const detail = await this.getErrorDetail(queryResponse)
      throw new Error(`VOICEVOX(${queryResponse.status}): ${detail}`)
    }
    const query = await queryResponse.json()

    // 2. synthesis を実行
    const synthesisResponse = await fetch(`${this.baseUrl}/synthesis?speaker=${speakerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(query)
    })

    if (!synthesisResponse.ok) {
      const detail = await this.getErrorDetail(synthesisResponse)
      throw new Error(`VOICEVOX(${synthesisResponse.status}): ${detail}`)
    }

    return await synthesisResponse.arrayBuffer()
  }

  private async getErrorDetail(res: Response): Promise<string> {
    const text = await res.text()
    try {
      const j = JSON.parse(text)
      return j.detail ?? j.message ?? res.statusText
    } catch {
      return text || res.statusText
    }
  }
}
