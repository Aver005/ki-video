// Медиатека: список файлов, три вида отображения и добавление с диска.

import { useState } from 'react'
import { LayoutGrid, List, Plus, Rows3, type LucideIcon } from 'lucide-react'
import { TextField } from 'react-aria-components'
import { api } from '@shared/api/client'
import { notify } from '@shared/model/editor'
import { resizeLayout, useStore, type BinView } from '@shared/model/store'
import { Button } from '@shared/ui/button'
import { Input } from '@shared/ui/input'
import { SectionTitle } from '@shared/ui/kit/SectionTitle'
import { Toggle } from '@shared/ui/toggle'
import { AssetCard } from '@widgets/media-bin/ui/AssetCard'
import { FileBrowser } from '@widgets/media-bin/ui/FileBrowser'

async function importPaths(paths: string[]): Promise<boolean>
{
    if (paths.length === 0) return false
    try
    {
        await api.importPaths(paths)
        return true
    }
    catch (error)
    {
        notify(error instanceof Error ? error.message : 'Не удалось добавить')
        return false
    }
}

const VIEWS: { id: BinView; icon: LucideIcon; label: string }[] = [
    { id: 'list', icon: List, label: 'Списком' },
    { id: 'grid', icon: LayoutGrid, label: 'Плиткой' },
    { id: 'compact', icon: Rows3, label: 'Одной строкой' },
]

export function MediaBin()
{
    const assets = useStore((s) => s.assets)
    const progress = useStore((s) => s.assetProgress)
    const view = useStore((s) => s.binView)
    const [browser, setBrowser] = useState(false)
    const [path, setPath] = useState('')
    const list = Object.values(assets).sort((a, b) =>
        a.name.localeCompare(b.name),
    )

    const pickFiles = async () =>
    {
        try
        {
            const { paths } = await api.openDialog()
            await importPaths(paths)
        }
        catch
        {
            setBrowser(true)
        }
    }

    const submitPath = async () =>
    {
        if (await importPaths([path.trim()])) setPath('')
    }

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-2">
                <div className="flex items-baseline gap-1.5">
                    <SectionTitle>Файлы</SectionTitle>
                    <span className="font-mono text-xs text-muted-foreground">
                        {list.length}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    {VIEWS.map((v) => (
                        <Toggle
                            key={v.id}
                            size="sm"
                            isSelected={v.id === view}
                            onChange={() =>
                                resizeLayout({ binView: v.id }, true)
                            }
                            aria-label={v.label}
                        >
                            <v.icon />
                        </Toggle>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-1.5 px-3 pb-2">
                <TextField
                    aria-label="Путь к файлу"
                    className="flex-1"
                    value={path}
                    onChange={setPath}
                    onKeyDown={(e) =>
                    {
                        if (e.key !== 'Enter') return
                        e.preventDefault()
                        void submitPath()
                    }}
                >
                    <Input placeholder="или путь к файлу…" />
                </TextField>
                <span title="Выбрать файлы на диске" className="inline-flex">
                    <Button
                        variant="outline"
                        size="icon"
                        onPress={() => void pickFiles()}
                        aria-label="Добавить файлы"
                    >
                        <Plus />
                    </Button>
                </span>
            </div>
            <div
                className={
                    view === 'grid'
                        ? 'grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] content-start gap-2 overflow-y-auto px-2 pb-2'
                        : 'flex flex-col gap-1.5 overflow-y-auto px-2 pb-2'
                }
            >
                {list.length === 0 && (
                    <div className="px-2 py-6 text-center text-muted-foreground">
                        Добавь видео, картинки или музыку
                    </div>
                )}
                {list.map((asset) => (
                    <AssetCard
                        key={asset.id}
                        asset={asset}
                        view={view}
                        progress={progress[asset.id] ?? 0}
                    />
                ))}
            </div>
            {browser && (
                <FileBrowser
                    onClose={() => setBrowser(false)}
                    onPick={(paths) =>
                        void importPaths(paths).then(
                            (ok) => ok && setBrowser(false),
                        )
                    }
                />
            )}
        </div>
    )
}
