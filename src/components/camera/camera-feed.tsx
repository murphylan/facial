'use client'

import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'
import { Camera, Loader2, AlertCircle, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CameraFeedRef {
  /** 获取视频元素 */
  getVideo: () => HTMLVideoElement | null
  /** 获取当前帧的 canvas */
  captureFrame: () => HTMLCanvasElement | null
  /** 获取当前帧的 base64 图片 */
  captureImage: (quality?: number) => string | null
  /** 开始流 */
  start: (deviceId?: string) => Promise<void>
  /** 停止流 */
  stop: () => void
}

interface CameraFeedProps {
  /** 摄像头设备 ID */
  deviceId?: string
  /** 是否自动播放 */
  autoPlay?: boolean
  /** 视频约束 */
  constraints?: MediaTrackConstraints
  /** 是否镜像 */
  mirrored?: boolean
  /** 开始回调 */
  onStart?: () => void
  /** 停止回调 */
  onStop?: () => void
  /** 错误回调 */
  onError?: (error: Error) => void
  /** 帧更新回调 (每帧调用) */
  onFrame?: (video: HTMLVideoElement) => void
  /** 帧间隔 (ms)，用于 onFrame 调用频率 */
  frameInterval?: number
  /** 子元素 (叠加层) */
  children?: React.ReactNode
  className?: string
}

export const CameraFeed = forwardRef<CameraFeedRef, CameraFeedProps>(
  function CameraFeed(
    {
      deviceId,
      autoPlay = false,
      constraints = {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
      mirrored = true,
      onStart,
      onStop,
      onError,
      onFrame,
      frameInterval = 100,
      children,
      className,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const frameLoopRef = useRef<number | undefined>(undefined)
    const lastFrameTimeRef = useRef<number>(0)

    const [isLoading, setIsLoading] = useState(false)
    const [isPlaying, setIsPlaying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isMuted, setIsMuted] = useState(true)

    // 获取当前帧
    const captureFrame = useCallback((): HTMLCanvasElement | null => {
      const video = videoRef.current
      if (!video || video.readyState < 2) return null

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return null

      // 如果镜像，需要翻转
      if (mirrored) {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
      }

      ctx.drawImage(video, 0, 0)
      return canvas
    }, [mirrored])

    // 获取 base64 图片
    const captureImage = useCallback(
      (quality = 0.9): string | null => {
        const canvas = captureFrame()
        if (!canvas) return null
        return canvas.toDataURL('image/jpeg', quality)
      },
      [captureFrame]
    )

    // 开始摄像头
    const start = useCallback(
      async (targetDeviceId?: string) => {
        setIsLoading(true)
        setError(null)

        try {
          const finalDeviceId = targetDeviceId || deviceId

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              ...constraints,
              deviceId: finalDeviceId ? { exact: finalDeviceId } : undefined,
            },
            audio: false,
          })

          if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play()
          }

          streamRef.current = stream
          setIsPlaying(true)
          onStart?.()
        } catch (err) {
          const error = err instanceof Error ? err : new Error('无法访问摄像头')
          setError(error.message)
          onError?.(error)
        } finally {
          setIsLoading(false)
        }
      },
      [deviceId, constraints, onStart, onError]
    )

    // 停止摄像头
    const stop = useCallback(() => {
      // 停止帧循环
      if (frameLoopRef.current) {
        cancelAnimationFrame(frameLoopRef.current)
        frameLoopRef.current = undefined
      }

      // 停止流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      setIsPlaying(false)
      onStop?.()
    }, [onStop])

    // 暴露方法给父组件
    useImperativeHandle(
      ref,
      () => ({
        getVideo: () => videoRef.current,
        captureFrame,
        captureImage,
        start,
        stop,
      }),
      [captureFrame, captureImage, start, stop]
    )

    // 帧循环 (用于 onFrame 回调)
    useEffect(() => {
      if (!isPlaying || !onFrame) return

      const loop = () => {
        const now = performance.now()
        if (now - lastFrameTimeRef.current >= frameInterval) {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            onFrame(videoRef.current)
          }
          lastFrameTimeRef.current = now
        }
        frameLoopRef.current = requestAnimationFrame(loop)
      }

      loop()

      return () => {
        if (frameLoopRef.current) {
          cancelAnimationFrame(frameLoopRef.current)
        }
      }
    }, [isPlaying, onFrame, frameInterval])

    // 自动播放
    useEffect(() => {
      if (autoPlay) {
        start()
      }
    }, [autoPlay, start])

    // 设备变更时重新启动
    useEffect(() => {
      if (isPlaying && deviceId) {
        stop()
        start(deviceId)
      }
    }, [deviceId])

    // 清理
    useEffect(() => {
      return () => {
        stop()
      }
    }, [stop])

    return (
      <div className={cn('relative aspect-video overflow-hidden rounded-lg bg-black', className)}>
        {/* 占位符状态 */}
        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Camera className="h-12 w-12" />
            <p className="text-sm">摄像头未开启</p>
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/80 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">正在启动摄像头...</p>
          </div>
        )}

        {/* 错误状态 */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-destructive">
            <AlertCircle className="h-10 w-10" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* 视频元素 */}
        <video
          ref={videoRef}
          className={cn(
            'absolute inset-0 h-full w-full object-contain',
            mirrored && 'scale-x-[-1]'
          )}
          playsInline
          muted={isMuted}
        />

        {/* 子元素 (叠加层) */}
        {children}

        {/* 音频控制 (如果需要) */}
        {isPlaying && (
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-2 right-2 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
            title={isMuted ? '开启声音' : '静音'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        )}

        {/* 直播指示器 */}
        {isPlaying && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-1 text-xs font-medium text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE
          </div>
        )}
      </div>
    )
  }
)
