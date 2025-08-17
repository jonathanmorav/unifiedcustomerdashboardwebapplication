/**
 * Process items in batches with controlled concurrency to avoid rate limiting
 */
export async function processBatch<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options: {
    batchSize?: number
    delayBetweenBatches?: number
  } = {}
): Promise<R[]> {
  const { batchSize = 5, delayBetweenBatches = 1000 } = options
  const results: R[] = []
  
  // Process items in chunks
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    
    // Process batch items in parallel
    const batchResults = await Promise.all(
      batch.map(item => processor(item))
    )
    
    results.push(...batchResults)
    
    // Add delay between batches to avoid rate limiting
    if (i + batchSize < items.length && delayBetweenBatches > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches))
    }
  }
  
  return results
}

/**
 * Process items sequentially with optional delay between each
 */
export async function processSequentially<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  delayBetweenItems = 100
): Promise<R[]> {
  const results: R[] = []
  
  for (let i = 0; i < items.length; i++) {
    results.push(await processor(items[i]))
    
    // Add delay between items to avoid rate limiting
    if (i < items.length - 1 && delayBetweenItems > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenItems))
    }
  }
  
  return results
}