'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { DetectedFace } from '@/stores/camera-store'

interface FaceOverlayProps {
  /** 视频元素引用，用于获取尺寸 */
  videoRef: React.RefObject<HTMLVideoElement | null>
  /** 检测到的人脸列表 */
  faces: DetectedFace[]
  /** 是否显示 */
  visible?: boolean
  /** 主题色 */
  color?: string
  /** 显示选项 */
  options?: {
    showConfidence?: boolean
    showAge?: boolean
    showGender?: boolean
    showEmotion?: boolean
    showIdentity?: boolean
  }
  /** 身份映射表 (faceId -> 身份名称) */
  identityMap?: Record<string, string>
  /** 点击人脸回调 */
  onFaceClick?: (face: DetectedFace) => void
  className?: string
}

const emotionTranslations: Record<string, string> = {
  happy: '开心',
  sad: '悲伤',
  angry: '愤怒',
  fearful: '恐惧',
  disgusted: '厌恶',
  surprised: '惊讶',
  neutral: '平静',
}

export function FaceOverlay({
  videoRef,
  faces,
  visible = true,
  color = '#22c55e',
  options = {
    showConfidence: true,
    showAge: true,
    showGender: true,
    showEmotion: false,
    showIdentity: true,
  },
  identityMap = {},
  onFaceClick,
  className,
}: FaceOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | undefined>(undefined)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || !visible) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 同步 canvas 尺寸
    const rect = video.getBoundingClientRect()
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || rect.width
      canvas.height = video.videoHeight || rect.height
    }

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 绘制每个人脸
    for (const face of faces) {
      const { x, y, width, height } = face.bbox
      const identity = identityMap[face.id]
      const isIdentified = !!identity
      const faceColor = isIdentified ? '#3b82f6' : color

      // 绘制边框
      ctx.strokeStyle = faceColor
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, width, height)

      // 绘制角落装饰
      const cornerLength = Math.min(width, height) * 0.2
      ctx.strokeStyle = faceColor
      ctx.lineWidth = 3

      // 左上角
      ctx.beginPath()
      ctx.moveTo(x, y + cornerLength)
      ctx.lineTo(x, y)
      ctx.lineTo(x + cornerLength, y)
      ctx.stroke()

      // 右上角
      ctx.beginPath()
      ctx.moveTo(x + width - cornerLength, y)
      ctx.lineTo(x + width, y)
      ctx.lineTo(x + width, y + cornerLength)
      ctx.stroke()

      // 左下角
      ctx.beginPath()
      ctx.moveTo(x, y + height - cornerLength)
      ctx.lineTo(x, y + height)
      ctx.lineTo(x + cornerLength, y + height)
      ctx.stroke()

      // 右下角
      ctx.beginPath()
      ctx.moveTo(x + width - cornerLength, y + height)
      ctx.lineTo(x + width, y + height)
      ctx.lineTo(x + width, y + height - cornerLength)
      ctx.stroke()

      // 构建标签
      const labels: string[] = []

      if (options.showIdentity && identity) {
        labels.push(`👤 ${identity}`)
      }

      if (options.showConfidence) {
        labels.push(`${(face.confidence * 100).toFixed(0)}%`)
      }

      if (options.showAge && face.age) {
        labels.push(`${face.age.toFixed(0)}岁`)
      }

      if (options.showGender && face.gender) {
        const genderText = face.gender === 'male' ? '男' : face.gender === 'female' ? '女' : ''
        if (genderText) labels.push(genderText)
      }

      if (options.showEmotion && face.emotion) {
        const emotionText = emotionTranslations[face.emotion] || face.emotion
        labels.push(emotionText)
      }

      // 绘制标签背景
      if (labels.length > 0) {
        const labelText = labels.join(' · ')
        ctx.font = '12px system-ui, -apple-system, sans-serif'
        const textWidth = ctx.measureText(labelText).width
        const padding = 4
        const labelHeight = 20
        const labelY = y - labelHeight - 2

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
        ctx.fillRect(x, labelY, textWidth + padding * 2, labelHeight)

        ctx.fillStyle = '#ffffff'
        ctx.textBaseline = 'middle'
        ctx.fillText(labelText, x + padding, labelY + labelHeight / 2)
      }
    }

    animationRef.current = requestAnimationFrame(draw)
  }, [faces, visible, color, options, identityMap, videoRef])

  useEffect(() => {
    if (visible && faces.length > 0) {
      draw()
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [draw, visible, faces.length])

  // 处理点击事件
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!onFaceClick || !canvasRef.current || !videoRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      const clickX = (e.clientX - rect.left) * scaleX
      const clickY = (e.clientY - rect.top) * scaleY

      // 检查点击是否在某个人脸框内
      for (const face of faces) {
        const { x, y, width, height } = face.bbox
        if (
          clickX >= x &&
          clickX <= x + width &&
          clickY >= y &&
          clickY <= y + height
        ) {
          onFaceClick(face)
          break
        }
      }
    },
    [faces, onFaceClick, videoRef]
  )

  if (!visible) return null

  return (
    <canvas
      ref={canvasRef}
      onClick={onFaceClick ? handleClick : undefined}
      className={`absolute inset-0 h-full w-full object-contain pointer-events-${onFaceClick ? 'auto' : 'none'} ${className}`}
      style={{ cursor: onFaceClick ? 'pointer' : 'default' }}
    />
  )
}
