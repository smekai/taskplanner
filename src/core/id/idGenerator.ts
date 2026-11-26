import { ConfigManager } from '../config/configManager.js';

export class IdGenerator {
  constructor(private configManager: ConfigManager) {}

  next(): string {
    return this.configManager.getNextId();
  }

  parseId(id: string): { prefix: string; number: number } | null {
    const [, prefix, digits] = id.match(/^([A-Z]+)-(\d+)$/) ?? [];
    if (prefix === undefined || digits === undefined) {
      return null;
    }
    return { prefix, number: parseInt(digits, 10) };
  }
}
