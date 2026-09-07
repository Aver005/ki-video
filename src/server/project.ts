// Один проект на приложение: читаем и пишем project.json в папке данных.

import { join } from "node:path";
import { createProject, type Project } from "@shared/model";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Проверка верхнего уровня: версия, массивы и объекты на месте. Глубже валидирует сборка экспорта. */
export function isProjectLike(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const output = value["output"];
  return (
    value["version"] === 1 &&
    typeof value["id"] === "string" &&
    typeof value["name"] === "string" &&
    Array.isArray(value["clips"]) &&
    Array.isArray(value["texts"]) &&
    isRecord(output) &&
    typeof output["width"] === "number" &&
    typeof output["height"] === "number" &&
    isRecord(value["color"]) &&
    isRecord(value["audio"]) &&
    isRecord(value["subtitles"]) &&
    Array.isArray((value["subtitles"] as Record<string, unknown>)["cues"])
  );
}

export class ProjectStore {
  private readonly file: string;
  private current: Project | null = null;

  constructor(dataDir: string) {
    this.file = join(dataDir, "project.json");
  }

  async load(): Promise<Project> {
    if (this.current) return this.current;
    const file = Bun.file(this.file);
    if (await file.exists()) {
      const parsed = await file.json().catch(() => null);
      if (isProjectLike(parsed)) {
        this.current = parsed;
        return this.current;
      }
      console.warn("[project] project.json повреждён, создаём новый");
    }
    this.current = createProject(crypto.randomUUID());
    await this.save(this.current);
    return this.current;
  }

  async save(project: Project): Promise<void> {
    this.current = project;
    await Bun.write(this.file, JSON.stringify(project, null, 2));
  }
}
