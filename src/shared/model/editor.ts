// Состояние редактора вне документа: выделение, вкладка инспектора, масштаб, уведомление.

import {
    setState,
    type InspectorTab,
    type Selection,
} from '@shared/model/store'

export function notify(message: string | null): void
{
    setState({ notice: message })
}

export function select(selection: Selection): void
{
    setState({ selection })
}

export function setTab(tab: InspectorTab): void
{
    setState({ tab })
}

export function setZoom(pxPerSec: number): void
{
    setState({ pxPerSec })
}
