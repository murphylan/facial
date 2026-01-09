'use client'

import { useState, useEffect } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Camera, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface CameraDevice {
  deviceId: string
  label: string
}

interface CameraSelectorProps {
  value?: string
  onValueChange?: (deviceId: string) => void
  disabled?: boolean
  className?: string
}

export function CameraSelector({
  value,
  onValueChange,
  disabled,
  className,
}: CameraSelectorProps) {
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 获取摄像头列表
  const loadDevices = async () => {
    // 检查是否在浏览器环境且支持 mediaDevices API
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前环境不支持摄像头访问（需要 HTTPS）')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 首先请求权限
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      // 立即停止流，我们只是为了获取权限
      stream.getTracks().forEach(track => track.stop())

      // 获取设备列表
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `摄像头 ${index + 1}`,
        }))

      setDevices(videoDevices)

      // 如果没有选中的设备，选择第一个
      if (videoDevices.length > 0 && !value && onValueChange) {
        onValueChange(videoDevices[0].deviceId)
      }
    } catch (err) {
      setError('无法获取摄像头列表')
      console.error('Failed to enumerate devices:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDevices()

    // 检查是否支持 mediaDevices
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      return
    }

    // 监听设备变化
    const handleDeviceChange = () => {
      loadDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <Camera className="h-4 w-4" />
        <span>{error}</span>
        <Button variant="ghost" size="icon" onClick={loadDevices}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-[200px]">
          <Camera className="mr-2 h-4 w-4" />
          <SelectValue placeholder={isLoading ? '加载中...' : '选择摄像头'} />
        </SelectTrigger>
        <SelectContent>
          {devices.map(device => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon"
        onClick={loadDevices}
        disabled={isLoading}
        title="刷新摄像头列表"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
}

/**
 * 用于获取摄像头列表的 hook
 */
export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    // 检查是否在浏览器环境且支持 mediaDevices API
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('当前环境不支持摄像头访问（需要 HTTPS）')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // 请求权限
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop())

      // 获取设备
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = allDevices
        .filter(device => device.kind === 'videoinput')
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `摄像头 ${index + 1}`,
        }))

      setDevices(videoDevices)
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取摄像头失败')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    refresh()

    // 检查是否支持 mediaDevices
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      return
    }

    const handleChange = () => refresh()
    navigator.mediaDevices.addEventListener('devicechange', handleChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleChange)
    }
  }, [])

  return { devices, isLoading, error, refresh }
}
