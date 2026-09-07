import { describe, expect, test } from 'bun:test'
import { piecewiseLinear } from '@shared/ffmpeg/expr'
import { assColor, assTime, buildAss } from '@shared/ffmpeg/ass'
import {
    audioFilters,
    colorFilters,
    frameFilters,
    overlayFilters,
} from '@shared/ffmpeg/filters'
import {
    buildExportPlan,
    ExportError,
    GRAPH_FILE,
    GRAPH_OPTION,
    SOFTWARE_CAPS,
} from '@shared/ffmpeg/export-args'
import { createProject, NEUTRAL_COLOR, SILENT_AUDIO } from '@shared/model'
import type { BoxKeyframe, ColorKeyframe } from '@shared/model'
import type { Project } from '@shared/model'
import { num } from '@shared/math'
import {
    assetMap,
    imageAsset,
    item,
    musicAsset,
    project as makeProject,
    text,
    track,
    videoAsset,
} from './factory'

const asset = videoAsset
const output =
{
    width: 1080,
    height: 1920,
    fps: 60,
    codec: 'h264' as const,
    quality: 23,
}

describe('num', () =>
{
    test('без хвостовых нулей и экспоненты', () =>
    {
        expect(num(1)).toBe('1')
        expect(num(0.5)).toBe('0.5')
        expect(num(607.5)).toBe('607.5')
        expect(num(1e-7)).toBe('0')
        expect(num(-0.00001)).toBe('0')
        expect(num(-12.25)).toBe('-12.25')
    })
})

describe('piecewiseLinear', () =>
{
    test('одна точка — константа', () =>
    {
        expect(piecewiseLinear([{ t: 0, v: 5 }], 't')).toBe('5')
    })
    test('одинаковые значения — константа', () =>
    {
        expect(
            piecewiseLinear(
                [
                    { t: 0, v: 5 },
                    { t: 2, v: 5 },
                ],
                't',
            ),
        ).toBe('5')
    })
    test('первая точка не в нуле: до неё держится её значение', () =>
    {
        expect(
            piecewiseLinear(
                [
                    { t: 1, v: 100 },
                    { t: 3, v: 300 },
                ],
                't',
            ),
        ).toBe('if(lt(t,1),100,if(lt(t,3),100+(300-100)*(t-1)/2,300))')
    })
    test('три точки от нуля — вложенные if без обёртки', () =>
    {
        const expr = piecewiseLinear(
            [
                { t: 0, v: 0 },
                { t: 1, v: 10 },
                { t: 2, v: 0 },
            ],
            'it',
        )
        expect(expr).toBe(
            'if(lt(it,1),0+(10-0)*(it-0)/1,if(lt(it,2),10+(0-10)*(it-1)/1,0))',
        )
    })
})

describe('ass', () =>
{
    test('цвет в формате &HAABBGGRR, короткая запись раскрывается', () =>
    {
        expect(assColor('#ffe600')).toBe('&H0000E6FF')
        expect(assColor('#000000', 128)).toBe('&H80000000')
        expect(assColor('#fff')).toBe('&H00FFFFFF')
    })
    test('время без потери сотых', () =>
    {
        expect(assTime(61.5)).toBe('0:01:01.50')
        expect(assTime(0.29)).toBe('0:00:00.29')
    })
    test('файл содержит стили, реплики и текстовые элементы дорожек', () =>
    {
        const project = makeProject([
            track('content', []),
            track('overlay', [
                text(
                {
                    id: 't',
                    text: 'Заголовок {x}',
                    start: 1,
                    duration: 1,
                    size: 96,
                    animation: 'pop',
                }),
            ]),
        ])
        project.subtitles.cues.push(
        {
            id: 'c',
            start: 0,
            end: 1,
            text: 'Привет\nмир',
        })
        const ass = buildAss(project)
        expect(ass).toContain('PlayResX: 1080')
        expect(ass).toContain('Style: Sub,Arial,72,')
        expect(ass).toContain(
            'Dialogue: 0,0:00:00.00,0:00:01.00,Sub,,0,0,0,,{\\an5\\pos(540,1536)}Привет\\Nмир',
        )
        expect(ass).toContain('Dialogue: 1,0:00:01.00,0:00:02.00,Text')
        expect(ass).toContain('\\pos(540,384)\\fs96')
        expect(ass).toContain('Заголовок x')
    })
    test('скрытая дорожка в ASS не попадает', () =>
    {
        const hidden = { ...track('overlay', [text()]), hidden: true }
        expect(buildAss(makeProject([hidden]))).not.toContain('Dialogue: 1')
    })
})

