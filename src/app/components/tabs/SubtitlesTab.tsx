import { useState } from 'react'
import { Check, Plus, Trash } from 'lucide-react'
import { getState, useStore } from '@shared/model/store'
import { removeCue, setCues, update, updateCue } from '@app/store/actions'
import { SliderField } from '@shared/ui/kit/SliderField'
import { NumberField } from '@shared/ui/kit/NumberField'
import { SUBTITLE_STYLES } from '@core/presets'
import { parseCues, printSimple } from '@core/subtitles'
import type { SubtitleCue, SubtitlePreset } from '@core/model'

const PRESET_IDS = Object.keys(SUBTITLE_STYLES) as SubtitlePreset[]

/** Правка выделенной реплики: то же, что тянуть её за края на таймлайне. */
function CueEditor({ cue }: { cue: SubtitleCue })
{
    return (
        <div className="editor">
            <textarea
                value={cue.text}
                rows={2}
                aria-label="Текст реплики"
                onChange={(e) =>
                    updateCue(cue.id, { text: e.target.value }, false)
                }
                onBlur={() => updateCue(cue.id, {}, true)}
            />
            <div className="field-row">
                <NumberField
                    label="Начало, с"
                    className="flex-1"
                    value={cue.start}
                    min={0}
                    step={0.1}
                    onChange={(start) =>
                        updateCue(cue.id,
                        {
                            start,
                            end: Math.max(cue.end, start + 0.1),
                        })
                    }
                />
                <NumberField
                    label="Конец, с"
                    className="flex-1"
                    value={cue.end}
                    min={cue.start + 0.1}
                    step={0.1}
                    onChange={(end) => updateCue(cue.id, { end })}
                />
            </div>
            <button
                className="btn btn--danger"
                onClick={() => removeCue(cue.id)}
            >
                <Trash />
                Удалить реплику
            </button>
        </div>
    )
}

export function SubtitlesTab()
{
    const subtitles = useStore((s) => s.project?.subtitles)
    const selection = useStore((s) => s.selection)
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
    const selected =
        selection?.kind === 'cue'
            ? subtitles.cues.find((c) => c.id === selection.id)
            : undefined

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
            <SliderField
                label="Высота"
                value={subtitles.y}
                min={0.1}
                max={0.95}
                neutral={0.8}
                onChange={(v, final) =>
                    update((p) =>
                    {
                        p.subtitles.y = v
                    }, final)
                }
            />
            <div className="row-actions">
                <button className="btn" onClick={addAtPlayhead}>
                    <Plus />
                    Реплика под курсором
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
                    <Check />
                    Применить
                </button>
                <span className="muted">{subtitles.cues.length} реплик</span>
            </div>
            {selected && <CueEditor cue={selected} />}
            <p className="muted">
                Распознавание речи не встроено: вставь SRT из любого сервиса.
            </p>
        </div>
    )
}
