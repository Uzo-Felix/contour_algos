# Performance Benchmarking Guide

## Overview

This document explains how to run, interpret, and extend the performance benchmarks.

## Running Benchmarks

### Prerequisites

```bash
npm install
```

### Benchmark Suite

#### 1. Synthetic Data Benchmark

```bash
node benchmarks/benchmark.js
```

**What it tests:**
- Performance on generated synthetic grids
- Different grid sizes (120×60, 240×120)
- Bucket Grid performance characteristics
- Timing breakdown: CONREC, indexing, gluing

**Output:**
- Timing results for each phase
- Segment counts
- Closure rates
- Performance metrics

#### 2. ERA5 Climate Data Benchmark

```bash
node benchmarks/benchmark-era5.js
```

**What it tests:**
- Real-world climate data (1440×721 grid)
- 24 different isoline levels
- ERA5 mean sea level pressure
- Closure rates on real data

**Output:**
- Per-level performance metrics
- Total aggregate timing
- Closure rate statistics
- Data quality validation

#### 3. R-Tree vs Bucket Grid Comparison

```bash
node benchmarks/benchmark-comparison.js
```

**What it tests:**
- Direct performance comparison
- Both spatial index implementations
- Same dataset, same conditions
- Statistical significance

**Output:**
```
Segment Count:  302    1,500  3,000  4,400  5,600  6,200
R-Tree (ms):    15.2   32.1   58.4   89.7   112.3  125.8
Bucket (ms):    11.2   27.6   42.1   44.0   33.8   28.3
Speedup:        1.36×  1.16×  1.39×  2.04×  3.32×  4.45×

Overall: 238.29ms (Bucket) vs 387.61ms (R-Tree)
Improvement: 62.7% faster with Bucket Grid
```

## Interpreting Results

### Key Metrics

#### Timing Breakdown

- **CONREC**: Segment generation (~75% of time)
- **Indexing**: Spatial index construction (~14% of time)
- **Gluing**: Segment assembly (~11% of time)

**Implication**: Optimize gluing algorithm to improve overall performance.

#### Closure Rate

```
closure_rate = (segments in closed loops / total segments) × 100%
```

**Interpretation:**
- >95%: Excellent topology, correct algorithm
- 90-95%: Good, minor isolated segments
- <90%: Investigate tolerance parameter

#### Segment Distribution

- **Low densities** (<3,000 segments): Both indices similar
- **High densities** (>3,000 segments): Bucket Grid dominates
- **Crossover point**: ~2,000-3,000 segments

## Custom Benchmarking

### Template

```javascript
const IsolineBuilder = require('../src/isolineBuilder');
const fs = require('fs');

// 1. Generate test data
const grid = generateTestGrid(width, height);

// 2. Test Bucket Grid
console.time('Bucket Grid');
const bucketBuilder = new IsolineBuilder(grid, width, height, 'bucket');
const bucketResult = bucketBuilder.generateIsolines(level);
console.timeEnd('Bucket Grid');

// 3. Test R-Tree
console.time('R-Tree');
const rtreeBuilder = new IsolineBuilder(grid, width, height, 'rtree');
const rtreeResult = rtreeBuilder.generateIsolines(level);
console.timeEnd('R-Tree');

// 4. Analyze and report
analyzeResults(bucketResult, rtreeResult);
```

### Adding New Tests

1. Create `benchmarks/benchmark-custom.js`
2. Generate your test data
3. Run both implementations
4. Compare results
5. Save to `results/custom-results.json`

## Performance Analysis

### Bottleneck Identification

**Step 1: Profile timing**
```javascript
const result = builder.getResults();
console.log(`Timing: CONREC=${result.timing.conrec}ms, 
             Indexing=${result.timing.indexing}ms, 
             Gluing=${result.timing.gluing}ms`);
```

**Step 2: Identify percentage**
```javascript
const conrecPct = result.timing.conrec / result.timing.total * 100;
const indexingPct = result.timing.indexing / result.timing.total * 100;
const gluingPct = result.timing.gluing / result.timing.total * 100;
```

**Step 3: Target optimization**
- If CONREC > 80%: Consider GPU acceleration
- If Indexing > 30%: Choose Bucket Grid
- If Gluing > 20%: Optimize matching algorithm

### Scaling Behavior

**Expected Behavior:**
- Linear scaling with grid size
- Logarithmic queries (R-Tree)
- Constant queries (Bucket Grid)

**Test:** Double grid size, observe timing increase
- Should increase by ~4× (O(n) for 2D grids)

### Cache Effects

Performance may vary based on:
- CPU cache hits/misses
- System load
- Memory fragmentation

**Solution:** Run multiple iterations, report average

## Benchmark Results Files

### Format

```json
{
  "timestamp": "2025-12-30T09:30:00Z",
  "environment": {
    "node_version": "18.0.0",
    "platform": "linux",
    "cpu": "AMD Ryzen 5"
  },
  "tests": [
    {
      "name": "synthetic-120x60",
      "gridSize": { "width": 120, "height": 60 },
      "results": {
        "bucket": {
          "conrec": 1.2,
          "indexing": 0.01,
          "gluing": 0.01,
          "total": 1.22
        },
        "rtree": {
          "conrec": 1.2,
          "indexing": 0.05,
          "gluing": 0.03,
          "total": 1.28
        },
        "speedup": 1.05
      }
    }
  ]
}
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Performance Benchmarks

on: [push, pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run benchmark:compare
      
      - name: Store results
        if: always()
        uses: actions/upload-artifact@v2
        with:
          name: benchmark-results
          path: results/
```

## Best Practices

1. **Warm up**: Run test once before measuring
2. **Multiple runs**: Average over 3-5 iterations
3. **Isolate variables**: Test one change at a time
4. **Document results**: Save all benchmark runs
5. **Repeat tests**: Verify reproducibility
6. **Compare fairly**: Same environment, data, algorithm

## Regression Detection

```javascript
// Compare against baseline
const baseline = require('./results/baseline.json');
const current = require('./results/current.json');

const regression = current.time / baseline.time;

if (regression > 1.1) {
  console.warn(`Performance regression: ${(regression-1)*100}% slower`);
}
```

## Optimization Techniques

### Algorithm Level
- Spatial index selection
- Tolerance parameter tuning
- Batch processing
- Parallel processing

### Implementation Level
- Loop unrolling
- Memory pre-allocation
- Avoiding garbage collection
- Using typed arrays

### Infrastructure Level
- Node.js version
- CPU throttling
- Memory pressure
- Disk I/O

## References

- [Node.js Performance API](https://nodejs.org/api/perf_hooks.html)
- [Benchmark.js Library](https://benchmarkjs.com/)
- [Statistical Methods for Performance Analysis](https://easyperf.net/blog/)

---

**Last Updated**: December 2025
