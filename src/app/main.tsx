import { createRoot } from 'react-dom/client'
import { I18nProvider } from 'react-aria-components'
import { App } from '@app/App'

// Локаль задана явно: иначе RAC берёт язык браузера и разделитель дробной части плавает.
const root = document.getElementById('root')
if (root)
    createRoot(root).render(
        <I18nProvider locale="ru-RU">
            <App />
        </I18nProvider>,
    )
