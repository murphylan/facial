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
  User,
  ImageIcon,
  Settings,
  Users,
  EyeOff,
  UserCheck,
  UserX,
  Activity,
} from 'lucide-react'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useCameraStore, streamManager, type DetectedFace } from '@/stores/camera-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useFaceDetection, useRealtimeRecognition } from '@/hooks/use-face-detection'
import { useCaptureFrame, useEnsureDefaultCamera } from '@/hooks/use-cameras'
import { saveRecognitionFace, type DetectedFaceData } from '@/app/actions/detect'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { CameraSelector } from '@/components/camera'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

export default function CameraPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [isStarting, setIsStarting] = useState(false)

  // 从 Zustand Store 获取状态
  const { 
    isStreaming, 
    setStreaming, 
    detectedFaces, 
    updateDetections,
    isRecognizing,
    recognitionStats,
    isDetecting,
    setDetecting,
    autoRecognize,
    setAutoRecognize,
    autoSaveStrangers,
    setAutoSaveStrangers,
    selectedDeviceId,
    setSelectedDeviceId,
    localCameraId,
    setLocalCameraId,
    savedStrangersCount,
    incrementSavedStrangers,
    capturedCount,
    incrementCaptured,
    error,
    setError,
  } = useCameraStore()
  const { showBoundingBoxes, showConfidence, showAgeGender } = useSettingsStore()

  const {
    isLoading: isModelLoading,
    isModelLoaded,
    loadModel,
    startDetection,
    stopDetection,
    error: modelError,
  } = useFaceDetection()

  // 保存陌生人的回调
  const handleStrangerDetected = useCallback((face: DetectedFace) => {
    if (!autoSaveStrangers || !videoRef.current || !localCameraId) return

    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0)
    const frameBase64 = canvas.toDataURL('image/jpeg', 0.9)

    // 裁剪人脸区域作为缩略图
    const { x, y, width, height } = face.bbox
    const padding = 0.2
    const padX = width * padding
    const padY = height * padding
    const cropX = Math.max(0, x - padX)
    const cropY = Math.max(0, y - padY)
    const cropWidth = Math.min(canvas.width - cropX, width + padX * 2)
    const cropHeight = Math.min(canvas.height - cropY, height + padY * 2)

    const thumbCanvas = document.createElement('canvas')
    thumbCanvas.width = cropWidth
    thumbCanvas.height = cropHeight
    const thumbCtx = thumbCanvas.getContext('2d')
    if (thumbCtx) {
      thumbCtx.drawImage(canvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)
    }
    const thumbnailBase64 = thumbCanvas.toDataURL('image/jpeg', 0.85)

    // 保存到数据库
    const detection: DetectedFaceData = {
      bbox: face.bbox,
      embedding: face.embedding ?? null,
      age: face.age ?? null,
      gender: (face.gender as 'male' | 'female' | 'unknown') ?? 'unknown',
      emotion: face.emotion ?? null,
      qualityScore: face.confidence,
      thumbnailBase64,
    }

    saveRecognitionFace(localCameraId, detection, frameBase64)
      .then((result) => {
        incrementSavedStrangers()
        console.log('Stranger saved:', result)
      })
      .catch((err) => {
        console.error('Failed to save stranger:', err)
        toast.error('保存陌生人失败: ' + (err instanceof Error ? err.message : '未知错误'))
      })
  }, [autoSaveStrangers, localCameraId, incrementSavedStrangers])

  const { recognizeFaces, clearRecognitionCache } = useRealtimeRecognition({
    onStrangerDetected: handleStrangerDetected,
  })
  const captureMutation = useCaptureFrame()
  const ensureDefaultCamera = useEnsureDefaultCamera()
  const hasEnsuredCamera = useRef(false)

  // 确保有默认摄像头 - 只运行一次
  useEffect(() => {
    if (!hasEnsuredCamera.current) {
      hasEnsuredCamera.current = true
      ensureDefaultCamera.mutate(undefined, {
        onSuccess: (camera) => {
          if (camera) {
            setLocalCameraId(camera.id)
          }
        },
      })
    }
  }, [ensureDefaultCamera, setLocalCameraId])

  // 组件挂载时恢复视频流
  useEffect(() => {
    const restoreStream = async () => {
      if (streamManager.isActive() && videoRef.current) {
        const stream = streamManager.getStream()
        if (stream) {
          videoRef.current.srcObject = stream
          try {
            await videoRef.current.play()
            setStreaming(true)
            
            // 如果之前在检测中，恢复检测
            if (isDetecting && isModelLoaded) {
              startDetection(videoRef.current)
            }
          } catch (err) {
            console.error('Failed to restore video stream:', err)
          }
        }
      }
    }

    restoreStream()
  }, [setStreaming, isDetecting, isModelLoaded, startDetection])

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

      // 保存到全局 streamManager
      streamManager.setStream(stream, selectedDeviceId)
      setStreaming(true)
      toast.success('摄像头已开启')
    } catch (err) {
      const message = err instanceof Error ? err.message : '无法访问摄像头'
      setError(message)
      toast.error(message)
    } finally {
      setIsStarting(false)
    }
  }, [loadModel, setStreaming, selectedDeviceId, setError])

  // 停止摄像头
  const stopCamera = useCallback(() => {
    // 停止检测
    if (isDetecting) {
      stopDetection()
      setDetecting(false)
    }

    // 关闭自动识别
    setAutoRecognize(false)

    // 清理识别缓存
    clearRecognitionCache()

    // 停止摄像头
    streamManager.stopStream()
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setStreaming(false)
    updateDetections([])
    toast.info('摄像头已关闭')
  }, [isDetecting, stopDetection, clearRecognitionCache, setStreaming, updateDetections, setDetecting, setAutoRecognize])

  // 自动识别：当检测到人脸且开启自动识别时
  // Hook 内部会处理冷却机制（同一人 3 分钟内不重复识别）
  useEffect(() => {
    if (!autoRecognize || !isDetecting || detectedFaces.length === 0) return

    // 只处理有 embedding 且尚未显示识别结果的人脸
    const facesToProcess = detectedFaces.filter(
      (face) => face.embedding && !face.recognition
    )

    if (facesToProcess.length === 0) return

    // 识别人脸（hook 内部会处理冷却和缓存）
    recognizeFaces(facesToProcess, localCameraId ?? undefined)
  }, [autoRecognize, isDetecting, detectedFaces, recognizeFaces, localCameraId])

  // 开始/停止检测
  const toggleDetection = useCallback(() => {
    if (!videoRef.current) return

    if (isDetecting) {
      stopDetection()
      setDetecting(false)
      toast.info('人脸检测已停止')
    } else {
      startDetection(videoRef.current)
      setDetecting(true)
      toast.success('人脸检测已开始')
    }
  }, [isDetecting, startDetection, stopDetection, setDetecting])

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
        cameraId: localCameraId ?? 'local',
        frameBase64: base64,
      })
      incrementCaptured()
      toast.success('截图已保存')
    } catch {
      toast.error('保存截图失败')
    }
  }, [captureMutation, localCameraId, incrementCaptured])

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
        const recognition = face.recognition

        // 根据识别结果选择颜色
        let boxColor = '#22c55e' // 绿色（默认/检测中）
        if (recognition) {
          boxColor = recognition.isStranger ? '#eab308' : '#3b82f6' // 黄色（陌生人）/ 蓝色（已识别）
        }

        // 边框
        ctx.strokeStyle = boxColor
        ctx.lineWidth = 2
        ctx.strokeRect(x, y, width, height)

        // 角落装饰
        const cornerLength = Math.min(width, height) * 0.2
        ctx.strokeStyle = boxColor
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

        // 标签背景 - 识别结果放在上方
        const labelHeight = recognition ? 44 : 22
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
        ctx.fillRect(x, y - labelHeight - 3, width, labelHeight)

        // 标签文字
        ctx.fillStyle = '#ffffff'
        ctx.font = '12px system-ui, sans-serif'

        // 第一行：识别结果
        if (recognition) {
          ctx.font = 'bold 13px system-ui, sans-serif'
          const identityLabel = recognition.isStranger 
            ? '⚠ 陌生人' 
            : `✓ ${recognition.identityName || '未知'}`
          ctx.fillStyle = recognition.isStranger ? '#fbbf24' : '#60a5fa'
          ctx.fillText(identityLabel, x + 4, y - labelHeight + 12)
          
          // 置信度
          if (recognition.confidence) {
            const confText = `${(recognition.confidence * 100).toFixed(0)}%`
            const textWidth = ctx.measureText(identityLabel).width
            ctx.fillStyle = '#9ca3af'
            ctx.font = '11px system-ui, sans-serif'
            ctx.fillText(confText, x + textWidth + 10, y - labelHeight + 12)
          }
        }

        // 第二行：检测信息
        ctx.fillStyle = '#ffffff'
        ctx.font = '11px system-ui, sans-serif'
        
        let label = ''
        if (showConfidence) {
          label += `检测 ${(face.confidence * 100).toFixed(0)}%`
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

        const labelY = recognition ? y - 10 : y - 8
        ctx.fillText(label, x + 4, labelY)
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

  // 注意：不再在组件卸载时停止摄像头，保持流存活

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
                {autoRecognize && isDetecting && (
                  <Badge variant="default" className="bg-purple-500">
                    {isRecognizing ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <UserCheck className="mr-1 h-3 w-3" />
                    )}
                    识别中
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
            {/* 识别统计 - 仅在开启自动识别时显示 */}
            {autoRecognize && recognitionStats.total > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    本次识别统计
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <div className="text-xl font-bold">{recognitionStats.total}</div>
                      <div className="text-xs text-muted-foreground">总计</div>
                    </div>
                    <div className="rounded-lg bg-green-500/10 p-2">
                      <div className="text-xl font-bold text-green-600">{recognitionStats.identified}</div>
                      <div className="text-xs text-muted-foreground">已识别</div>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 p-2">
                      <div className="text-xl font-bold text-yellow-600">{recognitionStats.strangers}</div>
                      <div className="text-xs text-muted-foreground">陌生人</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        <FaceCard key={face.id} face={face} index={index} autoRecognize={autoRecognize} />
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

                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-save-strangers" className="text-sm">
                    保存陌生人
                  </Label>
                  <Switch
                    id="auto-save-strangers"
                    checked={autoSaveStrangers}
                    onCheckedChange={setAutoSaveStrangers}
                    disabled={!autoRecognize}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  自动保存陌生人截图，用于后续聚类标注
                  {savedStrangersCount > 0 && (
                    <span className="ml-1 text-yellow-600">
                      (已保存 {savedStrangersCount} 张)
                    </span>
                  )}
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
function FaceCard({ face, index, autoRecognize }: { face: DetectedFace; index: number; autoRecognize: boolean }) {
  const recognition = face.recognition

  // 根据识别状态选择样式
  const getIconStyle = () => {
    if (!autoRecognize || !recognition) {
      return { bg: 'bg-green-500/10', icon: User, color: 'text-green-500' }
    }
    if (recognition.isStranger) {
      return { bg: 'bg-yellow-500/10', icon: UserX, color: 'text-yellow-500' }
    }
    return { bg: 'bg-blue-500/10', icon: UserCheck, color: 'text-blue-500' }
  }

  const style = getIconStyle()
  const IconComponent = style.icon

  return (
    <div className={`flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 ${
      recognition?.isStranger ? 'border-yellow-500/30' : recognition ? 'border-blue-500/30' : ''
    }`}>
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-full ${style.bg}`}>
          <IconComponent className={`h-5 w-5 ${style.color}`} />
        </div>
        <div>
          {recognition ? (
            <>
              <p className="text-sm font-medium">
                {recognition.isStranger ? (
                  <span className="text-yellow-600">陌生人</span>
                ) : (
                  <span className="text-blue-600">{recognition.identityName || '未知身份'}</span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                匹配度 {recognition.confidence ? `${(recognition.confidence * 100).toFixed(0)}%` : '-'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">人脸 #{index + 1}</p>
              <p className="text-xs text-muted-foreground">
                检测置信度 {(face.confidence * 100).toFixed(1)}%
              </p>
            </>
          )}
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
