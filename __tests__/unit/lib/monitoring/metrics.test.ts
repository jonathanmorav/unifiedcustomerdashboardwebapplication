import { MetricsCollector } from "@/lib/monitoring/metrics"

describe("MetricsCollector", () => {
  let metrics: MetricsCollector

  beforeEach(() => {
    // Get fresh instance and reset
    metrics = MetricsCollector.getInstance()
    metrics.reset()
  })

  describe("Counter metrics", () => {
    it("should increment counter", () => {
      metrics.incrementCounter("http_requests_total", 1, { method: "GET", status: "200" })
      metrics.incrementCounter("http_requests_total", 1, { method: "GET", status: "200" })
      metrics.incrementCounter("http_requests_total", 1, { method: "POST", status: "201" })

      const output = metrics.getPrometheusMetrics()

      expect(output).toContain('http_requests_total{method="GET",status="200"} 2')
      expect(output).toContain('http_requests_total{method="POST",status="201"} 1')
    })

    it("should handle counters without labels", () => {
      metrics.incrementCounter("errors_total", 5)

      const output = metrics.getPrometheusMetrics()
      expect(output).toContain("errors_total 5")
    })
  })

  describe("Gauge metrics", () => {
    it("should set gauge value", () => {
      metrics.setGauge("active_connections", 10)
      metrics.setGauge("active_connections", 15)

      const output = metrics.getPrometheusMetrics()
      expect(output).toContain("active_connections 15")
    })

    it("should increment and decrement gauge", () => {
      metrics.setGauge("active_connections", 10)
      metrics.incrementGauge("active_connections", 5)
      metrics.decrementGauge("active_connections", 3)

      const output = metrics.getPrometheusMetrics()
      expect(output).toContain("active_connections 12")
    })
  })

  describe("Histogram metrics", () => {
    it("should record histogram observations", () => {
      metrics.recordHistogram("http_request_duration_ms", 25, { method: "GET" })
      metrics.recordHistogram("http_request_duration_ms", 75, { method: "GET" })
      metrics.recordHistogram("http_request_duration_ms", 150, { method: "GET" })

      const output = metrics.getPrometheusMetrics()

      // Check buckets
      expect(output).toContain('http_request_duration_ms_bucket{le="10",method="GET"} 0')
      expect(output).toContain('http_request_duration_ms_bucket{le="50",method="GET"} 1')
      expect(output).toContain('http_request_duration_ms_bucket{le="100",method="GET"} 2')
      expect(output).toContain('http_request_duration_ms_bucket{le="250",method="GET"} 3')
      expect(output).toContain('http_request_duration_ms_bucket{le="+Inf",method="GET"} 3')

      // Check sum and count
      expect(output).toContain('http_request_duration_ms_sum{method="GET"} 250')
      expect(output).toContain('http_request_duration_ms_count{method="GET"} 3')
    })
  })

  describe("Prometheus format", () => {
    it("should include HELP and TYPE annotations", () => {
      metrics.incrementCounter("http_requests_total", 1)

      const output = metrics.getPrometheusMetrics()

      expect(output).toContain("# HELP http_requests_total Total number of HTTP requests")
      expect(output).toContain("# TYPE http_requests_total counter")
    })

    it("should include process metrics", () => {
      const output = metrics.getPrometheusMetrics()

      expect(output).toContain("# HELP process_resident_memory_bytes")
      expect(output).toContain("# TYPE process_resident_memory_bytes gauge")
      expect(output).toContain("process_resident_memory_bytes")

      expect(output).toContain("# HELP nodejs_heap_size_total_bytes")
      expect(output).toContain("# TYPE nodejs_heap_size_total_bytes gauge")
      expect(output).toContain("nodejs_heap_size_total_bytes")

      expect(output).toContain("# HELP nodejs_heap_size_used_bytes")
      expect(output).toContain("# TYPE nodejs_heap_size_used_bytes gauge")
      expect(output).toContain("nodejs_heap_size_used_bytes")
    })
  })

  describe("Label handling", () => {
    it("should sort labels alphabetically", () => {
      metrics.createCounter("test_counter", "Test counter for labels")
      metrics.incrementCounter("test_counter", 1, { z: "last", a: "first", m: "middle" })

      const output = metrics.getPrometheusMetrics()
      expect(output).toContain('test_counter{a="first",m="middle",z="last"} 1')
    })

    it("should handle undefined and null label values", () => {
      metrics.createCounter("test_counter", "Test counter for labels")
      metrics.incrementCounter("test_counter", 1, {
        valid: "yes",
        undefined: undefined,
        null: null,
        empty: "",
      } as any)

      const output = metrics.getPrometheusMetrics()
      expect(output).toContain('test_counter{empty="",valid="yes"} 1')
      expect(output).not.toContain("undefined")
      expect(output).not.toContain("null")
    })
  })

  describe("Error handling", () => {
    it("should handle non-existent metric gracefully", () => {
      // These should not throw
      expect(() => {
        metrics.incrementCounter("non_existent_counter", 1)
        metrics.setGauge("non_existent_gauge", 1)
        metrics.recordHistogram("non_existent_histogram", 1)
      }).not.toThrow()
    })
  })
})
