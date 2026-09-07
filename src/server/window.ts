// Окно приложения: Edge или Chrome в режиме --app с отдельным профилем. Иначе — браузер по умолчанию.

import { join } from 'node:path'

const WINDOWS_BROWSERS = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
]

async function findBrowser(): Promise<string | null>
{
    for (const candidate of WINDOWS_BROWSERS)
    {
        if (await Bun.file(candidate).exists()) return candidate
    }
    return (
        Bun.which('msedge') ??
        Bun.which('chrome') ??
        Bun.which('chromium') ??
        Bun.which('google-chrome')
    )
}

export async function openAppWindow(
    url: string,
    dataDir: string,
): Promise<string>
{
    const browser = await findBrowser()
    if (browser)
    {
        Bun.spawn(
            [
                browser,
                `--app=${url}`,
                '--window-size=1500,960',
                `--user-data-dir=${join(dataDir, 'browser-profile')}`,
                '--no-first-run',
            ],
            {
                stdout: 'ignore',
                stderr: 'ignore',
            },
        ).unref()
        return browser
    }
    const opener =
        process.platform === 'win32'
            ? ['cmd', '/c', 'start', '', url]
            : process.platform === 'darwin'
              ? ['open', url]
              : ['xdg-open', url]
    Bun.spawn(opener, { stdout: 'ignore', stderr: 'ignore' }).unref()
    return opener[0] ?? ''
}

export function revealInExplorer(path: string): void
{
    if (process.platform !== 'win32') return
    Bun.spawn(['explorer', `/select,${path}`],
    {
        stdout: 'ignore',
        stderr: 'ignore',
    }).unref()
}
