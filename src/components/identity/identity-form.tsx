'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2 } from 'lucide-react'

export interface IdentityFormData {
  name: string
  description: string
}

interface IdentityFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: IdentityFormData) => Promise<void>
  initialData?: IdentityFormData
  title?: string
  description?: string
  submitLabel?: string
  isLoading?: boolean
}

export function IdentityFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  title = '创建身份',
  description = '创建一个新的身份用于关联人脸聚类',
  submitLabel = '创建',
  isLoading,
}: IdentityFormProps) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [desc, setDesc] = useState(initialData?.description ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    await onSubmit({
      name: name.trim(),
      description: desc.trim(),
    })

    // 重置表单
    if (!initialData) {
      setName('')
      setDesc('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">姓名 *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="输入姓名"
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">备注</Label>
              <Input
                id="description"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="可选备注信息"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
