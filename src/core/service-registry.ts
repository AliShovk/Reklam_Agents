import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ServiceCredentialRecord {
  service: string;
  key: string;
  value: string;
  description: string;
  updatedAt: string;
}

class ServiceRegistry {
  private filePath = process.env.SERVICE_REGISTRY_FILE || path.resolve(process.cwd(), "data", "service-access.json");

  private async ensureStorage(): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
  }

  private async readAll(): Promise<ServiceCredentialRecord[]> {
    await this.ensureStorage();
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private async writeAll(records: ServiceCredentialRecord[]): Promise<void> {
    await this.ensureStorage();
    await writeFile(this.filePath, JSON.stringify(records, null, 2), "utf8");
  }

  async setCredential(service: string, key: string, value: string, description = ""): Promise<ServiceCredentialRecord> {
    const normalizedService = service.trim();
    const normalizedKey = key.trim();
    const records = await this.readAll();
    const next: ServiceCredentialRecord = {
      service: normalizedService,
      key: normalizedKey,
      value,
      description: description.trim(),
      updatedAt: new Date().toISOString(),
    };
    const filtered = records.filter((item) => !(item.service === normalizedService && item.key === normalizedKey));
    filtered.push(next);
    await this.writeAll(filtered);
    return next;
  }

  async listCredentials(): Promise<ServiceCredentialRecord[]> {
    return this.readAll();
  }

  async listSummary(): Promise<Array<Pick<ServiceCredentialRecord, "service" | "key" | "description" | "updatedAt">>> {
    const records = await this.readAll();
    return records.map(({ service, key, description, updatedAt }) => ({ service, key, description, updatedAt }));
  }
}

export const serviceRegistry = new ServiceRegistry();
