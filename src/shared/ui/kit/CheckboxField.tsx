// Флажок с подписью: вся строка кликабельна. Компонент из реестра — только коробочка.

import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import {
    Checkbox as CheckboxPrimitive,
    type CheckboxProps,
} from 'react-aria-components'
import { cn } from 'cn'

export function CheckboxField({
    children,
    className,
    ...props
}: Omit<CheckboxProps, 'children' | 'className'> &
{
    children?: ReactNode
    className?: string
})
{
    return (
        <CheckboxPrimitive
            {...props}
            className={cn(
                'group flex items-center gap-2 outline-none',
                className,
            )}
        >
            <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input transition-colors group-data-focus-visible:ring-3 group-data-focus-visible:ring-ring/50 group-data-selected:border-primary group-data-selected:bg-primary group-data-selected:text-primary-foreground dark:bg-input/30">
                <Check className="size-3.5 opacity-0 group-data-selected:opacity-100" />
            </span>
            {children}
        </CheckboxPrimitive>
    )
}
