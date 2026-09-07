import { useState } from 'react'
import { api } from '@app/api'
import { useStore } from '@app/store/store'
import { notify } from '@app/store/actions'
import { AssetCard } from '@app/components/AssetCard'
import { FileBrowser } from '@app/components/FileBrowser'

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

export function MediaBin()
{
    const assets = useStore((s) => s.assets)
    const progress = useStore((s) => s.assetProgress)
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
        <div className="bin">
            <div className="bin__head">
                <span className="section-title">Файлы</span>
                <button className="btn" onClick={() => void pickFiles()}>
                    Добавить
                </button>
            </div>
            <form
                className="bin__path"
                onSubmit={(e) =>
                {
                    e.preventDefault()
                    void submitPath()
                }}
            >
                <input
                    value={path}
                    onChange={(e) => setPath(e.target.value)}
                    placeholder="или путь к файлу…"
                    aria-label="Путь к файлу"
                />
            </form>
            <div className="bin__list">
                {list.length === 0 && (
                    <div className="muted bin__empty">
                        Добавь ShadowPlay-клипы, чтобы начать
                    </div>
                )}
                {list.map((asset) => (
                    <AssetCard
                        key={asset.id}
                        asset={asset}
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
