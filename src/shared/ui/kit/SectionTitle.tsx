// Подзаголовок раздела в панелях.

import type { ReactNode } from 'react'

export function SectionTitle({ children }: { children: ReactNode })
{
    return (
        <div className="text-xs tracking-wider text-muted-foreground uppercase">
            {children}
        </div>
    )
}
