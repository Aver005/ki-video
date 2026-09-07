// Метка ключа на шкале: выбранная залита.

import type { ReactNode } from 'react'
import { Button } from '@shared/ui/button'

export function KeyChip({
    active,
    onPress,
    children,
}: {
    active: boolean
    onPress: () => void
    children: ReactNode
})
{
    return (
        <Button
            size="xs"
            variant={active ? 'default' : 'outline'}
            className="rounded-full"
            onPress={onPress}
        >
            {children}
        </Button>
    )
}
