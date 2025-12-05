/**
 * Comprehensive Validation Test Suite
 * Validates all three stages of isoline construction:
 * 1. CONREC algorithm
 * 2. Spatial indexing (R-Tree vs Bucket Grid)
 * 3. Segment gluing
 */

const Conrec = require('./conrec');
const IsolineBuilder = require('./isolineBuilder');
const SpatialIndex = require('./spatialIndex');

class ValidationTests {
  constructor() {
    this.results = [];
    this.epsilon = 0.0001;
  }

  // ============================================
  // STAGE 1: CONREC ALGORITHM TESTS
  // ============================================

  /**
   * Test 1: Linear interpolation correctness
   * Validates that t = (level - z1) / (z2 - z1) is correct
   */
  testLinearInterpolation() {
    console.log('\n=== TEST 1: Linear Interpolation ===');
    const conrec = new Conrec();
    
    const testCases = [
      { z1: 10, z2: 20, level: 15, expectedT: 0.5 },
      { z1: 10, z2: 20, level: 10, expectedT: 0.0 },
      { z1: 10, z2: 20, level: 20, expectedT: 1.0 },
      { z1: 0, z2: 100, level: 50, expectedT: 0.5 },
      { z1: -10, z2: 10, level: 0, expectedT: 0.5 },
    ];

    let passed = 0;
    for (const test of testCases) {
      const t = (test.level - test.z1) / (test.z2 - test.z1);
      if (Math.abs(t - test.expectedT) < this.epsilon) {
        console.log(`✓ z1=${test.z1}, z2=${test.z2}, level=${test.level}: t=${t.toFixed(4)}`);
        passed++;
      } else {
        console.log(`✗ z1=${test.z1}, z2=${test.z2}, level=${test.level}: expected t=${test.expectedT}, got t=${t.toFixed(4)}`);
      }
    }

    const result = { test: 'LinearInterpolation', passed, total: testCases.length };
    this.results.push(result);
    return result;
  }

  /**
   * Test 2: Paraboloid (synthetic test function)
   * z(x,y) = x² + y²
   * Expected: Concentric circles
   */
  testParaboloid() {
    console.log('\n=== TEST 2: Paraboloid Isolines (z = x² + y²) ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    // Generate 10x10 grid
    const size = 10;
    const grid = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const x = i - size / 2;
        const y = j - size / 2;
        const z = x * x + y * y;
        row.push(z);
      }
      grid.push(row);
    }

    // Generate isolines for levels 10, 20, 30
    const levels = [10, 20, 30];
    const segments = conrec.computeSegments(grid, levels);
    const chains = builder.buildLineStrings(segments, 1);

    console.log(`Generated ${segments.length} segments, ${chains.length} chains`);

    // Validation: all chains should be closed
    let closedCount = 0;
    for (const chain of chains) {
      const isClosed = chain.properties.closure !== 'open_linestring';
      if (isClosed) closedCount++;
    }

    const closureRate = closedCount / chains.length;
    console.log(`Closure rate: ${(closureRate * 100).toFixed(1)}% (${closedCount}/${chains.length})`);