describe('filters', () =>
{
    test('без ключей: статичный crop по центру с exact=1, без zoompan', () =>
    {
        expect(frameFilters(item(), asset, output)).toEqual([
            'fps=60',
            "crop=606:1080:'clip(864-303,0,1122)':'clip(540-540,0,0)':exact=1",
            'scale=1080:1920:flags=bicubic',
        ])
    })
    test('панорама даёт выражение по t, зум добавляет zoompan по it', () =>
    {
        const f = frameFilters(
            item(
            {
                frame: [
                    { t: 0, cx: 400, cy: 540, zoom: 1 },
                    { t: 2, cx: 1200, cy: 540, zoom: 2 },
                ],
            }),
            asset,
            output,
        )
        expect(f[1]).toContain(
            "crop=606:1080:'clip(if(lt(t,2),400+(1200-400)*(t-0)/2,1200)-303,0,1122)'",
        )
        expect(f[3]).toStartWith(
            "zoompan=z='clip(if(lt(it,2),1+(2-1)*(it-0)/2,2),1,8)'",
        )
        expect(f[3]).toContain('d=1:s=1080x1920:fps=60')
    })
    test('наложение: масштаб по доле кадра, поворот с прозрачным фоном, сдвиг во времени', () =>
    {
        const placement = overlayFilters(
            item(
            {
                assetId: imageAsset.id,
                start: 2,
                duration: 3,
                fadeIn: 0.5,
                box:
                {
                    x: 0.5,
                    y: 0.25,
                    width: 0.25,
                    rotation: 90,
                    opacity: 0.5,
                },
            }),
            imageAsset,
            output,
        )
        expect(placement.filters).toEqual([
            'fps=60',
            'scale=270:270:flags=bicubic',
            'format=yuva420p',
            "rotate=1.5708:c=black@0:ow='rotw(1.5708)':oh='roth(1.5708)'",
            'colorchannelmixer=aa=0.5',
            'fade=t=in:st=0:d=0.5:alpha=1',
            'setpts=PTS-STARTPTS+2/TB',
        ])
        expect(placement.x).toBe('(0.5)*W-w/2')
        expect(placement.y).toBe('(0.25)*H-h/2')
    })
    test('ключи наложения дают выражения по времени вместо чисел', () =>
    {
        const keys: BoxKeyframe[] = [
            { t: 0, x: 0.2, y: 0.5, width: 0.2, rotation: 0, opacity: 1 },
            { t: 2, x: 0.8, y: 0.5, width: 0.4, rotation: 90, opacity: 0.5 },
        ]
        const placement = overlayFilters(
            item(
            {
                assetId: imageAsset.id,
                start: 1,
                duration: 2,
                boxKeys: keys,
            }),
            imageAsset,
            output,
        )
        const chain = placement.filters.join(' | ')
        expect(chain).toContain('eval=frame')
        expect(chain).toContain("rotate=a='if(lt(t,2)")
        expect(chain).toContain('geq=lum=')
        // Ключи по x идут по шкале базы, поэтому сдвинуты на начало элемента.
        expect(placement.x).toContain('if(lt(t,3)')
        expect(placement.x).toEndWith('*W-w/2')
        expect(placement.y).toBe('(0.5)*H-h/2')
    })
    test('ключи с одинаковыми значениями остаются неподвижными фильтрами', () =>
    {
        const same: BoxKeyframe[] = [
            { t: 0, x: 0.5, y: 0.5, width: 0.25, rotation: 0, opacity: 1 },
            { t: 2, x: 0.5, y: 0.5, width: 0.25, rotation: 0, opacity: 1 },
        ]
        const placement = overlayFilters(
            item({ assetId: imageAsset.id, duration: 2, boxKeys: same }),
            imageAsset,
            output,
        )
        expect(placement.filters).toEqual([
            'fps=60',
            'scale=270:270:flags=bicubic',
            'format=yuva420p',
            'setpts=PTS-STARTPTS+0/TB',
        ])
    })
    test('ключи цвета включают eq с выражениями, сочность остаётся постоянной', () =>
    {
        const keys: ColorKeyframe[] = [
            { t: 0, ...NEUTRAL_COLOR, vibrance: 0.3 },
            { t: 4, ...NEUTRAL_COLOR, contrast: 1.5, vibrance: 0.3 },
        ]
        const filters = colorFilters(NEUTRAL_COLOR, keys)
        expect(filters[0]).toStartWith("eq=brightness='0'")
        expect(filters[0]).toContain(
            "contrast='if(lt(t,4),1+(1.5-1)*(t-0)/4,1.5)'",
        )
        expect(filters[0]).toEndWith(':eval=frame')
        expect(filters[1]).toBe('vibrance=intensity=0.3')
    })
    test('нейтральный цвет — пусто, пресет даёт eq/vibrance/unsharp', () =>
    {
        expect(colorFilters(NEUTRAL_COLOR)).toEqual([])
        expect(
            colorFilters(
            {
                brightness: 0,
                contrast: 1.2,
                saturation: 1,
                gamma: 1,
                vibrance: 0.3,
                sharpen: 0.5,
            }),
        ).toEqual([
            'eq=brightness=0:contrast=1.2:saturation=1:gamma=1',
            'vibrance=intensity=0.3',
            'unsharp=5:5:0.5:5:5:0',
        ])
    })
    test('звук: тишина — пусто, цепочка — по порядку', () =>
    {
        expect(audioFilters(SILENT_AUDIO)).toEqual([])
        expect(
            audioFilters(
            {
                denoise: 0.5,
                highpass: true,
                compressor: true,
                loudness: -14,
            }),
        ).toEqual([
            'highpass=f=80',
            'afftdn=nr=18:nf=-40:tn=1',
            'acompressor=threshold=-18dB:ratio=3:attack=5:release=60:makeup=2',
            'loudnorm=I=-14:TP=-1.5:LRA=11',
        ])
    })
})

