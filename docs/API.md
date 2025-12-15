# API Reference

Complete API documentation for the isoline construction library.

## Table of Contents

1. [IsolineBuilder](#isolinebuilder)
2. [CONREC](#conrec)
3. [Spatial Indexing](#spatial-indexing)
4. [Data Structures](#data-structures)
5. [Error Handling](#error-handling)

---

## IsolineBuilder

Main orchestrator class that manages the complete three-stage pipeline.

### Constructor

```javascript
new IsolineBuilder(grid, width, height, indexType = 'bucket')
```

**Parameters:**
- `grid` (Array<Array<number>>): 2D array of scalar values
- `width` (number): Grid width (number of columns)
- `height` (number): Grid height (number of rows)
- `indexType` (string): Spatial index type, either `'bucket'` or `'rtree'` (default: `'bucket'`)

**Example:**
```javascript
const grid = Array(100).fill(null).map(() => 
  Array(100).fill(null).map(() => Math.random() * 100)
);

const builder = new IsolineBuilder(grid, 100, 100, 'bucket');
```

### Methods

#### generateIsolines(level)

Generate isolines for a specific scalar value.

```javascript
generateIsolines(level)
```

**Parameters:**
- `level` (number): The scalar value at which to generate isolines

**Returns:**
```javascript
{
  segments: Array<[number, number], [number, number]>,  // Raw segments
  polylines: Array<Array<[number, number]>>,            // Open paths
  polygons: Array<Array<[number, number]>>,             // Closed paths
  count: {
    segments: number,
    polylines: number,
    polygons: number
  },
  closureRate: number  // Percentage of segments in closed contours
}
```

**Example:**
```javascript
const isolines = builder.generateIsolines(50);
console.log(`Generated ${isolines.count.segments} segments`);
console.log(`Closure rate: ${isolines.closureRate}%`);
```

#### getResults()

Get comprehensive metrics from the last `generateIsolines()` call.

```javascript
getResults()
```

**Returns:**
```javascript
{
  timing: {
    conrec: number,      // CONREC generation time (ms)
    indexing: number,    // Index construction time (ms)
    gluing: number,      // Segment gluing time (ms)
    total: number        // Total time (ms)
  },
  segments: Array<...>,
  polylines: Array<...>,
  polygons: Array<...>,
  metrics: {
    segmentCount: number,
    polylineCount: number,
    polygonCount: number,
    closureRate: number,
    avgSegmentsPerContour: number
  },
  gridInfo: {
    width: number,
    height: number,
    cellSize: number
  }
}
```

**Example:**
```javascript
const result = builder.getResults();
console.log(`CONREC: ${result.timing.conrec}ms`);
console.log(`Indexing: ${result.timing.indexing}ms`);
console.log(`Gluing: ${result.timing.gluing}ms`);
console.log(`Closure Rate: ${result.metrics.closureRate}%`);
```

---

## CONREC

Low-level CONREC algorithm implementation. Use `IsolineBuilder` for typical usage; use CONREC directly for advanced scenarios.

### generateSegments(grid, level, gridWidth, gridHeight)

Generate raw isoline segments at a specific level.

```javascript
const { generateSegments } = require('./src/conrec');

generateSegments(grid, level, gridWidth, gridHeight)
```

**Parameters:**
- `grid` (Array<Array<number>>): 2D scalar field
- `level` (number): Isoline level
- `gridWidth` (number): Grid width
- `gridHeight` (number): Grid height

**Returns:**
```javascript
Array<[[x1, y1], [x2, y2]], ...>  // Array of segments
```

**Example:**
```javascript
const segments = generateSegments(grid, 50, 100, 100);
console.log(`Generated ${segments.length} segments`);

segments.forEach(([start, end]) => {
  console.log(`Segment: (${start[0]}, ${start[1]}) -> (${end[0]}, ${end[1]})`);
});
```

**Time Complexity:** O(m·n) where m, n are grid dimensions

**Note:** All segments are generated independently; they may be disconnected.

---

## Spatial Indexing

Two spatial index implementations with identical interfaces.

### BucketGrid

Hash-based grid partitioning for constant-time spatial queries.

#### Constructor

```javascript
const { BucketGrid } = require('./src/spatialIndex');

new BucketGrid(width, height, cellSize = 10)
```

**Parameters:**
- `width` (number): Index width
- `height` (number): Index height
- `cellSize` (number): Size of each bucket cell (default: 10)

**Example:**
```javascript
const index = new BucketGrid(100, 100, 10);
```

#### insert(x, y, segment)

Insert a segment with a specific start point.

```javascript
insert(x, y, segment)
```

**Parameters:**
- `x` (number): X coordinate
- `y` (number): Y coordinate
- `segment` (Object): Segment object with endpoint information

**Example:**
```javascript
const segment = { id: 1, start: [10.5, 20.3], end: [11.2, 21.1] };
index.insert(10.5, 20.3, segment);
```

#### search(x, y, radius)

Find all segments near a point within a radius.

```javascript
search(x, y, radius)
```

**Parameters:**
- `x` (number): Query X coordinate
- `y` (number): Query Y coordinate
- `radius` (number): Search radius

**Returns:**
```javascript
Array<Object>  // Array of segment objects
```

**Time Complexity:** O(1) average case

**Example:**
```javascript
const nearby = index.search(10.5, 20.3, 0.5);
console.log(`Found ${nearby.length} segments near (10.5, 20.3)`);
```

### RTreeIndex

R-Tree spatial index using rbush library. Provides O(log n) query time.

#### Constructor

```javascript
const { RTreeIndex } = require('./src/spatialIndex-rtree');

new RTreeIndex()
```

**Example:**
```javascript
const index = new RTreeIndex();
```

#### insert(segment)

Insert a segment into the R-Tree.

```javascript
insert(segment)
```

**Parameters:**
- `segment` (Object): Must have structure `{ minX, minY, maxX, maxY, data }`

**Example:**
```javascript
const segment = {
  minX: 10.5, minY: 20.3,
  maxX: 11.2, maxY: 21.1,
  data: { id: 1, endpoints: [[10.5, 20.3], [11.2, 21.1]] }
};
index.insert(segment);
```

#### search(point, epsilon)

Find all segments within epsilon distance of a point.

```javascript
search(point, epsilon)
```

**Parameters:**
- `point` (Array<number>): Query point [x, y]
- `epsilon` (number): Search tolerance

**Returns:**
```javascript
Array<Object>  // Array of segment objects
```

**Time Complexity:** O(log n) + k, where k is number of results

**Example:**
```javascript
const nearby = index.search([10.5, 20.3], 0.5);
console.log(`Found ${nearby.length} segments`);
```

---

## Data Structures

### Segment

Individual line segment representing part of an isoline.

```javascript
{
  start: [number, number],    // Start point [x, y]
  end: [number, number],      // End point [x, y]
  level: number,              // Isoline level
  processed: boolean,         // Segment gluing status
  id: number                  // Unique identifier (optional)
}
```

### Isoline (Polyline/Polygon)

Continuous path representing a complete isoline contour.

```javascript
// Polyline (open path)
[[x1, y1], [x2, y2], ..., [xn, yn]]

// Polygon (closed path)
[[x1, y1], [x2, y2], ..., [xn, yn], [x1, y1]]  // Returns to start
```

### Result Object

Complete result from `generateIsolines()`.

```javascript
{
  // Raw output
  segments: Array<[[number, number], [number, number]]>,
  
  // Processed output
  polylines: Array<Array<[number, number]>>,
  polygons: Array<Array<[number, number]>>,
  
  // Metrics
  count: {
    segments: number,
    polylines: number,
    polygons: number
  },
  
  // Quality metrics
  closureRate: number,           // % of segments in closed contours
  avgSegmentsPerContour: number, // Average segments per contour
  
  // Timing (ms)
  timing: {
    conrec: number,
    indexing: number,
    gluing: number,
    total: number
  }
}
```

---

## Error Handling

### Input Validation

```javascript
try {
  const builder = new IsolineBuilder(null, 100, 100);
  // Throws: "Grid must be a 2D array"
} catch (error) {
  console.error(error.message);
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Grid must be a 2D array" | Invalid grid input | Ensure grid is Array<Array<number>> |
| "Grid dimensions mismatch" | Grid size ≠ (width × height) | Fix grid dimensions |
| "Invalid index type" | indexType not 'bucket' or 'rtree' | Use valid index type |
| "Invalid isoline level" | level not a number | Ensure level is numeric |
| "Memory error" | Grid too large | Reduce grid size or use tiling |

### Graceful Degradation

```javascript
const builder = new IsolineBuilder(grid, width, height, 'bucket');

try {
  const result = builder.generateIsolines(level);
  
  if (result.metrics.closureRate < 90) {
    console.warn('Low closure rate - check grid/epsilon values');
  }
} catch (error) {
  // Fallback behavior
  console.error('Isoline generation failed:', error);
  return defaultResult;
}
```

---

## Performance Tuning

### Spatial Index Selection

```javascript
// For regular grids (RECOMMENDED)
const builder = new IsolineBuilder(grid, w, h, 'bucket');

// For sparse/variable-density data
const builder = new IsolineBuilder(grid, w, h, 'rtree');
```

### Tolerance Adjustment

The tolerance parameter (ε) affects segment gluing accuracy:

```javascript
// Tight tolerance (more strict matching)
epsilon = 0.001;  // 0.1% of cell size

// Default tolerance
epsilon = 0.01;   // 1% of cell size (RECOMMENDED)

// Loose tolerance (more aggressive merging)
epsilon = 0.1;    // 10% of cell size
```

### Processing Multiple Levels

```javascript
const builder = new IsolineBuilder(grid, width, height, 'bucket');

// Efficient: index created once, reused
const levels = [100, 110, 120, 130, 140];

levels.forEach(level => {
  const result = builder.generateIsolines(level);
  console.log(`Level ${level}: ${result.count.polylines} contours`);
});
```

---

## Advanced Usage

### Direct Module Access

```javascript
// CONREC only
const { generateSegments } = require('./src/conrec');

// Spatial indexing only
const { BucketGrid } = require('./src/spatialIndex');
const { RTreeIndex } = require('./src/spatialIndex-rtree');

// Full pipeline
const IsolineBuilder = require('./src/isolineBuilder');
```

### Custom Integration

```javascript
const { generateSegments } = require('./src/conrec');
const { BucketGrid } = require('./src/spatialIndex');

// Manual three-stage pipeline
const segments = generateSegments(grid, level, width, height);

const index = new BucketGrid(width, height);
segments.forEach(([start, end], idx) => {
  index.insert(start[0], start[1], {
    id: idx,
    start: start,
    end: end
  });
});

// Custom gluing logic...
```

---

## Type Definitions (TypeScript)

```typescript
interface Segment {
  start: [number, number];
  end: [number, number];
  level?: number;
  processed?: boolean;
  id?: number;
}

interface IsolineResult {
  segments: Segment[];
  polylines: Array<Array<[number, number]>>;
  polygons: Array<Array<[number, number]>>;
  count: {
    segments: number;
    polylines: number;
    polygons: number;
  };
  closureRate: number;
  timing: {
    conrec: number;
    indexing: number;
    gluing: number;
    total: number;
  };
}

declare class IsolineBuilder {
  constructor(grid: number[][], width: number, height: number, indexType?: 'bucket' | 'rtree');
  generateIsolines(level: number): IsolineResult;
  getResults(): any;
}
```

---

## Examples

See `examples/` directory for complete runnable examples:

- `basic-usage.js` - Simple grid generation and isoline extraction
- `era5-processing.js` - Processing real climate data
- `performance-comparison.js` - R-Tree vs Bucket Grid benchmark
- `visualization.js` - Preparing output for web visualization

---

## Version History

- **v1.0.0** (2025-12-30): Initial release with full three-stage pipeline, both spatial index implementations, and comprehensive benchmarking

---

**Last Updated**: December 2025
