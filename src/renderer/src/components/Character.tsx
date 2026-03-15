import React, { useEffect, useRef, useState } from 'react'
import fallbackImg from '../assets/zundamon.png'

const EMOTION_HOLD_MS = 700 // 感情画像の最低表示時間（wait）。短い間隔でのチラつきを防ぐ

const Character = React.forwardRef<HTMLDivElement, { emotion?: string; volume?: number }>(
  ({ emotion = 'normal', volume = 0 }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [useOpenMouth, setUseOpenMouth] = useState(false)
  // 実際に表示する感情（wait を入れて親の emotion より遅れて更新）
  const [displayedEmotion, setDisplayedEmotion] = useState(emotion)
  const pendingEmotionRef = useRef(emotion)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 感情の切り替えに wait を入れる：最低 EMOTION_HOLD_MS 表示してから次へ
  useEffect(() => {
    pendingEmotionRef.current = emotion
    if (emotion === displayedEmotion) return
    if (holdTimerRef.current) return // すでに待機中は pending だけ更新
    holdTimerRef.current = setTimeout(() => {
      setDisplayedEmotion(pendingEmotionRef.current)
      holdTimerRef.current = null
    }, EMOTION_HOLD_MS)
  }, [emotion, displayedEmotion])

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    }
  }, [])

  // 音量に応じて口を開く（0.05以上で開口）& スケール計算
  useEffect(() => {
    setUseOpenMouth(volume > 0.05)
  }, [volume])

  // 音量(0〜1)を1.0〜1.04のスケールに変換（話すたびに微妙に弾む）
  const talkScale = 1 + Math.min(volume, 1) * 0.04

  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  // public/assets/emotions/zundamon_${displayedEmotion}${_open}.png を参照する
  const suffix = useOpenMouth ? '_open' : ''
  const imagePath = `assets/emotions/zundamon_${displayedEmotion}${suffix}.png`

  const handleMouseDown = (e: React.MouseEvent): void => {
    setIsDragging(true)
    dragOffset.current = { x: e.screenX, y: e.screenY }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent): void => {
      if (!containerRef.current) return

      // ドラッグ処理
      if (isDragging) {
        const deltaX = e.screenX - dragOffset.current.x
        const deltaY = e.screenY - dragOffset.current.y
        window.api.moveWindow({ x: deltaX, y: deltaY })
        dragOffset.current = { x: e.screenX, y: e.screenY }
        return
      }
      // マウス透過は App でパネル＋キャラ両方を見て制御する（ここでは何もしない）
    }

    const handleMouseUp = (): void => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div
      ref={(el) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        if (typeof ref === 'function') ref(el)
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      className="relative w-80 h-auto pointer-events-auto"
      onMouseDown={handleMouseDown}
    >
      <img
        src={imagePath}
        alt={`ずんだもん (${displayedEmotion}${suffix})`}
        className="w-full h-auto select-none"
        style={{ transform: `scale(${talkScale})`, transformOrigin: 'bottom center', transition: 'transform 0.05s ease-out' }}
        draggable={false}
        onError={(e) => {
          const target = e.target as HTMLImageElement
          // 口開き画像がない場合は、口閉じ画像にフォールバック
          if (useOpenMouth) {
            target.src = `assets/emotions/zundamon_${displayedEmotion}.png`
            // それもなければ完全なフォールバック
            target.onerror = () => { target.src = fallbackImg }
          } else if (target.src !== fallbackImg) {
            target.src = fallbackImg
          }
        }}
      />
      {displayedEmotion === 'thinking' && (
        <div className="absolute top-0 left-[-150px] w-48 bg-white/80 backdrop-blur-sm rounded-2xl p-3 shadow-lg transition-opacity duration-300">
          <p className="text-sm font-bold text-green-800">考え中なのだ...</p>
        </div>
      )}
    </div>
  )
})

Character.displayName = 'Character'
export default Character
