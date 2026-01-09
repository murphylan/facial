'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIdentities } from '@/hooks/use-identities'

interface IdentitySelectorProps {
  value?: string
  onValueChange?: (value: string) => void
  onCreateNew?: () => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function IdentitySelector({
  value,
  onValueChange,
  onCreateNew,
  placeholder = '选择身份',
  disabled,
  className,
}: IdentitySelectorProps) {
  const [open, setOpen] = useState(false)
  const { data: identities, isLoading } = useIdentities()

  const selectedIdentity = identities?.find((i) => i.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className)}
          disabled={disabled || isLoading}
        >
          {selectedIdentity ? (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedIdentity.avatarPath ?? undefined} />
                <AvatarFallback className="text-xs">
                  {selectedIdentity.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <span>{selectedIdentity.name}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="搜索身份..." />
          <CommandList>
            <CommandEmpty>未找到匹配的身份</CommandEmpty>
            <CommandGroup>
              {identities?.map((identity) => (
                <CommandItem
                  key={identity.id}
                  value={identity.name}
                  onSelect={() => {
                    onValueChange?.(identity.id)
                    setOpen(false)
                  }}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={identity.avatarPath ?? undefined} />
                      <AvatarFallback className="text-xs">
                        {identity.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <span>{identity.name}</span>
                      {identity.description && (
                        <span className="text-xs text-muted-foreground ml-2">
                          {identity.description}
                        </span>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      'ml-auto h-4 w-4',
                      value === identity.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            {onCreateNew && (
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onCreateNew()
                    setOpen(false)
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  创建新身份
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
