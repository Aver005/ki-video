import { describe, expect, test } from 'bun:test'
import { locate, placeClips, projectDuration } from '@shared/timeline'
import type { Clip } from '@shared/model'

const clips: Clip[] = [
    { id: 'a', assetId: 'x', in: 5, out: 10, frame: [] },
    { id: 'b', assetId: 'y', in: 0, out: 3, frame: [] },
]

describe('timeline', () =>
{
    test('клипы идут подряд', () =>
    {
        const placed = placeClips(clips)
        expect(placed.map((p) => p.start)).toEqual([0, 5])
        expect(projectDuration({ clips })).toBe(8)
    })
    test('locate находит клип и локальное время', () =>
    {
        const at = locate(clips, 6.5)
        expect(at?.placement.clip.id).toBe('b')
        expect(at?.localT).toBeCloseTo(1.5)
        expect(at?.sourceT).toBeCloseTo(1.5)
    })
    test('locate в первом клипе считает время исходника от in', () =>
    {
        const at = locate(clips, 2)
        expect(at?.placement.clip.id).toBe('a')
        expect(at?.sourceT).toBe(7)
    })
    test('locate за концом даёт последний клип на его конце', () =>
    {
        const at = locate(clips, 100)
        expect(at?.placement.clip.id).toBe('b')
        expect(at?.localT).toBe(3)
    })
    test('пустой список — undefined', () =>
    {
        expect(locate([], 1)).toBeUndefined()
    })
})
