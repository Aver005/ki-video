import { useState } from 'react'
import { getState, useStore } from '@app/store/store'
import { setCues, update } from '@app/store/actions'
import { Slider } from '@app/components/Slider'
import { SUBTITLE_STYLES } from '@shared/presets'
import { parseCues, printSimple } from '@shared/subtitles'
import type { SubtitlePreset } from '@shared/model'

const PRESET_IDS = Object.keys(SUBTITLE_STYLES) as SubtitlePreset[]

export function SubtitlesTab()
{
    const subtitles = useStore((s) => s.project?.subtitles)
    const cuesKey = subtitles ? printSimple(subtitles.cues) : ''
    const [draft, setDraft] = useState(cuesKey)
    const [syncedKey, setSyncedKey] = useState(cuesKey)

    // Реплики, изменённые извне, перебивают черновик в поле ввода.
    if (cuesKey !== syncedKey)
    {
        setSyncedKey(cuesKey)
        setDraft(cuesKey)
    }
    if (!subtitles) return null

    const addAtPlayhead = () =>
    {
        const time = getState().time
        setCues(
            [
                ...subtitles.cues,
                {
                    id: crypto.randomUUID(),
                    start: time,
                    end: time + 2,
                    text: 'Реплика',
                },
            ].sort((a, b) => a.start - b.start),
        )
    }

    return (
        <div className="tab-body">
            <div className="presets">
                {PRESET_IDS.map((id) => (
                    <button
                        key={id}
                        className={`chip ${subtitles.preset === id ? 'chip--active' : ''}`}
                        onClick={() =>
                            update((p) =>
                            {
                                p.subtitles.preset = id
                            })
                        }
                    >
                        {SUBTITLE_STYLES[id].label}
                    </button>
                ))}
            </div>
            <Slider
                label="Высота"
                value={subtitles.y}
                min={0.1}
                max={0.95}
                onChange={(v, final) =>
                    update((p) =>
                    {
                        p.subtitles.y = v
                    }, final)
                }
            />
            <div className="row-actions">
                <button className="btn" onClick={addAtPlayhead}>
                    + Реплика под курсором
                </button>
            </div>
            <textarea
                className="cues"
                rows={10}
                value={draft}
                placeholder={
                    'старт конец текст\n0.5 2.0 Привет\n2 4 Смотри что будет\n\nили вставь SRT'
                }
                onChange={(e) => setDraft(e.target.value)}
                spellCheck={false}
            />
            <div className="row-actions">
                <button
                    className="btn btn--primary"
                    onClick={() => setCues(parseCues(draft))}
                    disabled={draft === cuesKey}
                >
                    Применить
                </button>
                <span className="muted">{subtitles.cues.length} реплик</span>
            </div>
            <p className="muted">
                Распознавание речи не встроено: вставь SRT из любого сервиса.
            </p>
        </div>
    )
}
