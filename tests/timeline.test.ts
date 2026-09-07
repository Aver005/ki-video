import { describe, expect, test } from 'bun:test'
import {
    clampContentStart,
    contentAt,
    contentSegments,
    projectDuration,
    segmentsDuration,
} from '@core/timeline'
import { item, project, track } from './factory'

describe('timeline', () =>
{
    test('длительность проекта — по самому дальнему краю всех дорожек', () =>
    {
        const p = project([
            track('content', [item({ id: 'a', start: 0, duration: 5 })]),
            track('overlay', [item({ id: 'b', start: 8, duration: 3 })]),
        ])
        expect(projectDuration(p)).toBe(11)
    })

    test('contentAt отдаёт элемент и время внутри исходника', () =>
    {
        const p = project([
            track('content', [
                item({ id: 'a', start: 0, duration: 5, offset: 2 }),
            ]),
        ])
        const at = contentAt(p, 1.5)
        expect(at?.item.id).toBe('a')
        expect(at?.localT).toBeCloseTo(1.5)
        expect(at?.sourceT).toBeCloseTo(3.5)
        expect(contentAt(p, 6)).toBeNull()
    })

    test('зазор между элементами становится чёрным куском', () =>
    {
        const segments = contentSegments(
            track('content', [
                item({ id: 'a', start: 2, duration: 3 }),
                item({ id: 'b', start: 7, duration: 2 }),
            ]),
            9,
        )
        expect(segments.map((s) => [s.item?.id ?? null, s.duration])).toEqual([
            [null, 2],
            ['a', 3],
            [null, 2],
            ['b', 2],
        ])
        expect(segmentsDuration(segments)).toBe(9)
    })

    test('наезд даёт переход, лента остаётся длиной проекта', () =>
    {
        const segments = contentSegments(
            track('content', [
                item({ id: 'a', start: 0, duration: 4 }),
                item({ id: 'b', start: 3, duration: 4 }),
            ]),
            7,
        )
        expect(segments[1]?.overlap).toBeCloseTo(1)
        expect(segmentsDuration(segments)).toBeCloseTo(7)
    })

    test('хвост дорожки добирается чёрным до конца проекта', () =>
    {
        const segments = contentSegments(
            track('content', [item({ id: 'a', start: 0, duration: 2 })]),
            5,
        )
        expect(segments[1]?.item).toBeNull()
        expect(segments[1]?.duration).toBe(3)
    })

    test('наезд ограничен половиной короткого элемента', () =>
    {
        const moving = item({ id: 'b', start: 6, duration: 4 })
        const lane = track('content', [
            item({ id: 'a', start: 0, duration: 4 }),
            moving,
        ])
        expect(clampContentStart(lane, moving, 1)).toBeCloseTo(2)
        expect(clampContentStart(lane, moving, 3)).toBeCloseTo(3)
        expect(clampContentStart(lane, moving, -5)).toBe(0)
        expect(clampContentStart(lane, moving, 5)).toBe(5)
    })
})
