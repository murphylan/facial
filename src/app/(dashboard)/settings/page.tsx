'use client'

import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { useSettingsStore } from '@/stores/settings-store'
import { useCameras, useCreateCamera, useDeleteCamera } from '@/hooks/use-cameras'
import { Camera, Plus, Trash2, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export default function SettingsPage() {
  const settings = useSettingsStore()
  const { data: cameras, isLoading: camerasLoading } = useCameras()
  const createCameraMutation = useCreateCamera()
  const deleteCameraMutation = useDeleteCamera()

  const [newCameraName, setNewCameraName] = useState('')

  const handleAddCamera = async () => {
    if (!newCameraName.trim()) return

    try {
      await createCameraMutation.mutateAsync({
        name: newCameraName.trim(),
        type: 'local',
      })
      toast.success('摄像头添加成功')
      setNewCameraName('')
    } catch (error) {
      toast.error('添加失败')
    }
  }

  const handleDeleteCamera = async (id: string) => {
    if (!confirm('确定要删除这个摄像头吗？')) return

    try {
      await deleteCameraMutation.mutateAsync(id)
      toast.success('摄像头已删除')
    } catch (error) {
      toast.error('删除失败')
    }
  }

  const handleResetSettings = () => {
    if (!confirm('确定要重置所有设置吗？')) return
    settings.resetToDefaults()
    toast.success('设置已重置')
  }

  return (
    <>
      <Header title="系统设置" />
      <div className="flex-1 space-y-6 p-6">
        {/* 识别设置 */}
        <Card>
          <CardHeader>
            <CardTitle>识别设置</CardTitle>
            <CardDescription>
              调整人脸识别和聚类的参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>识别阈值: {settings.recognitionThreshold}</Label>
                <Input
                  type="range"
                  min="0.3"
                  max="0.9"
                  step="0.05"
                  value={settings.recognitionThreshold}
                  onChange={(e) =>
                    settings.setRecognitionThreshold(parseFloat(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  值越高，匹配越严格
                </p>
              </div>

              <div className="space-y-2">
                <Label>聚类阈值: {settings.clusteringThreshold}</Label>
                <Input
                  type="range"
                  min="0.3"
                  max="0.9"
                  step="0.05"
                  value={settings.clusteringThreshold}
                  onChange={(e) =>
                    settings.setClusteringThreshold(parseFloat(e.target.value))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  值越高，聚类越严格
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>最小人脸尺寸 (px)</Label>
                <Input
                  type="number"
                  min="20"
                  max="200"
                  value={settings.minFaceSize}
                  onChange={(e) =>
                    settings.setMinFaceSize(parseInt(e.target.value) || 50)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>每帧最大检测数</Label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={settings.maxFacesPerFrame}
                  onChange={(e) =>
                    settings.setMaxFacesPerFrame(parseInt(e.target.value) || 10)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>检测间隔 (ms)</Label>
                <Input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={settings.detectionInterval}
                  onChange={(e) =>
                    settings.setDetectionInterval(parseInt(e.target.value) || 100)
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 显示设置 */}
        <Card>
          <CardHeader>
            <CardTitle>显示设置</CardTitle>
            <CardDescription>
              调整界面显示选项
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>显示检测框</Label>
                <p className="text-sm text-muted-foreground">
                  在摄像头预览中显示人脸边框
                </p>
              </div>
              <Switch
                checked={settings.showBoundingBoxes}
                onCheckedChange={settings.setShowBoundingBoxes}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>显示置信度</Label>
                <p className="text-sm text-muted-foreground">
                  显示检测和识别的置信度
                </p>
              </div>
              <Switch
                checked={settings.showConfidence}
                onCheckedChange={settings.setShowConfidence}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>显示年龄/性别</Label>
                <p className="text-sm text-muted-foreground">
                  显示预估的年龄和性别
                </p>
              </div>
              <Switch
                checked={settings.showAgeGender}
                onCheckedChange={settings.setShowAgeGender}
              />
            </div>
          </CardContent>
        </Card>

        {/* 摄像头管理 */}
        <Card>
          <CardHeader>
            <CardTitle>摄像头管理</CardTitle>
            <CardDescription>
              管理系统中的摄像头
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 添加摄像头 */}
            <div className="flex gap-2">
              <Input
                placeholder="摄像头名称"
                value={newCameraName}
                onChange={(e) => setNewCameraName(e.target.value)}
              />
              <Button
                onClick={handleAddCamera}
                disabled={!newCameraName.trim() || createCameraMutation.isPending}
              >
                <Plus className="mr-2 h-4 w-4" />
                添加
              </Button>
            </div>

            {/* 摄像头列表 */}
            {camerasLoading ? (
              <p className="text-muted-foreground">加载中...</p>
            ) : !cameras || cameras.length === 0 ? (
              <p className="text-muted-foreground">暂无摄像头</p>
            ) : (
              <div className="space-y-2">
                {cameras.map((camera) => (
                  <div
                    key={camera.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Camera className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {camera.type === 'local'
                            ? '本地摄像头'
                            : camera.type === 'remote'
                            ? '远程摄像头'
                            : 'IP 摄像头'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCamera(camera.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 重置设置 */}
        <Card>
          <CardHeader>
            <CardTitle>重置设置</CardTitle>
            <CardDescription>
              将所有设置恢复为默认值
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleResetSettings}>
              <RotateCcw className="mr-2 h-4 w-4" />
              重置为默认设置
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
