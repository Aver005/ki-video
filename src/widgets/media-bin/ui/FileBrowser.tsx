// Свой проводник: открывается, когда системный диалог недоступен.

import { useEffect, useState } from 'react'
import { ArrowUp, Folder, Plus } from 'lucide-react'
import type { FsListing } from '@core/api'
import { api } from '@shared/api/client'
import { Button } from '@shared/ui/button'
import { CheckboxField } from '@shared/ui/kit/CheckboxField'
import {
    Dialog,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@shared/ui/dialog'
import { Input } from '@shared/ui/input'
import { TextField } from 'react-aria-components'

export interface FileBrowserProps
{
    onPick: (paths: string[]) => void
    onClose: () => void
}

function formatSize(bytes: number): string
{
    return bytes > 1 << 30
        ? `${(bytes / (1 << 30)).toFixed(1)} ГБ`
        : `${Math.round(bytes / (1 << 20))} МБ`
}

export function FileBrowser({ onPick, onClose }: FileBrowserProps)
{
    const [listing, setListing] = useState<FsListing | null>(null)
    const [chosen, setChosen] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)

    const open = (dir?: string) =>
    {
        api.listDir(dir)
            .then((l) =>
            {
                setListing(l)
                setError(null)
            })
            .catch((e: unknown) =>
                setError(e instanceof Error ? e.message : 'Не открылось'),
            )
    }

    useEffect(() =>
    {
        open()
    }, [])

    const toggle = (path: string) =>
    {
        setChosen((prev) =>
        {
            const next = new Set(prev)
            if (next.has(path)) next.delete(path)
            else next.add(path)
            return next
        })
    }

    return (
        <Dialog
            isOpen
            onOpenChange={(open) => !open && onClose()}
            className="sm:max-w-xl"
        >
            <DialogHeader>
                <DialogTitle>Выбор файлов</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon"
                    isDisabled={!listing?.parent}
                    onPress={() => open(listing?.parent ?? undefined)}
                    aria-label="Вверх"
                >
                    <ArrowUp />
                </Button>
                <TextField
                    aria-label="Папка"
                    className="flex-1"
                    value={listing?.dir ?? ''}
                    onChange={(dir) =>
                        setListing((l) => (l ? { ...l, dir } : l))
                    }
                    onKeyDown={(e) => e.key === 'Enter' && open(listing?.dir)}
                >
                    <Input />
                </TextField>
            </div>
            {error && <div className="text-destructive">{error}</div>}
            <div className="flex max-h-[50vh] flex-col gap-0.5 overflow-y-auto">
                {listing?.entries.map((entry) =>
                    entry.kind === 'dir' ? (
                        <Button
                            key={entry.path}
                            variant="ghost"
                            className="justify-start"
                            onPress={() => open(entry.path)}
                        >
                            <Folder />
                            {entry.name}
                        </Button>
                    ) : (
                        <CheckboxField
                            key={entry.path}
                            isSelected={chosen.has(entry.path)}
                            onChange={() => toggle(entry.path)}
                            className="rounded-lg px-2.5 py-1.5 hover:bg-muted"
                        >
                            <span className="min-w-0 flex-1 truncate">
                                {entry.name}
                            </span>
                            <span className="text-muted-foreground">
                                {formatSize(entry.size)}
                            </span>
                        </CheckboxField>
                    ),
                )}
            </div>
            <DialogFooter>
                <Button variant="ghost" onPress={onClose}>
                    Отмена
                </Button>
                <Button
                    isDisabled={chosen.size === 0}
                    onPress={() => onPick([...chosen])}
                >
                    <Plus />
                    Добавить {chosen.size > 0 ? chosen.size : ''}
                </Button>
            </DialogFooter>
        </Dialog>
    )
}
