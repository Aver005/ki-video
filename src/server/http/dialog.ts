// Системный диалог выбора файлов: на Windows через PowerShell без сторонних пакетов.

import { VIDEO_EXTENSIONS } from '@shared/api'

const SCRIPT = [
    '[Console]::OutputEncoding = [Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.OpenFileDialog',
    '$d.Multiselect = $true',
    `$d.Filter = 'Видео|${VIDEO_EXTENSIONS.map((e) => `*${e}`).join(';')}|Все файлы|*.*'`,
    "$d.Title = 'Добавить видео'",
    "if ($d.ShowDialog() -eq 'OK') { $d.FileNames | ForEach-Object { [Console]::Out.WriteLine($_) } }",
].join('; ')

export function isDialogSupported(): boolean
{
    return process.platform === 'win32'
}

export async function openFileDialog(): Promise<string[]>
{
    if (!isDialogSupported())
        throw new Error(
            'Диалог выбора файлов есть только на Windows; укажи путь вручную',
        )
    const proc = Bun.spawn(
        [
            'powershell',
            '-NoProfile',
            '-STA',
            '-NonInteractive',
            '-Command',
            SCRIPT,
        ],
        {
            stdout: 'pipe',
            stderr: 'pipe',
            windowsHide: true,
        },
    )
    const [out, err, code] = await Promise.all([
        proc.stdout.text(),
        proc.stderr.text(),
        proc.exited,
    ])
    if (code !== 0)
        throw new Error(err.trim() || `PowerShell завершился с кодом ${code}`)
    return out
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== '')
}
