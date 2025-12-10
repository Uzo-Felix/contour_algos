/**
 * Comprehensive benchmark suite for isoline construction
 * Tests all three stages with performance metrics and validation
 */

const Conrec = require('./conrec');
const IsolineBuilder = require('./isolineBuilder');
const fs = require('fs');
const path = require('path');

class IsolineBenchmark {
  constructor() {
    this.conrec = new Conrec();
    this.builder = new IsolineBuilder();
    this.results = [];
  }

  /**
   * Create synthetic grid data (like ERA5 mean sea level pressure)
   * Realistic pressure values: 980-1040 hPa
   */
  generateSyntheticGrid(rows, cols) {
    const grid = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        // Create pressure gradients with some variation
        const latGradient = (i / rows) * 20; // 0-20 hPa variation by latitude
        const lonGradient = Math.sin((j / cols) * Math.PI * 2) * 10; // Sinusoidal variation
        const noise = (Math.random() - 0.5) * 5;
        const pressure = 1000 + latGradient + lonGradient + noise;
        row.push(pressure);
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Generate isoline levels like the paper does
   * Using formula: li = min + step × i (where step is in Pa)
   */
  generateLevels(grid, step = 5) {
    const flatData = grid.flat();
    const minVal = Math.min(...flatData);
    const maxVal = Math.max(...flatData);
    
    const levels = [];
    for (let val = minVal; val <= maxVal; val += step) {
      levels.push(val);
    }
    
    return levels;
  }

  /**
   * Stage 1 Benchmark: CONREC Algorithm
   */
  benchmarkConrec(grid, levels) {
    const startTime = performance.now();
    const segments = this.conrec.computeSegments(grid, levels);
    const endTime = performance.now();
    
    return {
      time: endTime - startTime,
      segments: segments.length,
      raw: segments
    };
  }

  /**
   * Stage 2 Benchmark: Segment Gluing (uses spatial index internally)
   */
  benchmarkGluing(segments) {
    const startTime = performance.now();
    const isolines = this.builder.buildIsolines(segments, 1);
    const endTime = performance.now();
    
    return {
      time: endTime - startTime,
      isolines: isolines.length,
      raw: isolines
    };
  }

  /**
   * Complete pipeline benchmark
   */
  benchmarkComplete(rows, cols, step = 5) {
    const grid = this.generateSyntheticGrid(rows, cols);
    const levels = this.generateLevels(grid, step);
    
    console.log(`\n=== BENCHMARK: ${rows}×${cols} grid, ${levels.length} levels, step=${step} ===`);
    console.log(`Grid dimensions: ${rows}×${cols} = ${rows * cols} points`);
    console.log(`Pressure range: ${Math.min(...grid.flat()).toFixed(1)} - ${Math.max(...grid.flat()).toFixed(1)} hPa`);
    console.log(`Contour levels: ${levels[0].toFixed(1)} to ${levels[levels.length-1].toFixed(1)} (${levels.length} levels)`);
    
    // Stage 1: CONREC
    console.log('\nStage 1: CONREC Algorithm');
    const conrecResult = this.benchmarkConrec(grid, levels);
    console.log(`  Time: ${conrecResult.time.toFixed(2)}ms`);
    console.log(`  Segments generated: ${conrecResult.segments}`);
    
    // Stage 2: Gluing
    console.log('\nStage 2: Segment Gluing (with Spatial Index)');
    const gluingResult = this.benchmarkGluing(conrecResult.raw);
    console.log(`  Time: ${gluingResult.time.toFixed(2)}ms`);
    console.log(`  Isolines produced: ${gluingResult.isolines}`);
    console.log(`  Reduction ratio: ${(conrecResult.segments / gluingResult.isolines).toFixed(1)}x`);
    
    // Totals
    const totalTime = conrecResult.time + gluingResult.time;
    console.log('\n=== TOTALS ===');
    console.log(`Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`CONREC share: ${(conrecResult.time / totalTime * 100).toFixed(1)}%`);
    console.log(`Gluing share: ${(gluingResult.time / totalTime * 100).toFixed(1)}%`);
    
    return {
      grid: { rows, cols, points: rows * cols },
      levels: { count: levels.length, step, range: [levels[0], levels[levels.length-1]] },
      conrec: conrecResult,
      gluing: gluingResult,
      total: totalTime
    };
  }

  /**
   * Run suite of benchmarks matching paper's test cases
   */
  runTestSuite() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║        ISOLINE CONSTRUCTION BENCHMARK SUITE                    ║');
    console.log('║      Based on Rodriges Zalipynis (2011) test methodology      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    
    // Test cases matching the paper's performance evaluation
    // Table 2: ERA-Interim 1.5°×1.5° (240×120 points) with different steps
    const testCases = [
      { rows: 120, cols: 240, step: 1000, name: 'Large step (sparse)' },
      { rows: 120, cols: 240, step: 500, name: 'Medium step' },
      { rows: 120, cols: 240, step: 250, name: 'Fine step' },
      { rows: 120, cols: 240, step: 100, name: 'Very fine step (dense)' }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      const result = this.benchmarkComplete(testCase.rows, testCase.cols, testCase.step);
      result.name = testCase.name;
      results.push(result);
    }
    
    // Summary table
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    SUMMARY TABLE                               ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n${'Step'.padEnd(8)} | ${'Segments'.padEnd(10)} | ${'Isolines'.padEnd(10)} | ${'Reduction'.padEnd(12)} | ${'Total Time'.padEnd(12)}`);
    console.log('-'.repeat(80));
    
    for (const result of results) {
      const reduction = (result.conrec.segments / result.gluing.isolines).toFixed(1) + 'x';
      const time = result.total.toFixed(2) + 'ms';
      console.log(
        `${result.grid.cols}×${result.grid.rows}`.padEnd(8) + 
        `| ${result.conrec.segments}`.padEnd(10) + 
        `| ${result.gluing.isolines}`.padEnd(10) + 
        `| ${reduction}`.padEnd(12) + 
        `| ${time}`.padEnd(12)
      );
    }
    
    return results;
  }

  /**
   * Verify correctness: check that isolines are properly closed
   */
  verifyCorrectness(isolines) {
    const stats = {
      total: isolines.length,
      closed: 0,
      open: 0,
      errors: []
    };
    
    for (let i = 0; i < isolines.length; i++) {
      const isoline = isolines[i];
      
      // Must have at least 3 points
      if (isoline.length < 3) {
        stats.errors.push(`Isoline ${i}: fewer than 3 points (${isoline.length})`);
        continue;
      }
      
      // Check closure
      const first = isoline[0];
      const last = isoline[isoline.length - 1];
      const dist = Math.sqrt((first.lat - last.lat) ** 2 + (first.lon - last.lon) ** 2);
      
      if (dist < 0.001) {
        stats.closed++;
      } else {
        stats.open++;
      }
      
      // Check for NaN
      for (let j = 0; j < isoline.length; j++) {
        const point = isoline[j];
        if (isNaN(point.lat) || isNaN(point.lon)) {
          stats.errors.push(`Isoline ${i}, point ${j}: NaN coordinates`);
        }
      }
    }
    
    return stats;
  }

  /**
   * Save results to file
   */
  saveResults(results, filename = 'benchmark_results.json') {
    const outputPath = path.join(__dirname, '..', 'results', filename);
    
    // Create results directory if needed
    const resultsDir = path.dirname(outputPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const output = {
      timestamp: new Date().toISOString(),
      results: results,
      summary: {
        totalTests: results.length,
        averageTime: (results.reduce((sum, r) => sum + r.total, 0) / results.length).toFixed(2) + 'ms',
        totalSegments: results.reduce((sum, r) => sum + r.conrec.segments, 0),
        totalIsolines: results.reduce((sum, r) => sum + r.gluing.isolines, 0)
      }
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✓ Results saved to: ${outputPath}`);
    
    return outputPath;
  }
}

// Run if executed directly
if (require.main === module) {
  const benchmark = new IsolineBenchmark();
  const results = benchmark.runTestSuite();
  benchmark.saveResults(results);
}

module.exports = IsolineBenchmark;
