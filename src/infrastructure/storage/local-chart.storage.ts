import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChartStoragePort, RenderedChart } from "../../application/ports/chart.ports.ts";

export class LocalChartStorage implements ChartStoragePort {
  constructor(
    private readonly outputDir: string,
    private readonly publicBaseUrl: string,
  ) {}

  async store(id: string, image: RenderedChart): Promise<string> {
    await mkdir(this.outputDir, { recursive: true });
    const fileName = `${id}.png`;
    await writeFile(path.join(this.outputDir, fileName), image.bytes);
    return `${this.publicBaseUrl.replace(/\/$/, "")}/charts/${fileName}`;
  }
}