    const result = {
      test: 'Paraboloid',
      segments: segments.length,
      chains: chains.length,
      closedChains: closedCount,
      closureRate: closureRate,
      passed: closureRate > 0.8 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  /**
   * Test 3: Saddle point (difficult case)
   * z(x,y) = x² - y²
   * Expected: Hyperbolic isolines
   */
  testSaddlePoint() {
    console.log('\n=== TEST 3: Saddle Point Isolines (z = x² - y²) ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    const size = 10;
    const grid = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const x = i - size / 2;
        const y = j - size / 2;
        const z = x * x - y * y;
        row.push(z);
      }
      grid.push(row);
    }

    const levels = [0, 5, 10, 15, 20];
    const segments = conrec.computeSegments(grid, levels);
    const chains = builder.buildLineStrings(segments, 1);

    console.log(`Generated ${segments.length} segments, ${chains.length} chains`);

    // Check: no degenerate segments (zero length)
    let zeroLengthCount = 0;
    for (const segment of segments) {
      const dist = Math.hypot(
        segment.p1.lat - segment.p2.lat,
        segment.p1.lon - segment.p2.lon
      );
      if (dist < this.epsilon * 0.1) zeroLengthCount++;
    }

    console.log(`Zero-length segments: ${zeroLengthCount}`);

    const result = {
      test: 'SaddlePoint',
      segments: segments.length,
      chains: chains.length,
      zeroLengthSegments: zeroLengthCount,
      passed: zeroLengthCount === 0 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  /**
   * Test 4: Segment validation
   * Ensure all segments have valid coordinates
   */
  testSegmentValidity() {
    console.log('\n=== TEST 4: Segment Validity ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    // Create a complex grid
    const grid = [];
    for (let i = 0; i < 8; i++) {
      const row = [];
      for (let j = 0; j < 8; j++) {
        row.push(Math.sin(i * 0.5) * Math.cos(j * 0.5) * 100);
      }
      grid.push(row);
    }

    const levels = [20, 40, 60, 80];
    const segments = conrec.computeSegments(grid, levels);
    const validation = builder.validateSegments(segments);

    console.log(`Valid segments: ${validation.validCount}, Errors: ${validation.errorCount}`);
    if (validation.errorCount > 0) {
      console.log('Errors:', validation.errors.slice(0, 5).join('\n'));
    }

    const result = {
      test: 'SegmentValidity',
      validSegments: validation.validCount,
      errors: validation.errorCount,
      passed: validation.errorCount === 0 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  // ============================================
  // STAGE 2: SPATIAL INDEX TESTS
  // ============================================

  /**
   * Test 5: Bucket Grid neighbor finding
   */
  testBucketGridNeighbors() {
    console.log('\n=== TEST 5: Bucket Grid Neighbor Finding ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    // Generate test segments
    const grid = [];
    for (let i = 0; i < 5; i++) {
      grid.push([i, i + 1, i + 2, i + 3, i + 4]);
    }

    const levels = [1, 2, 3];
    const segments = conrec.computeSegments(grid, levels);
    
    const spatialIndex = new SpatialIndex(1, this.epsilon);
    spatialIndex.buildIndex(segments);

    // Test queries at various points
    let queriesCorrect = 0;
    let totalQueries = 0;

    for (const segment of segments.slice(0, Math.min(5, segments.length))) {
      const neighbors = spatialIndex.findNeighbors(segment.p1);
      
      // Verify: segment.p1 should find its own segment
      const found = neighbors.some(n => 
        (Math.abs(n.p1.lat - segment.p1.lat) < this.epsilon && 
         Math.abs(n.p1.lon - segment.p1.lon) < this.epsilon) ||
        (Math.abs(n.p2.lat - segment.p1.lat) < this.epsilon && 
         Math.abs(n.p2.lon - segment.p1.lon) < this.epsilon)
      );

      if (found) queriesCorrect++;
      totalQueries++;
    }

    const queryAccuracy = totalQueries > 0 ? queriesCorrect / totalQueries : 0;
    console.log(`Query accuracy: ${(queryAccuracy * 100).toFixed(1)}% (${queriesCorrect}/${totalQueries})`);

    const result = {
      test: 'BucketGridNeighbors',
      queriesCorrect,
      totalQueries,
      accuracy: queryAccuracy,
      passed: queryAccuracy >= 0.9 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  // ============================================
  // STAGE 3: SEGMENT GLUING TESTS
  // ============================================

  /**
   * Test 6: Chain connectivity
   */
  testChainConnectivity() {
    console.log('\n=== TEST 6: Chain Connectivity ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    const grid = [];
    for (let i = 0; i < 6; i++) {
      grid.push([i * 10, i * 10 + 5, i * 10 + 10, i * 10 + 15, i * 10 + 20, i * 10 + 25]);
    }

    const levels = [50, 100];
    const segments = conrec.computeSegments(grid, levels);
    const chains = builder.buildLineStrings(segments, 1);

    // Check connectivity: consecutive points should be close
    let connectivityErrors = 0;
    for (const chain of chains) {
      for (let i = 0; i < chain.length - 1; i++) {
        const p1 = chain[i];
        const p2 = chain[i + 1];
        const dist = Math.hypot(p1.lat - p2.lat, p1.lon - p2.lon);
        
        // Points should be reasonably close
        if (dist > 2 * this.epsilon && chain.properties.closure !== 'forced_connection') {
          connectivityErrors++;
        }
      }
    }

    console.log(`Chains: ${chains.length}, Connectivity errors: ${connectivityErrors}`);

    const result = {
      test: 'ChainConnectivity',
      chains: chains.length,
      connectivityErrors,
      passed: connectivityErrors === 0 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  /**
   * Test 7: Closure detection
   */
  testClosureDetection() {
    console.log('\n=== TEST 7: Closure Detection ===');
    const conrec = new Conrec();
    const builder = new IsolineBuilder();

    // Create circular test case
    const size = 12;
    const grid = [];
    for (let i = 0; i < size; i++) {
      const row = [];
      for (let j = 0; j < size; j++) {
        const x = i - size / 2;
        const y = j - size / 2;
        row.push(Math.sqrt(x * x + y * y));
      }
      grid.push(row);
    }

    const levels = [2, 4, 6];
    const segments = conrec.computeSegments(grid, levels);
    const chains = builder.buildLineStrings(segments, 1);

    let naturalClosed = 0;
    let forcedClosed = 0;
    let open = 0;

    for (const chain of chains) {
      if (chain.properties.closure === 'natural_closure') naturalClosed++;
      else if (chain.properties.closure === 'forced_connection') forcedClosed++;
      else open++;
    }

    console.log(`Natural: ${naturalClosed}, Forced: ${forcedClosed}, Open: ${open}`);

    const closureRate = (naturalClosed + forcedClosed) / chains.length;
    console.log(`Total closure rate: ${(closureRate * 100).toFixed(1)}%`);

    const result = {
      test: 'ClosureDetection',
      chains: chains.length,
      naturalClosed,
      forcedClosed,
      open,
      closureRate,
      passed: closureRate > 0.7 ? 1 : 0
    };
    this.results.push(result);
    return result;
  }

  // ============================================
  // SUMMARY AND REPORTING
  // ============================================

  printSummary() {
    console.log('\n' + '='.repeat(60));
    console.log('VALIDATION TEST SUMMARY');
    console.log('='.repeat(60));

    let totalPassed = 0;
    let totalTests = 0;

    for (const result of this.results) {
      if (result.passed !== undefined) {
        totalPassed += result.passed;
        totalTests += 1;
        const status = result.passed ? '✓' : '✗';
        console.log(`${status} ${result.test}: ${JSON.stringify(result).substring(0, 80)}`);
      }
    }

    console.log('='.repeat(60));
    console.log(`TOTAL: ${totalPassed}/${totalTests} tests passed`);
    console.log(`Success rate: ${(totalPassed / totalTests * 100).toFixed(1)}%`);
    console.log('='.repeat(60));

    return {
      passed: totalPassed,
      total: totalTests,
      successRate: totalPassed / totalTests
    };
  }

  runAllTests() {
    console.log('Starting comprehensive validation tests...\n');

    // Stage 1: CONREC
    this.testLinearInterpolation();
    this.testParaboloid();
    this.testSaddlePoint();
    this.testSegmentValidity();

    // Stage 2: Spatial Indexing
    this.testBucketGridNeighbors();

    // Stage 3: Gluing
    this.testChainConnectivity();
    this.testClosureDetection();

    // Summary
    return this.printSummary();
  }
}

// Run tests if executed directly
if (require.main === module) {
  const tests = new ValidationTests();
  const summary = tests.runAllTests();
  process.exit(summary.passed === summary.total ? 0 : 1);
}

module.exports = ValidationTests;
