import { describe, expect, test } from 'bun:test'
import { computePeaks, peaksTs } from '@server/peaks'
import { parseRange } from '@server/http/range'
import { parseProgressBlock } from '@server/ffmpeg/run'
import { parseProject } from '@server/project'
import { isOwnRequest } from '@server/http/guard'
import { assetIdFor } from '@server/assets'
import { toProbeResult } from '@server/ffmpeg/probe'
import { createProject } from '@core/model'

describe('peaks', () =>
{
    test('полная амплитуда в минус не переполняет байт; C и TS совпадают', () =>
    {
        const samples = new Int16Array([-32768, 32767, 0, 100, -100, 12800])
        expect(Array.from(peaksTs(samples, 2))).toEqual([255, 0, 100])
        expect(Array.from(computePeaks(samples, 2))).toEqual(
            Array.from(peaksTs(samples, 2)),
        )
    })
})

describe('range', () =>
{
    test('обычный, открытый и суффиксный диапазоны', () =>
    {
        expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 })
        expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 })
        expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 })
        expect(parseRange(null, 1000)).toBeNull()
    })
    test('невыполнимые диапазоны', () =>
    {
        expect(parseRange('bytes=1000-', 1000)).toBe('unsatisfiable')
        expect(parseRange('bytes=-0', 1000)).toBe('unsatisfiable')
        expect(parseRange('bytes=50-10', 1000)).toBe('unsatisfiable')
    })
})

describe('progress', () =>
{
    test('out_time_us в секунды, fps и speed', () =>
    {
        expect(
            parseProgressBlock([
                'fps=59.5',
                'out_time_us=2500000',
                'speed=1.25x',
                'progress=continue',
            ]),
        ).toEqual({ outTime: 2.5, fps: 59.5, speed: '1.25x' })
        expect(parseProgressBlock(['out_time_us=N/A']).outTime).toBe(0)
    })
})

describe('project validation', () =>
{
    test('новый проект проходит, чужой объект — нет', () =>
    {
        expect(parseProject(createProject('p'))?.version).toBe(2)
        expect(parseProject({ hello: 1 })).toBeNull()
        expect(parseProject(null)).toBeNull()
    })
    test('битые поля заменяются значениями по умолчанию', () =>
    {
        const parsed = parseProject(
        {
            ...createProject('p'),
            output: null,
            color: 'нет',
        })
        expect(parsed?.output.width).toBe(1080)
        expect(parsed?.color.contrast).toBe(1)
    })
    test('проект версии 1 переносится на дорожки', () =>
    {
        const parsed = parseProject(
        {
            version: 1,
            id: 'old',
            name: 'Старый',
            output:
            {
                width: 720,
                height: 1280,
                fps: 30,
                codec: 'h264',
                quality: 20,
            },
            clips: [
                { id: 'c1', assetId: 'a1', in: 2, out: 5, frame: [] },
                { id: 'c2', assetId: 'a1', in: 0, out: 4, frame: [] },
            ],
            texts: [
                {
                    id: 't1',
                    text: 'Привет',
                    start: 1,
                    end: 3,
                    x: 0.5,
                    y: 0.2,
                    size: 64,
                    color: '#fff',
                    outline: '#000',
                    animation: 'fade',
                },
            ],
            color: {},
            audio: {},
            subtitles: { preset: 'bold', y: 0.8, cues: [] },
        })
        expect(parsed?.version).toBe(2)
        const content = parsed?.tracks.find((t) => t.kind === 'content')
        expect(content?.items.map((i) => [i.start, i.duration])).toEqual([
            [0, 3],
            [3, 4],
        ])
        expect(content?.items[1]).toMatchObject({ offset: 0 })
        const overlay = parsed?.tracks.find((t) => t.kind === 'overlay')
        expect(overlay?.items[0]).toMatchObject(
        {
            kind: 'text',
            start: 1,
            duration: 2,
        })
    })
})

describe('guard', () =>
{
    const req = (method: string, headers: Record<string, string>) =>
        new Request('http://127.0.0.1:4777/api/x', { method, headers })
    test('GET со своего хоста проходит, чужой хост — нет', () =>
    {
        expect(isOwnRequest(req('GET', { host: '127.0.0.1:4777' }))).toBe(true)
        expect(isOwnRequest(req('GET', { host: 'evil.example:4777' }))).toBe(
            false,
        )
    })
    test('POST проходит только со своей страницы', () =>
    {
        expect(
            isOwnRequest(
                req('POST',
                {
                    host: 'localhost:4777',
                    'sec-fetch-site': 'same-origin',
                }),
            ),
        ).toBe(true)
        expect(
            isOwnRequest(
                req('POST',
                {
                    host: 'localhost:4777',
                    'sec-fetch-site': 'cross-site',
                }),
            ),
        ).toBe(false)
        expect(
            isOwnRequest(
                req('POST',
                {
                    host: 'localhost:4777',
                    origin: 'http://evil.example',
                }),
            ),
        ).toBe(false)
        expect(isOwnRequest(req('POST', { host: 'localhost:4777' }))).toBe(true)
    })
})

describe('assets and probe', () =>
{
    test('id стабилен и шестнадцатеричный', () =>
    {
        const id = assetIdFor('E:/a.mp4', 10, 1000.7)
        expect(id).toMatch(/^[0-9a-f]{16}$/)
        expect(assetIdFor('E:/a.mp4', 10, 1000.2)).toBe(id)
    })
    test('probe: файл только со звуком не считается битым', () =>
    {
        const r = toProbeResult(
        {
            streams: [{ codec_type: 'audio', codec_name: 'mp3' }],
            format: { duration: '61' },
        })
        expect(r).toEqual(
        {
            duration: 61,
            width: 0,
            height: 0,
            fps: 30,
            videoCodec: null,
            audioCodec: 'mp3',
        })
        expect(() => toProbeResult({ streams: [] })).toThrow()
    })
    test('probe: fps из дроби, звук может отсутствовать', () =>
    {
        const r = toProbeResult(
        {
            streams: [
                {
                    codec_type: 'video',
                    codec_name: 'hevc',
                    width: 1728,
                    height: 1080,
                    avg_frame_rate: '60/1',
                },
            ],
            format: { duration: '30.5' },
        })
        expect(r).toEqual(
        {
            duration: 30.5,
            width: 1728,
            height: 1080,
            fps: 60,
            videoCodec: 'hevc',
            audioCodec: null,
        })
    })
})
