'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Camera,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  Scan,
  Save,
  User,
  ImageIcon,
  Settings,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useCameraStore, type DetectedFace } from '@/stores/camera-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useFaceDetection, useImageFaceDetection, useRealtimeRecognition } from '@/hooks/use-face-detection'
import { useCaptureFrame, useEnsureDefaultCamera } from '@/hooks/use-cameras'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CameraSelector, useCameraDevices } from '@/components/camera'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [autoRecognize, setAutoRecognize] = useState(false)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>()
  const [capturedCount, setCapturedCount] = useState(0)

  const { isStreaming, setStreaming, detectedFaces, updateDetections } = useCameraStore()
  const { showBoundingBoxes, showConfidence, showAgeGender } = useSettingsStore()

  const {
    isLoading: isModelLoading,
    isModelLoaded,
    loadModel,
    startDetection,
    stopDetection,
    error: modelError,
  } = useFaceDetection()

  const { recognize, isRecognizing } = useRealtimeRecognition()
  const captureMutation = useCaptureFrame()
  const ensureDefaultCamera = useEnsureDefaultCamera()

  // 确保有默认摄像头
  useEffect(() => {
    ensureDefaultCamera.mutate()
  }, [])

  // 启动摄像头
  const startCamera = useCallback(async () => {
    try {
      setIsStarting(true)
      setError(null)

      // 先加载 AI 模型
      const modelLoaded = await loadModel()
      if (!modelLoaded) {
        throw new Error('无法加载人脸检测模型')
      }

      // 启动摄像头
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined,
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      streamRef.current = stream
      setStreaming(true)
      toast.success('摄像头已开启')
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法访问摄像头'
      setError(message)
      toast.error(message)
    } finally {
      setIsStarting(false)
    }
  }, [loadModel, setStreaming, selectedDeviceId])

  // 停止摄像头
  const stopCamera = useCallback(() => {
    // 停止检测
    if (isDetecting) {
      stopDetection()
      setIsDetecting(false)
    }

    // 停止摄像头
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreaming(false)
    updateDetections([])
    toast.info('摄像头已关闭')
  }, [isDetecting, stopDetection, setStreaming, updateDetections])

  // 开始/停止检测
  const toggleDetection = useCallback(() => {
    if (!videoRef.current) return

    if (isDetecting) {
      stopDetection()
      setIsDetecting(false)
      toast.info('人脸检测已停止')
    } else {
      startDetection(videoRef.current)
      setIsDetecting(true)
      toast.success('人脸检测已开始')
    }
  }, [isDetecting, startDetection, stopDetection])

  // 截图保存
  const captureScreenshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const base64 = canvas.toDataURL('image/jpeg', 0.9)

    try {
      await captureMutation.mutateAsync({
        cameraId: 'local',
        frameBase64: base64,
      })
      setCapturedCount((prev) => prev + 1)
      toast.success('截图已保存')
    } catch (err) {
      toast.error('保存截图失败')
    }
  }, [captureMutation])

  // 绘制检测框
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current || !showBoundingBoxes) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number

    const draw = () => {
      if (!isStreaming) return

      // 同步 canvas 尺寸
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制检测框
      for (const face of detectedFaces) {
        const { x, y, width, height } = face.bbox

        // 边框
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        // 角落装饰
        const cornerLength = Math.min(width, height) * 0.2
        ctx.strokeStyle = '#22c55e'
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

        // 标签背景
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(x, y - 25, width, 22)

        // 标签文字
        ctx.fillStyle = '#ffffff'
        ctx.font = '12px system-ui, sans-serif'

        let label = ''
        if (showConfidence) {
          label += `${(face.confidence * 100).toFixed(0)}%`
        }
        if (showAgeGender && face.age) {
          if (label) label += ' · '
          label += `${face.age.toFixed(0)}岁`
          if (face.gender) {
            label += ` ${face.gender === 'male' ? '男' : face.gender === 'female' ? '女' : ''}`
          }
        }
        if (face.emotion) {
          if (label) label += ' · '
          label += translateEmotion(face.emotion)
        }

        ctx.fillText(label, x + 4, y - 8)
      }

      animationId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [isStreaming, detectedFaces, showBoundingBoxes, showConfidence, showAgeGender])

  // 清理
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  return (
    <>
      <Header title="实时摄像头" />
      <div className="flex-1 space-y-6 p-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* 视频预览 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  摄像头预览
                </CardTitle>
                <CardDescription>
                  {isStreaming
                    ? isDetecting
                      ? `正在检测人脸 - 发现 ${detectedFaces.length} 张`
                      : '摄像头已开启'
                    : '点击开始按钮开启摄像头'}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {isModelLoading && (
                  <Badge variant="secondary">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    加载模型中
                  </Badge>
                )}
                {isStreaming && (
                  <Badge variant="default" className="bg-red-500">
                    <span className="mr-1.5 h-2 w-2 animate-pulse rounded-full bg-white" />
                    LIVE
                  </Badge>
                )}
                {isDetecting && (
                  <Badge variant="default" className="bg-blue-500">
                    <Scan className="mr-1 h-3 w-3" />
                    检测中
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                {error || modelError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-10 w-10" />
                    <p>{error || modelError}</p>
                  </div>
                ) : !isStreaming && !isStarting ? (
                  <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
                    <Camera className="h-16 w-16" />
                    <p>摄像头未开启</p>
                    <CameraSelector
                      value={selectedDeviceId}
                      onValueChange={setSelectedDeviceId}
                      disabled={isStreaming}
                    />
                  </div>
                ) : null}

                <video
                  ref={videoRef}
                  className="absolute inset-0 h-full w-full object-contain"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 h-full w-full object-contain pointer-events-none"
                />

                {isStarting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <p className="text-sm">正在加载...</p>
                    </div>
                  </div>
                )}

                {/* 检测数量指示 */}
                {isDetecting && detectedFaces.length > 0 && (
                  <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2 text-white">
                    <Users className="h-4 w-4" />
                    <span className="text-sm font-medium">{detectedFaces.length} 人</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {!isStreaming ? (
                  <Button onClick={startCamera} disabled={isStarting}>
                    {isStarting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )}
                    开始
                  </Button>
                ) : (
                  <>
                    <Button variant="destructive" onClick={stopCamera}>
                      <Pause className="mr-2 h-4 w-4" />
                      停止
                    </Button>
                    <Button
                      variant={isDetecting ? 'secondary' : 'default'}
                      onClick={toggleDetection}
                    >
                      {isDetecting ? (
                        <EyeOff className="mr-2 h-4 w-4" />
                      ) : (
                        <Scan className="mr-2 h-4 w-4" />
                      )}
                      {isDetecting ? '停止检测' : '开始检测'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={captureScreenshot}
                      disabled={captureMutation.isPending}
                    >
                      {captureMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="mr-2 h-4 w-4" />
                      )}
                      截图
                    </Button>
                  </>
                )}

                {capturedCount > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    已保存 {capturedCount} 张截图
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 检测结果 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  检测结果
                </CardTitle>
                <CardDescription>检测到 {detectedFaces.length} 张人脸</CardDescription>
              </CardHeader>
              <CardContent>
                {detectedFaces.length === 0 ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    {isDetecting ? '正在检测...' : '暂无检测结果'}
                  </div>
                ) : (
                  <ScrollArea className="h-64">
                    <div className="space-y-2 pr-4">
                      {detectedFaces.map((face, index) => (
                        <FaceCard key={face.id} face={face} index={index} />
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* 快捷设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  快捷设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-recognize" className="text-sm">
                    自动识别
                  </Label>
                  <Switch
                    id="auto-recognize"
                    checked={autoRecognize}
                    onCheckedChange={setAutoRecognize}
                    disabled={!isDetecting}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  开启后将自动与身份库匹配，并记录识别结果
                </p>

                <Separator />

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-boxes" className="text-sm">
                    显示检测框
                  </Label>
                  <Switch
                    id="show-boxes"
                    checked={showBoundingBoxes}
                    onCheckedChange={(checked) =>
                      useSettingsStore.setState({ showBoundingBoxes: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-confidence" className="text-sm">
                    显示置信度
                  </Label>
                  <Switch
                    id="show-confidence"
                    checked={showConfidence}
                    onCheckedChange={(checked) =>
                      useSettingsStore.setState({ showConfidence: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="show-age-gender" className="text-sm">
                    显示年龄/性别
                  </Label>
                  <Switch
                    id="show-age-gender"
                    checked={showAgeGender}
                    onCheckedChange={(checked) =>
                      useSettingsStore.setState({ showAgeGender: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}

// 人脸卡片组件
function FaceCard({ face, index }: { face: DetectedFace; index: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10">
          <User className="h-5 w-5 text-green-500" />
        </div>
        <div>
          <p className="text-sm font-medium">人脸 #{index + 1}</p>
          <p className="text-xs text-muted-foreground">
            {(face.confidence * 100).toFixed(1)}% 置信度
          </p>
        </div>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        {face.age && <div>{face.age.toFixed(0)}岁</div>}
        {face.gender && (
          <div>{face.gender === 'male' ? '男' : face.gender === 'female' ? '女' : ''}</div>
        )}
        {face.emotion && <div>{translateEmotion(face.emotion)}</div>}
      </div>
    </div>
  )
}

// 表情翻译
function translateEmotion(emotion: string): string {
  const emotionMap: Record<string, string> = {
    happy: '开心',
    sad: '悲伤',
    angry: '愤怒',
    fearful: '恐惧',
    disgusted: '厌恶',
    surprised: '惊讶',
    neutral: '平静',
  }
  return emotionMap[emotion] ?? emotion
}