describe('buildExportPlan', () =>
{
    const plan = (project: Project, ass: string | null = null) =>
        buildExportPlan(project, assetMap, SOFTWARE_CAPS, 'out.mp4', ass)

    test('пустой проект — ошибка', () =>
    {
        expect(() => plan(createProject('p'))).toThrow(ExportError)
    })

    test('элемент длиннее исходника — ошибка', () =>
    {
        expect(() =>
            plan(
                makeProject([
                    track('content', [item({ offset: 28, duration: 5 })]),
                ]),
            ),
        ).toThrow(ExportError)
    })

    test('два элемента подряд склеиваются concat, граф уходит в файл, ass подключается', () =>
    {
        const project = makeProject([
            track('content', [
                item({ id: 'c1', start: 0, duration: 3, offset: 2 }),
                item({ id: 'c2', start: 3, duration: 2, offset: 10 }),
            ]),
        ])
        const result = buildExportPlan(
            project,
            assetMap,
            {
                encoders: { h264: 'h264_nvenc', hevc: 'hevc_nvenc' },
                hwaccel: 'cuda',
            },
            'out.mp4',
            'subs.ass',
        )
        expect(result.duration).toBe(5)
        expect(
            result.args.slice(
                result.args.indexOf('-ss'),
                result.args.indexOf('-ss') + 6,
            ),
        ).toEqual(['-ss', '2', '-t', '3', '-i', 'E:/clip.mp4'])
        expect(result.args).toContain('-hwaccel')
        expect(result.args[result.args.indexOf(GRAPH_OPTION) + 1]).toBe(
            GRAPH_FILE,
        )
        expect(result.graph).toContain('[bs0][bs1]concat=n=2:v=1:a=0[bx1]')
        expect(result.graph).toContain('ass=subs.ass,copy[vo]')
        expect(result.args).toContain('h264_nvenc')
        expect(result.args).not.toContain('hvc1')
        expect(result.args[result.args.length - 1]).toBe('out.mp4')
    })

    test('зазор перед элементом заполняется чёрным', () =>
    {
        const result = plan(
            makeProject([
                track('content', [item({ id: 'c1', start: 2, duration: 3 })]),
            ]),
        )
        expect(result.graph).toContain(
            'color=c=black:s=1080x1920:r=60:d=2,format=yuv420p,setsar=1[bs0]',
        )
        expect(result.duration).toBe(5)
    })

    test('наезд элементов даёт xfade со смещением и кроссфейд звука', () =>
    {
        const result = plan(
            makeProject([
                track('content', [
                    item({ id: 'c1', start: 0, duration: 4 }),
                    item(
                    {
                        id: 'c2',
                        start: 3,
                        duration: 4,
                        transition: 'slideleft',
                    }),
                ]),
            ]),
        )
        expect(result.graph).toContain(
            '[bs0][bs1]xfade=transition=slideleft:duration=1:offset=3[bx1]',
        )
        expect(result.graph).toContain('afade=t=out:st=3:d=1')
        expect(result.graph).toContain('afade=t=in:st=0:d=1')
        expect(result.duration).toBe(7)
    })

    test('картинка идёт входом с -loop, наложение ложится поверх базы', () =>
    {
        const result = plan(
            makeProject([
                track('content', [item({ id: 'c1', duration: 4 })]),
                track('overlay', [
                    item(
                    {
                        id: 'o1',
                        assetId: imageAsset.id,
                        start: 1,
                        duration: 2,
                    }),
                ]),
            ]),
        )
        expect(result.args).toContain('-loop')
        expect(result.graph).toContain(
            "overlay=x='(0.5)*W-w/2':y='(0.5)*H-h/2':eof_action=pass:enable='between(t,1,3)'[bo0]",
        )
    })

    test('музыка с дорожки звука подмешивается, громкость и сдвиг на месте', () =>
    {
        const result = plan(
            makeProject([
                track('content', [item({ id: 'c1', duration: 10 })]),
                track('audio', [
                    item(
                    {
                        id: 'm',
                        assetId: musicAsset.id,
                        start: 2,
                        duration: 5,
                        volume: 0.4,
                    }),
                ]),
            ]),
        )
        expect(result.graph).toContain('volume=0.4')
        expect(result.graph).toContain('adelay=2000:all=1')
        expect(result.graph).toContain('amix=inputs=2:normalize=0')
    })

    test('без звука вообще граф берёт тишину', () =>
    {
        const silent = new Map(assetMap)
        silent.set(asset.id, { ...asset, audioCodec: null })
        const result = buildExportPlan(
            makeProject([track('content', [item({ id: 'c1', duration: 2 })])]),
            silent,
            SOFTWARE_CAPS,
            'out.mp4',
            null,
        )
        expect(result.graph).toContain('anullsrc=r=48000:cl=stereo,atrim=0:2')
        expect(result.args).toContain('libx264')
    })

    test('hevc получает тег hvc1 и на nvenc, и на libx265', () =>
    {
        const project = makeProject([
            track('content', [item({ id: 'c1', duration: 1 })]),
        ])
        project.output.codec = 'hevc'
        expect(
            buildExportPlan(
                project,
                assetMap,
                {
                    encoders: { h264: 'h264_nvenc', hevc: 'hevc_nvenc' },
                    hwaccel: 'cuda',
                },
                'o.mp4',
                null,
            ).args,
        ).toContain('hvc1')
        expect(
            buildExportPlan(project, assetMap, SOFTWARE_CAPS, 'o.mp4', null)
                .args,
        ).toContain('libx265')
    })

    test('скрытая дорожка не попадает в граф', () =>
    {
        const overlay =
        {
            ...track('overlay', [
                item({ id: 'o1', assetId: imageAsset.id, duration: 2 }),
            ]),
            hidden: true,
        }
        const result = plan(
            makeProject([
                track('content', [item({ id: 'c1', duration: 4 })]),
                overlay,
            ]),
        )
        expect(result.graph).not.toContain('overlay=')
    })
})
