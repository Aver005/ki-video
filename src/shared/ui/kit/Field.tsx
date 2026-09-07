// Подписанное поле: подпись сверху, контрол снизу.

import type { ReactNode } from 'react'

export function Field({
    label,
    children,
}: {
    label: ReactNode
    children: ReactNode
})
{
    return (
        <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            {children}
        </label>
    )
}
