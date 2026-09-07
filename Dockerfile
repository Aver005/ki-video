# Серверный вариант без окна: ffmpeg из образа, интерфейс открывается в браузере хоста.
# Файлы для монтажа монтируются в /media, кэш и экспорт — в /data.
FROM oven/bun:1.3.14 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run check

FROM oven/bun:1.3.14
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app /app
ENV KI_NO_WINDOW=1 KI_PORT=4777 NODE_ENV=production
EXPOSE 4777
VOLUME ["/data", "/media"]
CMD ["bun", "run", "src/server/main.ts"]
