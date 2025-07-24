import { log } from "@/lib/logger"

interface Histogram {
  name: string
  help: string
  buckets: number[]
  values: Map<string, { count: number; sum: number; buckets: Map<number, number> }>
}

interface Counter {
  name: string
  help: string
  values: Map<string, number>
}

interface Gauge {
  name: string
  help: string
  values: Map<string, number>
}

export class MetricsCollector {
  private static instance: MetricsCollector

  private histograms: Map<string, Histogram> = new Map()
  private counters: Map<string, Counter> = new Map()
  private gauges: Map<string, Gauge> = new Map()

  // Default buckets for response time (milliseconds)
  private static readonly DEFAULT_BUCKETS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000]

  private constructor() {
    this.initializeMetrics()
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }

  /**
   * Initialize default metrics
   */
  private initializeMetrics() {
    // HTTP request duration histogram
    this.createHistogram(
      "http_request_duration_ms",
      "Duration of HTTP requests in milliseconds",
      MetricsCollector.DEFAULT_BUCKETS
    )

    // HTTP request counter
    this.createCounter("http_requests_total", "Total number of HTTP requests")

    // Error counter
    this.createCounter("errors_total", "Total number of errors")

    // Active connections gauge
    this.createGauge("active_connections", "Number of active connections")

    // Search requests counter
    this.createCounter("search_requests_total", "Total number of search requests")

    // API call counters
    this.createCounter("hubspot_api_calls_total", "Total number of HubSpot API calls")

    this.createCounter("dwolla_api_calls_total", "Total number of Dwolla API calls")

    // Cache metrics
    this.createCounter("cache_hits_total", "Total number of cache hits")

    this.createCounter("cache_misses_total", "Total number of cache misses")

    // Database query duration
    this.createHistogram(
      "db_query_duration_ms",
      "Duration of database queries in milliseconds",
      MetricsCollector.DEFAULT_BUCKETS
    )

    // External API duration
    this.createHistogram(
      "external_api_duration_ms",
      "Duration of external API calls in milliseconds",
      MetricsCollector.DEFAULT_BUCKETS
    )
  }

  /**
   * Create a new histogram metric
   */
  createHistogram(
    name: string,
    help: string,
    buckets: number[] = MetricsCollector.DEFAULT_BUCKETS
  ) {
    this.histograms.set(name, {
      name,
      help,
      buckets: buckets.sort((a, b) => a - b),
      values: new Map(),
    })
  }

  /**
   * Create a new counter metric
   */
  createCounter(name: string, help: string) {
    this.counters.set(name, {
      name,
      help,
      values: new Map(),
    })
  }

  /**
   * Create a new gauge metric
   */
  createGauge(name: string, help: string) {
    this.gauges.set(name, {
      name,
      help,
      values: new Map(),
    })
  }

  /**
   * Record a histogram observation
   */
  recordHistogram(name: string, value: number, labels: Record<string, string> = {}) {
    const histogram = this.histograms.get(name)
    if (!histogram) {
      log.warn(`Histogram ${name} not found`, { operation: "metrics_histogram" })
      return
    }

    const labelKey = this.createLabelKey(labels)
    let histogramValue = histogram.values.get(labelKey)

    if (!histogramValue) {
      histogramValue = {
        count: 0,
        sum: 0,
        buckets: new Map(histogram.buckets.map((b) => [b, 0])),
      }
      histogram.values.set(labelKey, histogramValue)
    }

    // Update histogram
    histogramValue.count++
    histogramValue.sum += value

    // Update buckets
    for (const bucket of histogram.buckets) {
      if (value <= bucket) {
        const current = histogramValue.buckets.get(bucket) || 0
        histogramValue.buckets.set(bucket, current + 1)
      }
    }
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}) {
    const counter = this.counters.get(name)
    if (!counter) {
      log.warn(`Counter ${name} not found`, { operation: "metrics_counter" })
      return
    }

    const labelKey = this.createLabelKey(labels)
    const current = counter.values.get(labelKey) || 0
    counter.values.set(labelKey, current + value)
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}) {
    const gauge = this.gauges.get(name)
    if (!gauge) {
      log.warn(`Gauge ${name} not found`, { operation: "metrics_gauge" })
      return
    }

    const labelKey = this.createLabelKey(labels)
    gauge.values.set(labelKey, value)
  }

  /**
   * Increment a gauge value
   */
  incrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}) {
    const gauge = this.gauges.get(name)
    if (!gauge) {
      log.warn(`Gauge ${name} not found`, { operation: "metrics_gauge" })
      return
    }

    const labelKey = this.createLabelKey(labels)
    const current = gauge.values.get(labelKey) || 0
    gauge.values.set(labelKey, current + value)
  }

  /**
   * Decrement a gauge value
   */
  decrementGauge(name: string, value: number = 1, labels: Record<string, string> = {}) {
    this.incrementGauge(name, -value, labels)
  }

  /**
   * Get metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = []

    // Export histograms
    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`)
      lines.push(`# TYPE ${histogram.name} histogram`)

      for (const [labelKey, value] of histogram.values) {
        const labels = labelKey || ""

        // Export buckets
        for (const [bucket, count] of value.buckets) {
          lines.push(
            `${histogram.name}_bucket{le="${bucket}"${labels ? "," + labels : ""}} ${count}`
          )
        }
        lines.push(
          `${histogram.name}_bucket{le="+Inf"${labels ? "," + labels : ""}} ${value.count}`
        )

        // Export sum and count
        lines.push(`${histogram.name}_sum${labels ? "{" + labels + "}" : ""} ${value.sum}`)
        lines.push(`${histogram.name}_count${labels ? "{" + labels + "}" : ""} ${value.count}`)
      }
    }

    // Export counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`)
      lines.push(`# TYPE ${counter.name} counter`)

      for (const [labelKey, value] of counter.values) {
        const labels = labelKey ? "{" + labelKey + "}" : ""
        lines.push(`${counter.name}${labels} ${value}`)
      }
    }

    // Export gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`)
      lines.push(`# TYPE ${gauge.name} gauge`)

      for (const [labelKey, value] of gauge.values) {
        const labels = labelKey ? "{" + labelKey + "}" : ""
        lines.push(`${gauge.name}${labels} ${value}`)
      }
    }

    // Add process metrics
    const memoryUsage = process.memoryUsage()
    lines.push("# HELP process_resident_memory_bytes Resident memory size in bytes.")
    lines.push("# TYPE process_resident_memory_bytes gauge")
    lines.push(`process_resident_memory_bytes ${memoryUsage.rss}`)

    lines.push("# HELP nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.")
    lines.push("# TYPE nodejs_heap_size_total_bytes gauge")
    lines.push(`nodejs_heap_size_total_bytes ${memoryUsage.heapTotal}`)

    lines.push("# HELP nodejs_heap_size_used_bytes Process heap size used from Node.js in bytes.")
    lines.push("# TYPE nodejs_heap_size_used_bytes gauge")
    lines.push(`nodejs_heap_size_used_bytes ${memoryUsage.heapUsed}`)

    return lines.join("\n") + "\n"
  }

  /**
   * Create a label key from labels object
   */
  private createLabelKey(labels: Record<string, string>): string {
    const entries = Object.entries(labels)
      .filter(([_, value]) => value !== undefined && value !== null)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)

    return entries.join(",")
  }

  /**
   * Reset all metrics (useful for testing)
   */
  reset() {
    for (const histogram of this.histograms.values()) {
      histogram.values.clear()
    }
    for (const counter of this.counters.values()) {
      counter.values.clear()
    }
    for (const gauge of this.gauges.values()) {
      gauge.values.clear()
    }
  }
}

// Export singleton instance
export const metrics = MetricsCollector.getInstance()
