// Типы для импортов-файлов: C-исходник приходит строкой (with { type: "text" }).
declare module '*.c'
{
    const source: string
    export default source
}
