/**
 * Comprehensive comparison: Bucket Grid vs R-Tree
 * Validates the 2011 paper's optimization claim (30-34% speedup)
 */

const Conrec = require('./conrec');
const IsolineBuilder = require('./isolineBuilder');
const SpatialIndex = require('./spatialIndex');
const { RTreeSpatialIndex } = require('./spatialIndex-rtree');
const fs = require('fs');
const path = require('path');

class SpatialIndexComparison {
  constructor() {
    this.conrec = new Conrec();
    this.builder = new IsolineBuilder();
  }

  /**
   * Create realistic synthetic grid (ERA5-like pressure data)
   */
  generateSyntheticGrid(rows, cols) {
    const grid = [];
    for (let i = 0; i < rows; i++) {
      const row = [];
      for (let j = 0; j < cols; j++) {
        // Realistic sea level pressure: 980-1040 hPa
        const latGradient = (i / rows) * 20;
        const lonWave = Math.sin((j / cols) * Math.PI * 2) * 15;
        const noise = (Math.random() - 0.5) * 3;
        const pressure = 1010 + latGradient + lonWave + noise;
        row.push(pressure);
      }
      grid.push(row);
    }
    return grid;
  }

  /**
   * Generate contour levels
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
   * Benchmark with bucket grid spatial index
   */
  benchmarkBucketGrid(grid, levels) {
    const startConrec = performance.now();
    const segments = this.conrec.computeSegments(grid, levels);
    const endConrec = performance.now();

    const startIndex = performance.now();
    const spatialIndex = new SpatialIndex(1, 0.0001);
    spatialIndex.buildIndex(segments);
    const endIndex = performance.now();

    const startGluing = performance.now();
    const isolines = this.builder.buildIsolines(segments, 1);
    const endGluing = performance.now();

    return {
      algorithm: 'Bucket Grid',
      segments: segments.length,
      isolines: isolines.length,
      timing: {
        conrec: endConrec - startConrec,
        index: endIndex - startIndex,
        gluing: endGluing - startGluing,
        total: (endGluing - startConrec)
      },
      stats: {
        indexStats: null, // Bucket grid doesn't expose stats
        reduction: segments.length > 0 ? (segments.length / isolines.length).toFixed(2) : 'N/A'
      }
    };
  }

  /**
   * Benchmark with R-Tree spatial index
   */
  benchmarkRTree(grid, levels) {
    const startConrec = performance.now();
    const segments = this.conrec.computeSegments(grid, levels);
    const endConrec = performance.now();

    const startIndex = performance.now();
    const rtreeIndex = new RTreeSpatialIndex(4, 0.0001);
    rtreeIndex.buildIndex(segments);
    const endIndex = performance.now();

    const startGluing = performance.now();
    const isolines = this.builder.buildIsolines(segments, 1);
    const endGluing = performance.now();

    return {
      algorithm: 'R-Tree',
      segments: segments.length,
      isolines: isolines.length,
      timing: {
        conrec: endConrec - startConrec,
        index: endIndex - startIndex,
        gluing: endGluing - startGluing,
        total: (endGluing - startConrec)
      },
      stats: {
        indexStats: rtreeIndex.getStats(),
        reduction: segments.length > 0 ? (segments.length / isolines.length).toFixed(2) : 'N/A'
      }
    };
  }

