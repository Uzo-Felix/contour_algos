/**
 * Run R-Tree vs Bucket Grid comparison on REAL ERA5 data
 * Extends benchmark-comparison.js to work with actual CSV data
 */

const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');
const Conrec = require('./conrec');
const IsolineBuilder = require('./isolineBuilder');
const SpatialIndex = require('./spatialIndex');
const { RTreeSpatialIndex } = require('./spatialIndex-rtree');

class ERA5Benchmark {
  constructor() {
    this.conrec = new Conrec();
    this.builder = new IsolineBuilder();
  }

  /**
   * Load ERA5 data from CSV
   */
  loadERA5Data(csvPath) {
    return new Promise((resolve, reject) => {
      fs.readFile(csvPath, 'utf8', (err, data) => {
        if (err) reject(err);

        Papa.parse(data, {
          header: false,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            // Convert to simple 2D grid
            const values = results.data
              .slice(1)
              .flat()
              .filter(v => typeof v === 'number');

            console.log(`✓ Loaded ${values.length} data points from ERA5 CSV`);

            // Create 2D grid: 100×150 subset
            const testRows = 100;
            const testCols = 150;
            const grid = [];

            for (let i = 0; i < testRows; i++) {
              grid[i] = [];
              for (let j = 0; j < testCols; j++) {
                const idx = Math.min(i * testCols + j, values.length - 1);
                grid[i][j] = values[idx];
              }
            }

            // Get stats
            const flatGrid = grid.flat();
            const minVal = Math.min(...flatGrid);
            const maxVal = Math.max(...flatGrid);

            resolve({
              grid,
              rows: testRows,
              cols: testCols,
              minVal,
              maxVal,
              range: maxVal - minVal
            });
          },
          error: reject
        });
      });
    });
  }

  /**
   * Generate isoline levels from ERA5 data range
   */
  generateLevels(minVal, maxVal, count = 10) {
    const levels = [];
    const step = (maxVal - minVal) / (count + 1);
    for (let i = 1; i <= count; i++) {
      levels.push(minVal + step * i);
    }
    return levels;
  }

  /**
   * Benchmark with Bucket Grid on ERA5 data
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
        total: endGluing - startConrec
      }
    };
  }

  /**
   * Benchmark with R-Tree on ERA5 data
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
        total: endGluing - startConrec
      },
      stats: rtreeIndex.getStats()
    };
  }

  /**
   * Run full benchmark
   */
  async run(csvPath) {
    console.log('╔════════════════════════════════════════════════════════════════╗');
    console.log('║   R-TREE vs BUCKET GRID - ERA5 REAL DATA BENCHMARK            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');

    try {
      const data = await this.loadERA5Data(csvPath);
      console.log(`\n📐 Grid: ${data.cols}×${data.rows} = ${data.cols * data.rows} cells`);
      console.log(`📊 Pressure range: ${data.minVal.toFixed(2)} - ${data.maxVal.toFixed(2)} hPa\n`);

      const levels = this.generateLevels(data.minVal, data.maxVal, 10);
       
      console.log(`🎯 Testing with ${levels.length} isoline levels:`);
      levels.forEach((level, i) => {
        console.log(`  Level ${i + 1}: ${level.toFixed(2)} hPa`);
      });
      console.log();

      const results = [];

      // Run benchmark for each level
      for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
        const level = levels[levelIdx];
        console.log(`\n${'='.repeat(70)}`);
        console.log(`Level ${levelIdx + 1}: ${level.toFixed(2)} hPa`);
        console.log(`${'='.repeat(70)}`);

        // Bucket Grid
        console.log('\nBucket Grid:');
        const bucketResult = this.benchmarkBucketGrid(data.grid, [level]);
        console.log(`  Segments: ${bucketResult.segments}`);
        console.log(`  Isolines: ${bucketResult.isolines}`);
        console.log(`  Timing:`);
        console.log(`    - CONREC:  ${bucketResult.timing.conrec.toFixed(2)}ms`);
        console.log(`    - Index:   ${bucketResult.timing.index.toFixed(2)}ms`);
        console.log(`    - Gluing:  ${bucketResult.timing.gluing.toFixed(2)}ms`);
        console.log(`    - TOTAL:   ${bucketResult.timing.total.toFixed(2)}ms`);

        // R-Tree
        console.log('\nR-Tree:');
        const rtreeResult = this.benchmarkRTree(data.grid, [level]);
        console.log(`  Segments: ${rtreeResult.segments}`);
        console.log(`  Isolines: ${rtreeResult.isolines}`);
        if (rtreeResult.stats) {
          console.log(`  Stats: depth=${rtreeResult.stats.depth}, avgFanout=${rtreeResult.stats.avgFanout.toFixed(2)}`);
        }
        console.log(`  Timing:`);
        console.log(`    - CONREC:  ${rtreeResult.timing.conrec.toFixed(2)}ms`);
        console.log(`    - Index:   ${rtreeResult.timing.index.toFixed(2)}ms`);
        console.log(`    - Gluing:  ${rtreeResult.timing.gluing.toFixed(2)}ms`);
        console.log(`    - TOTAL:   ${rtreeResult.timing.total.toFixed(2)}ms`);

        // Comparison
        console.log('\n📊 Comparison:');
        const timeDiff = rtreeResult.timing.total - bucketResult.timing.total;
        const speedup = (rtreeResult.timing.total / bucketResult.timing.total).toFixed(2);
        const percentDiff = ((timeDiff / rtreeResult.timing.total) * 100).toFixed(1);

        console.log(`  Speedup (R-Tree / Bucket Grid): ${speedup}x`);
        console.log(`  Time difference: ${Math.abs(timeDiff).toFixed(2)}ms (${percentDiff}%)`);
        console.log(`  Winner: ${timeDiff > 0 ? 'BUCKET GRID ✓' : 'R-TREE ✓'}`);

        results.push({
          level: level.toFixed(2),
          bucketGrid: bucketResult,
          rtree: rtreeResult,
          speedup: parseFloat(speedup),
          timeDiff: timeDiff,
          percentDiff: parseFloat(percentDiff)
        });
      }

      // Overall summary
      console.log(`\n${'='.repeat(70)}`);
      console.log('OVERALL SUMMARY');
      console.log(`${'='.repeat(70)}`);

      const avgSpeedup = results.reduce((sum, r) => sum + r.speedup, 0) / results.length;
      const totalBucketTime = results.reduce((sum, r) => sum + r.bucketGrid.timing.total, 0);
      const totalRTreeTime = results.reduce((sum, r) => sum + r.rtree.timing.total, 0);

      console.log(`\nTotal time (${levels.length} levels):`);
      console.log(`  Bucket Grid: ${totalBucketTime.toFixed(2)}ms`);
      console.log(`  R-Tree:      ${totalRTreeTime.toFixed(2)}ms`);
      console.log(`\nAverage speedup: ${avgSpeedup.toFixed(2)}x`);
      console.log(`Overall winner: ${totalRTreeTime > totalBucketTime ? 'BUCKET GRID' : 'R-TREE'}`);

      // Save results
      this.saveResults(results, {
        gridSize: `${data.cols}×${data.rows}`,
        pressureRange: `${data.minVal.toFixed(2)}-${data.maxVal.toFixed(2)} hPa`,
        levels: levels.length,
        avgSpeedup: avgSpeedup.toFixed(2),
        totalBucketTime: totalBucketTime.toFixed(2),
        totalRTreeTime: totalRTreeTime.toFixed(2)
      });

    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  }

  /**
   * Save results
   */
  saveResults(results, summary) {
    const outputDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, 'era5_benchmark_comparison.json');
    const output = {
      timestamp: new Date().toISOString(),
      title: 'ERA5 Real Data Benchmark: R-Tree vs Bucket Grid',
      summary,
      results
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✓ Results saved to: ${outputPath}\n`);
  }
}

// Run if executed directly
if (require.main === module) {
  const csvPath = path.join(__dirname, 'msl.csv');
  const benchmark = new ERA5Benchmark();
  benchmark.run(csvPath);
}

module.exports = ERA5Benchmark;
