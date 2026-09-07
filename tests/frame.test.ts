import { describe, expect, test } from 'bun:test'
import {
    baseWindow,
    clampFrame,
    frameToRegion,
    interpolateFrame,
} from '@shared/frame'
import { interpolateKeys, removeKeyAt, upsertKey } from '@shared/keys'
import type { FrameKeyframe } from '@shared/model'

const source = { width: 1728, height: 1080 }
const output = { width: 1080, height: 1920 }

describe('baseWindow', () =>
{
    test('горизонтальный исходник: окно во всю высоту с пропорцией 9:16, чётная ширина', () =>
    {
        expect(baseWindow(source, output)).toEqual({ width: 606, height: 1080 })
    })
    test('узкий исходник: окно во всю ширину', () =>
    {
        expect(baseWindow({ width: 500, height: 2000 }, output)).toEqual(
        {
            width: 500,
            height: 888,
        })
    })
})

describe('interpolateFrame', () =>
{
    const kfs = [
        { t: 1, cx: 100, cy: 200, zoom: 1 },
        { t: 3, cx: 300, cy: 400, zoom: 2 },
    ]
    test('до первого ключа держит первое значение', () =>
    {
        expect(interpolateFrame(kfs, 0, { cx: 0, cy: 0, zoom: 1 })).toEqual(
        {
            cx: 100,
            cy: 200,
            zoom: 1,
        })
    })
    test('между ключами линейно', () =>
    {
        expect(interpolateFrame(kfs, 2, { cx: 0, cy: 0, zoom: 1 })).toEqual(
        {
            cx: 200,
            cy: 300,
            zoom: 1.5,
        })
    })
    test('после последнего держит последнее', () =>
    {
        expect(interpolateFrame(kfs, 10, { cx: 0, cy: 0, zoom: 1 })).toEqual(
        {
            cx: 300,
            cy: 400,
            zoom: 2,
        })
    })
    test('без ключей возвращает запасное значение', () =>
    {
        expect(interpolateFrame([], 2, { cx: 5, cy: 6, zoom: 1 })).toEqual(
        {
            cx: 5,
            cy: 6,
            zoom: 1,
        })
    })
})

describe('frameToRegion', () =>
{
    test('центр без зума: окно посередине', () =>
    {
        const r = frameToRegion({ cx: 864, cy: 540, zoom: 1 }, source, output)
        expect(r).toEqual({ x: 561, y: 0, w: 606, h: 1080 })
    })
    test('центр у края прижимается к границе', () =>
    {
        const r = frameToRegion({ cx: 0, cy: 0, zoom: 1 }, source, output)
        expect(r.x).toBe(0)
        expect(r.y).toBe(0)
    })
    test('зум уменьшает регион вдвое', () =>
    {
        const r = frameToRegion({ cx: 864, cy: 540, zoom: 2 }, source, output)
        expect(r.w).toBe(303)
        expect(r.h).toBe(540)
    })
})

describe('clampFrame', () =>
{
    test('зум ограничен диапазоном и центр не выходит за исходник', () =>
    {
        const f = clampFrame({ cx: -50, cy: 5000, zoom: 0.2 }, source, output)
        expect(f).toEqual({ cx: 303, cy: 540, zoom: 1 })
    })
})

describe('interpolateKeys', () =>
{
    test('работает с любым набором числовых полей', () =>
    {
        const keys = [
            { t: 0, a: 0, b: 10 },
            { t: 2, a: 4, b: 10 },
        ]
        expect(interpolateKeys(keys, 1, { a: 0, b: 0 })).toEqual(
        {
            a: 2,
            b: 10,
        })
        expect(interpolateKeys(keys, -5, { a: 0, b: 0 })).toEqual(
        {
            a: 0,
            b: 10,
        })
        expect(interpolateKeys([], 1, { a: 7, b: 8 })).toEqual({ a: 7, b: 8 })
    })
})

describe('keyframe list', () =>
{
    test('upsert заменяет ключ рядом по времени и сортирует', () =>
    {
        const list: FrameKeyframe[] = upsertKey(
            [{ t: 2, cx: 1, cy: 1, zoom: 1 }],
            {
                t: 1,
                cx: 0,
                cy: 0,
                zoom: 1,
            },
        )
        expect(list.map((k) => k.t)).toEqual([1, 2])
        const replaced = upsertKey(list,
        {
            t: 2.005,
            cx: 9,
            cy: 9,
            zoom: 1,
        })
        expect(replaced).toHaveLength(2)
        expect(replaced[1]?.cx).toBe(9)
    })
    test('ключи на соседних кадрах при 60 fps остаются разными', () =>
    {
        const list = upsertKey([{ t: 1, cx: 1, cy: 1, zoom: 1 }],
        {
            t: 1 + 1 / 60,
            cx: 0,
            cy: 0,
            zoom: 1,
        })
        expect(list).toHaveLength(2)
    })
    test('remove удаляет ключ в момент времени', () =>
    {
        expect(
            removeKeyAt([{ t: 1, cx: 0, cy: 0, zoom: 1 }], 1.005),
        ).toHaveLength(0)
    })
})
