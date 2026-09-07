import { describe, expect, test } from 'bun:test'
import { piecewiseLinear } from '@shared/ffmpeg/expr'
import { assColor, assTime, buildAss } from '@shared/ffmpeg/ass'
import {
    audioFilters,
    colorFilters,
    frameFilters,
} from '@shared/ffmpeg/filters'
import {
    buildExportPlan,
    ExportError,
    GRAPH_FILE,
    SOFTWARE_CAPS,
} from '@shared/ffmpeg/export-args'
import {
    createProject,
    NEUTRAL_COLOR,
    SILENT_AUDIO,
    type MediaAsset,
} from '@shared/model'
import { num } from '@shared/math'

const asset: MediaAsset =
{
    id: 'a1',
    name: 'clip.mp4',
    path: 'E:/clip.mp4',
    duration: 30,
    width: 1728,
    height: 1080,
    fps: 60,
    videoCodec: 'hevc',
    audioCodec: 'aac',
    status: 'ready',
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
    test('файл содержит стили, реплики и текстовые слои', () =>
    {
        const project = createProject('p')
        project.subtitles.cues.push(
        {
            id: 'c',
            start: 0,
            end: 1,
            text: 'Привет\nмир',
        })
        project.texts.push(
        {
            id: 't',
            text: 'Заголовок {x}',
            start: 1,
            end: 2,
            x: 0.5,
            y: 0.2,
            size: 96,
            color: '#ffffff',
            outline: '#000000',
            animation: 'pop',
        })
        const ass = buildAss(project)
        expect(ass).toContain('PlayResX: 1080')
        expect(ass).toContain('Style: Sub,Arial,72,')
        expect(ass).toContain(
            'Dialogue: 0,0:00:00.00,0:00:01.00,Sub,,0,0,0,,{\\an5\\pos(540,1536)}Привет\\Nмир',
        )
        expect(ass).toContain('\\pos(540,384)\\fs96')
        expect(ass).toContain('Заголовок x')
    })
})

describe('filters', () =>
{
    const output =
    {
        width: 1080,
        height: 1920,
        fps: 60,
        codec: 'h264' as const,
        quality: 23,
    }
    test('без ключей: статичный crop по центру с exact=1, без zoompan', () =>
    {
        const f = frameFilters(
            { id: 'c', assetId: 'a1', in: 0, out: 5, frame: [] },
            asset,
            output,
        )
        expect(f).toEqual([
            'fps=60',
            "crop=606:1080:'clip(864-303,0,1122)':'clip(540-540,0,0)':exact=1",
            'scale=1080:1920:flags=bicubic',
        ])
    })
    test('панорама даёт выражение по t, зум добавляет zoompan по it', () =>
    {
        const f = frameFilters(
            {
                id: 'c',
                assetId: 'a1',
                in: 0,
                out: 5,
                frame: [
                    { t: 0, cx: 400, cy: 540, zoom: 1 },
                    { t: 2, cx: 1200, cy: 540, zoom: 2 },
                ],
            },
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
    const assets = new Map([[asset.id, asset]])
    test('пустой проект — ошибка', () =>
    {
        expect(() =>
            buildExportPlan(
                createProject('p'),
                assets,
                SOFTWARE_CAPS,
                'out.mp4',
                null,
            ),
        ).toThrow(ExportError)
    })
    test('два клипа склеиваются concat, граф уходит в файл, ass подключается, кодек по caps', () =>
    {
        const project = createProject('p')
        project.clips.push(
            { id: 'c1', assetId: 'a1', in: 2, out: 5, frame: [] },
            { id: 'c2', assetId: 'a1', in: 10, out: 12, frame: [] },
        )
        const plan = buildExportPlan(
            project,
            assets,
            {
                encoders: { h264: 'h264_nvenc', hevc: 'hevc_nvenc' },
                hwaccel: 'cuda',
            },
            'out.mp4',
            'subs.ass',
        )
        expect(plan.duration).toBe(5)
        expect(plan.args).toContain('-hwaccel')
        expect(
            plan.args.slice(
                plan.args.indexOf('-ss'),
                plan.args.indexOf('-ss') + 6,
            ),
        ).toEqual(['-ss', '2', '-t', '3', '-i', 'E:/clip.mp4'])
        expect(plan.args[plan.args.indexOf('-filter_complex_script') + 1]).toBe(
            GRAPH_FILE,
        )
        expect(plan.graph).toContain(
            '[v0][a0][v1][a1]concat=n=2:v=1:a=1[vc][ac]',
        )
        expect(plan.graph).toContain('[vc]ass=subs.ass,copy[vo]')
        expect(plan.args).toContain('h264_nvenc')
        expect(plan.args).not.toContain('hvc1')
        expect(plan.args[plan.args.length - 1]).toBe('out.mp4')
    })
    test('hevc получает тег hvc1 и на nvenc, и на libx265', () =>
    {
        const project = createProject('p')
        project.output.codec = 'hevc'
        project.clips.push(
        {
            id: 'c1',
            assetId: 'a1',
            in: 0,
            out: 1,
            frame: [],
        })
        expect(
            buildExportPlan(
                project,
                assets,
                {
                    encoders: { h264: 'h264_nvenc', hevc: 'hevc_nvenc' },
                    hwaccel: 'cuda',
                },
                'o.mp4',
                null,
            ).args,
        ).toContain('hvc1')
        expect(
            buildExportPlan(project, assets, SOFTWARE_CAPS, 'o.mp4', null).args,
        ).toContain('libx265')
    })
    test('файл без звука получает тишину', () =>
    {
        const project = createProject('p')
        project.clips.push(
        {
            id: 'c1',
            assetId: 'a1',
            in: 0,
            out: 1,
            frame: [],
        })
        const silent = new Map([[asset.id, { ...asset, audioCodec: null }]])
        const plan = buildExportPlan(
            project,
            silent,
            SOFTWARE_CAPS,
            'out.mp4',
            null,
        )
        expect(plan.graph).toContain('aevalsrc=0:d=1:s=48000:c=stereo')
        expect(plan.args).toContain('libx264')
    })
})
