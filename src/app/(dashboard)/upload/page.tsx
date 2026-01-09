'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, ImageIcon, Loader2, CheckCircle, XCircle, Trash2, Scan, Users } from 'lucide-react'
import { useCallback, useState, useEffect } from 'react'
import { useUploadStore, type UploadItem } from '@/stores/upload-store'
import { useUploadImage } from '@/hooks/use-upload'
import { useImageFaceDetection } from '@/hooks/use-face-detection'
import { cn, formatFileSize } from '@/lib/utils'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

export default function UploadPage() {
  const [isDragging, setIsDragging] = useState(false)
  const [autoDetect, setAutoDetect] = useState(true)
  const { items, addItems, updateItem, removeItem, clearCompleted, setUploading, isUploading } = useUploadStore()
  const uploadMutation = useUploadImage()
  const { detectFromUrl, isLoading: isDetecting, isSaving } = useImageFaceDetection()

  // 处理文件上传和检测
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    if (isUploading) {
      toast.error('请等待当前上传完成')
      return
    }

    setUploading(true)

    for (const file of files) {
      // 找到对应的 item
      const item = items.find((i) => i.file.name === file.name && i.status === 'pending')
      if (!item) continue

      try {
        // 阶段1: 上传
        updateItem(item.id, { status: 'uploading', progress: 30 })

        const formData = new FormData()
        formData.set('file', file)

        const uploadResult = await uploadMutation.mutateAsync(formData)
        updateItem(item.id, { 
          status: autoDetect ? 'processing' : 'completed', 
          progress: autoDetect ? 60 : 100,
          imageId: uploadResult.id,
        })

        // 阶段2: 人脸检测
        if (autoDetect) {
          try {
            const detectResult = await detectFromUrl(
              uploadResult.id,
              uploadResult.filePath
            )
            
            updateItem(item.id, {
              status: 'completed',
              progress: 100,
              facesDetected: detectResult.facesDetected,
            })

            toast.success(
              `${file.name} 处理完成，检测到 ${detectResult.facesDetected} 张人脸`
            )
          } catch (detectError) {
            // 检测失败但上传成功
            updateItem(item.id, {
              status: 'completed',
              progress: 100,
              error: '人脸检测失败',
            })
            toast.warning(`${file.name} 上传成功，但人脸检测失败`)
          }
        } else {
          toast.success(`${file.name} 上传成功`)
        }
      } catch (error) {
        updateItem(item.id, {
          status: 'error',
          error: error instanceof Error ? error.message : '上传失败',
        })
        toast.error(`${file.name} 上传失败`)
      }
    }

    setUploading(false)
  }, [items, isUploading, autoDetect, updateItem, uploadMutation, detectFromUrl, setUploading])

  // 处理拖放
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('image/')
      )

      if (files.length === 0) {
        toast.error('请上传图片文件')
        return
      }

      // 先添加到队列
      addItems(files)
    },
    [addItems]
  )

  // 处理文件选择
  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (files.length === 0) return

      addItems(files)
      e.target.value = ''
    },
    [addItems]
  )

  // 开始处理队列中的 pending 文件
  const startProcessing = useCallback(() => {
    const pendingFiles = items.filter((i) => i.status === 'pending').map((i) => i.file)
    if (pendingFiles.length > 0) {
      processFiles(pendingFiles)
    }
  }, [items, processFiles])

  // 计算统计信息
  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    processing: items.filter((i) => i.status === 'uploading' || i.status === 'processing').length,
    completed: items.filter((i) => i.status === 'completed').length,
    error: items.filter((i) => i.status === 'error').length,
    totalFaces: items.reduce((sum, i) => sum + (i.facesDetected ?? 0), 0),
  }

  return (
    <>
      <Header title="上传管理" />
      <div className="flex-1 space-y-6 p-6">
        {/* 上传区域 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>上传图片</CardTitle>
              <CardDescription>
                拖拽图片到此区域或点击选择文件，支持批量上传
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-detect" className="text-sm">自动检测人脸</Label>
              <Switch
                id="auto-detect"
                checked={autoDetect}
                onCheckedChange={setAutoDetect}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50'
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <input
                id="file-input"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />
              <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
              <p className="mb-1 text-sm font-medium">
                拖拽图片到此处，或点击选择
              </p>
              <p className="text-xs text-muted-foreground">
                支持 JPG, PNG, WebP, GIF 格式
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 上传队列 */}
        {items.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>上传队列</CardTitle>
                <CardDescription>
                  {stats.completed} / {stats.total} 已完成
                  {stats.totalFaces > 0 && ` · 共检测到 ${stats.totalFaces} 张人脸`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                {stats.pending > 0 && (
                  <Button onClick={startProcessing} disabled={isUploading}>
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    开始上传 ({stats.pending})
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={clearCompleted}>
                  清除已完成
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 进度概览 */}
              {(stats.processing > 0 || isUploading) && (
                <div className="mb-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>处理进度</span>
                    <span>{stats.completed} / {stats.total}</span>
                  </div>
                  <Progress value={(stats.completed / stats.total) * 100} />
                </div>
              )}

              {/* 文件列表 */}
              <div className="space-y-2">
                {items.map((item) => (
                  <UploadItemRow
                    key={item.id}
                    item={item}
                    onRemove={() => removeItem(item.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 提示卡片 */}
        {items.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">开始上传图片</h3>
              <p className="text-sm text-muted-foreground text-center max-w-md">
                上传包含人脸的图片，系统将自动检测并提取人脸特征，
                然后通过聚类算法将相似人脸分组。
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}

function UploadItemRow({
  item,
  onRemove,
}: {
  item: UploadItem
  onRemove: () => void
}) {
  const statusConfig = {
    pending: { icon: ImageIcon, color: 'text-muted-foreground', label: '等待中', animate: false },
    uploading: { icon: Loader2, color: 'text-blue-500', label: '上传中', animate: true },
    processing: { icon: Scan, color: 'text-yellow-500', label: '检测中', animate: true },
    completed: { icon: CheckCircle, color: 'text-green-500', label: '完成', animate: false },
    error: { icon: XCircle, color: 'text-destructive', label: '失败', animate: false },
  }

  const config = statusConfig[item.status]
  const StatusIcon = config.icon

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
        <ImageIcon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{item.file.name}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatFileSize(item.file.size)}</span>
          {item.facesDetected !== undefined && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {item.facesDetected} 张人脸
              </span>
            </>
          )}
          {item.error && (
            <>
              <span>·</span>
              <span className="text-destructive">{item.error}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className={cn('gap-1', config.color)}>
          <StatusIcon className={cn('h-3 w-3', config.animate && 'animate-spin')} />
          {config.label}
        </Badge>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={onRemove}
          disabled={item.status === 'uploading' || item.status === 'processing'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