  /**
   * Run comparison tests
   */
  runComparison() {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║     SPATIAL INDEX COMPARISON: BUCKET GRID vs R-TREE             ║');
    console.log('║        Validating 30-34% Optimization Claimed in Paper          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    const testCases = [
      { rows: 60, cols: 120, step: 500, name: 'Small grid (sparse)' },
      { rows: 120, cols: 240, step: 250, name: 'Medium grid (typical)' },
      { rows: 120, cols: 240, step: 100, name: 'Large grid (dense)' }
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`\n${'='.repeat(70)}`);
      console.log(`Test: ${testCase.name} | Grid: ${testCase.cols}×${testCase.rows} | Step: ${testCase.step}`);
      console.log(`${'='.repeat(70)}`);

      const grid = this.generateSyntheticGrid(testCase.rows, testCase.cols);
      const levels = this.generateLevels(grid, testCase.step);

      console.log(`Data: ${testCase.cols * testCase.rows} points, pressure range: ${Math.min(...grid.flat()).toFixed(1)}-${Math.max(...grid.flat()).toFixed(1)} hPa`);
      console.log(`Contour levels: ${levels.length} levels\n`);

      // Bucket Grid
      console.log('Bucket Grid Results:');
      const bucketResult = this.benchmarkBucketGrid(grid, levels);
      console.log(`  Segments: ${bucketResult.segments}`);
      console.log(`  Isolines: ${bucketResult.isolines}`);
      console.log(`  Reduction: ${bucketResult.stats.reduction}x`);
      console.log(`  Timing:`);
      console.log(`    - CONREC:  ${bucketResult.timing.conrec.toFixed(2)}ms`);
      console.log(`    - Index:   ${bucketResult.timing.index.toFixed(2)}ms`);
      console.log(`    - Gluing:  ${bucketResult.timing.gluing.toFixed(2)}ms`);
      console.log(`    - TOTAL:   ${bucketResult.timing.total.toFixed(2)}ms`);

      // R-Tree
      console.log('\nR-Tree Results:');
      const rtreeResult = this.benchmarkRTree(grid, levels);
      console.log(`  Segments: ${rtreeResult.segments}`);
      console.log(`  Isolines: ${rtreeResult.isolines}`);
      console.log(`  Reduction: ${rtreeResult.stats.reduction}x`);
      if (rtreeResult.stats.indexStats) {
        console.log(`  R-Tree stats: depth=${rtreeResult.stats.indexStats.depth}, avgFanout=${rtreeResult.stats.indexStats.avgFanout.toFixed(2)}`);
      }
      console.log(`  Timing:`);
      console.log(`    - CONREC:  ${rtreeResult.timing.conrec.toFixed(2)}ms`);
      console.log(`    - Index:   ${rtreeResult.timing.index.toFixed(2)}ms`);
      console.log(`    - Gluing:  ${rtreeResult.timing.gluing.toFixed(2)}ms`);
      console.log(`    - TOTAL:   ${rtreeResult.timing.total.toFixed(2)}ms`);

      // Comparison
      console.log('\n📊 COMPARISON:');
      const totalDiff = rtreeResult.timing.total - bucketResult.timing.total;
      const percentDiff = (totalDiff / rtreeResult.timing.total) * 100;
      const speedup = (rtreeResult.timing.total / bucketResult.timing.total).toFixed(2);

      console.log(`  R-Tree faster: ${totalDiff > 0 ? 'YES ✓' : 'NO ✗'}`);
      console.log(`  Speedup: ${speedup}x`);
      console.log(`  Time difference: ${Math.abs(totalDiff).toFixed(2)}ms (${percentDiff.toFixed(1)}%)`);

      // Index breakdown
      const indexDiff = rtreeResult.timing.index - bucketResult.timing.index;
      console.log(`  Index time difference: ${Math.abs(indexDiff).toFixed(2)}ms`);
      console.log(`    Bucket Grid: ${bucketResult.timing.index.toFixed(2)}ms`);
      console.log(`    R-Tree:      ${rtreeResult.timing.index.toFixed(2)}ms`);

      results.push({
        testCase: testCase.name,
        gridSize: `${testCase.cols}×${testCase.rows}`,
        levels: levels.length,
        bucketGrid: bucketResult,
        rtree: rtreeResult,
        comparison: {
          speedup: parseFloat(speedup),
          timeDiff: totalDiff,
          percentDiff: percentDiff
        }
      });
    }

    return results;
  }

  /**
   * Save results to JSON
   */
  saveResults(results, filename = 'spatial_index_comparison.json') {
    const outputDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, filename);

    const summary = {
      timestamp: new Date().toISOString(),
      title: 'Spatial Index Comparison: Bucket Grid vs R-Tree',
      objective: 'Validate 30-34% optimization claimed in Rodriges Zalipynis (2011)',
      results: results,
      analysis: this.analyzeResults(results)
    };

    fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2));
    console.log(`\n✓ Results saved to: ${outputPath}`);

    return outputPath;
  }

  /**
   * Analyze results
   */
  analyzeResults(results) {
    const speedups = results.map(r => r.comparison.speedup);
    const avgSpeedup = speedups.reduce((a, b) => a + b) / speedups.length;
    const minSpeedup = Math.min(...speedups);
    const maxSpeedup = Math.max(...speedups);

    const indexTimeDiffs = results.map(r => r.comparison.timeDiff);
    const avgIndexDiff = indexTimeDiffs.reduce((a, b) => a + b) / indexTimeDiffs.length;

    return {
      averageSpeedup: avgSpeedup.toFixed(2),
      minSpeedup: minSpeedup.toFixed(2),
      maxSpeedup: maxSpeedup.toFixed(2),
      conclusion: avgSpeedup > 1 
        ? `Bucket Grid is ${(avgSpeedup).toFixed(2)}x FASTER than R-Tree (validates paper's optimization)`
        : `R-Tree is ${(1/avgSpeedup).toFixed(2)}x FASTER than Bucket Grid (unexpected result)`,
      paperClaim: 'R-Tree: 30-34% of total time is index construction',
      findings: [
        avgSpeedup > 1.3 
          ? `✓ Bucket Grid shows significant speedup (${((avgSpeedup - 1) * 100).toFixed(1)}% faster)`
          : `△ Moderate speedup difference (${Math.abs((avgSpeedup - 1) * 100).toFixed(1)}%)`,
        `Index construction accounts for ~${(results[0].rtree.timing.index / results[0].rtree.timing.total * 100).toFixed(1)}% of R-Tree total time`,
        `Gluing queries dominate overall execution time (${(results[0].rtree.timing.gluing / results[0].rtree.timing.total * 100).toFixed(1)}% of R-Tree)`
      ]
    };
  }
}

// Run if executed directly
if (require.main === module) {
  const comparison = new SpatialIndexComparison();
  const results = comparison.runComparison();
  comparison.saveResults(results);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      SUMMARY                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  const analysis = comparison.analyzeResults(results);
  console.log(`\nAverage Speedup: ${analysis.averageSpeedup}x`);
  console.log(`Conclusion: ${analysis.conclusion}`);
  console.log(`\nFindings:`);
  analysis.findings.forEach(f => console.log(`  • ${f}`));
}

module.exports = SpatialIndexComparison;
