import type { WebhookEvent } from '@prisma/client'

// Processing context for passing data between stages
export class ProcessingContext {
  private data = new Map<string, any>()
  
  constructor(public event: WebhookEvent) {}
  
  set(key: string, value: any): void {
    this.data.set(key, value)
  }
  
  get<T>(key: string): T | undefined {
    return this.data.get(key) as T
  }
  
  has(key: string): boolean {
    return this.data.has(key)
  }
  
  getAll(): Record<string, any> {
    const result: Record<string, any> = {}
    this.data.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
}