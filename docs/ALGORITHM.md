# Algorithm Details

## Overview

This document provides a detailed technical explanation of the three-stage isoline construction method.

## The Three-Stage Method

### Stage 1: CONREC - Segment Generation

The CONREC (CONtour RECtangular) algorithm generates isoline segments by processing each grid cell independently.

#### Algorithm Steps

For each grid cell with corners at heights h₁, h₂, h₃, h₄, and target level z:

1. **Determine crossing**: Check if the isoline level z intersects this cell
   - If all corners > z or all corners < z: no intersection
   - Otherwise: compute intersection points

2. **Compute intersections**: For each edge with endpoints (h₁, h₂):
   ```
   If h₁ < z < h₂ or h₂ < z < h₁:
       t = (z - h₁) / (h₂ - h₁)
       intersection = p₁ + t(p₂ - p₁)
   ```

3. **Connect points**: Form segments from intersection points

4. **Handle saddle points**: When two opposite corners are on opposite sides
   - Use center-point interpolation to resolve ambiguity
   - Ensures topologically correct contours

#### 16 Marching Squares Cases

The algorithm handles 16 possible cases based on which corners are above/below z:

```
Case 0:  All below    → No intersection
Case 1:  1 above      → 1 segment
Case 2:  2 adjacent   → 1 segment
Case 3:  2 opposite   → Saddle point (2 segments)
...
Case 15: All above    → No intersection
```

#### Time Complexity

- **Per cell**: O(1) - constant time computation
- **Grid**: O(m × n) where m, n = dimensions
- **Multiple levels**: O(k × m × n) where k = number of levels
- **Overall**: Linear in total work (optimal)

#### Pseudocode

```
function generateSegments(grid, level, width, height):
    segments = []
    
    for each cell (i, j) in grid:
        h1 = grid[j][i]
        h2 = grid[j][i+1]
        h3 = grid[j+1][i+1]
        h4 = grid[j+1][i]
        
        // Determine case
        case = computeCase(h1, h2, h3, h4, level)
        
        if case indicates intersection:
            points = computeIntersections(case, [h1,h2,h3,h4], level)
            
            for each pair of points:
                segment = [point1, point2]
                segments.append(segment)
    
    return segments
```

---

### Stage 2: Spatial Indexing

Two spatial index implementations provide efficient lookup for Stage 3 segment gluing.

#### Bucket Grid (RECOMMENDED)

Hash-based spatial partitioning optimized for regular grids.

**Data Structure:**
```
buckets = 2D array of lists
Grid divided into uniform cells
Each cell contains references to segments
```

**Insert Operation:**
```
function insert(x, y, segment):
    bucket_i = floor(x / cellSize)
    bucket_j = floor(y / cellSize)
    buckets[bucket_i][bucket_j].append(segment)
```

**Search Operation:**
```
function search(x, y, radius):
    results = []
    bucket_i = floor(x / cellSize)
    bucket_j = floor(y / cellSize)
    
    // Check surrounding buckets
    for di in [-1, 0, 1]:
        for dj in [-1, 0, 1]:
            bi = bucket_i + di
            bj = bucket_j + dj
            
            if (bi, bj) is valid:
                for segment in buckets[bi][bj]:
                    if distance(segment_endpoint, (x,y)) < radius:
                        results.append(segment)
    
    return results
```

**Complexity:**
- **Query**: O(1) average case (constant number of buckets checked)
- **Insert**: O(1)
- **Construction**: O(n) where n = number of segments
- **Memory**: O(grid_area + n)

**Best For:**
- Regular latitude-longitude grids
- Uniform point distribution
- High performance requirements

#### R-Tree (Alternative)

Balanced tree structure with minimum bounding rectangles (MBRs).

**Data Structure:**
```
Node layout:
├── Internal Node
│   ├── MBR covering children
│   ├── Pointer to child 1
│   └── Pointer to child N
└── Leaf Node
    ├── MBR for segment
    └── Segment reference
```

**Search Operation:**
```
function search(point, epsilon):
    return searchNode(root, point, epsilon)

function searchNode(node, point, epsilon):
    results = []
    
    if node is leaf:
        for segment in node.segments:
            if distance(point, segment) < epsilon:
                results.append(segment)
    else:
        for child in node.children:
            if MBR(child) intersects circle(point, epsilon):
                results.append(searchNode(child, point, epsilon))
    
    return results
```

**Complexity:**
- **Query**: O(log n) + k, where k = results
- **Insert**: O(log n)
- **Construction**: O(n log n)
- **Memory**: O(n) with ~20% overhead

**Best For:**
- Sparse data
- Variable-density point distributions
- When range queries dominate

#### Comparison

| Metric | Bucket Grid | R-Tree |
|--------|-------------|--------|
| Query Time | O(1) | O(log n) |
| Construction | O(n) | O(n log n) |
| Memory Overhead | Minimal | ~20% |
| Best Case | Regular grids | Sparse data |
| Scalability | Linear | Logarithmic |

**Empirical Results on ERA5 (1440×721):**
- 302-3,000 segments: Similar performance (1.16-1.39×)
- 3,000+ segments: Bucket Grid dominates (2.04-4.45×)
- **Overall**: 62.7% faster with Bucket Grid

---

### Stage 3: Segment Gluing

Connects disconnected segments into continuous polylines and closed polygons.

#### Algorithm

```
function glueSegments(segments, spatialIndex, epsilon):
    polylines = []
    processed = set()
    
    while unprocessed segments exist:
        // Start new chain
        current_segment = next unprocessed segment
        chain = [current_segment]
        processed.add(current_segment.id)
        
        // Extend chain forward
        while true:
            endpoint = chain[-1].end
            
            // Find matching segments
            candidates = spatialIndex.search(endpoint, epsilon)
            
            match = null
            for candidate in candidates:
                if distance(endpoint, candidate.start) < epsilon:
                    if candidate not in processed:
                        match = candidate
                        break
            
            if match exists:
                chain.append(match)
                processed.add(match.id)
            else:
                break
        
        // Check if closed loop
        if distance(chain[0].start, chain[-1].end) < epsilon:
            polylines.append(closePath(chain))  // Polygon
        else:
            polylines.append(openPath(chain))   // Polyline
    
    return polylines
```

#### Tolerance Parameter

The tolerance ε must balance:

1. **Floating-point precision**: ~15 significant digits
2. **Grid resolution**: Grid cell size

**Recommended Setting:**
```
epsilon = 0.01 × grid_cell_size
```

**Example (ERA5):**
- Grid resolution: 0.25°
- Cell size: ~30 km at equator
- Recommended ε: 0.01 × 0.25° ≈ 0.0025°

#### Closure Rate Metric

Measures the quality of segment gluing:

```
closure_rate = (segments in closed loops / total segments) × 100%
```

**Interpretation:**
- >95%: Excellent topology
- 90-95%: Good topology
- 80-90%: Acceptable, may have isolated segments
- <80%: Increase ε or debug grid

#### Time Complexity

For proper spatial index selection:

- **Bucket Grid**: O(s × k) where s = segments, k = avg matches
- **R-Tree**: O(s × log s)
- **Overall**: Dominated by index performance

---

## Implementation Details

### Linear Interpolation

The core mathematical operation:

```
Given edge from (x₁, y₁, h₁) to (x₂, y₂, h₂)
Find intersection with isoline level z

t = (z - h₁) / (h₂ - h₁)
x = x₁ + t(x₂ - x₁)
y = y₁ + t(y₂ - y₁)

Constraints:
- 0 < t < 1 (intersection lies on edge)
- h₁ ≠ h₂ (avoid division by zero)
```

### Bilinear Interpolation (for saddle points)

Used to resolve ambiguous saddle point cases:

```
Center value = (h₁ + h₂ + h₃ + h₄) / 4

Compare center against level z to determine
correct connection pattern
```

### Floating-Point Tolerance

Distance metric for endpoint matching:

```
match(p₁, p₂, ε) = (|p₁.x - p₂.x|² + |p₁.y - p₂.y|²)^0.5 < ε
```

---

## Numerical Stability

### Precision Considerations

1. **Grid cell sizes**: Use consistent units
2. **Level values**: Ensure valid range for grid
3. **Tolerance**: Adjust for grid resolution
4. **Coordinate system**: Consider projection effects

### Edge Cases

1. **All values identical**: No contours generated
2. **Level outside data range**: Empty result
3. **Isolated peaks/valleys**: Single closed loops
4. **Flat regions**: Disconnected segments or no segments

---

## Performance Optimization

### Algorithm Level

1. **Spatial indexing**: Choose based on data distribution
2. **Level selection**: Process levels in order
3. **Index reuse**: Build once, query many times
4. **Batch processing**: Process multiple levels efficiently

### Implementation Level

1. **Loop unrolling**: Optimize tight loops
2. **Memory locality**: Cache-friendly data structures
3. **Lazy evaluation**: Compute only needed data
4. **Parallel processing**: Process independent grid cells

### Parallelization Opportunities

- **CONREC**: Embarrassingly parallel (process cells independently)
- **Gluing**: Limited parallelism (sequential chain building)
- **Index construction**: Vectorizable operations

---

## Comparison with Alternatives

### vs. Marching Squares

| Aspect | Marching Squares | CONREC |
|--------|------------------|--------|
| Cases | 16 | 16 (with interpolation) |
| Accuracy | Linear segments | Accurate (bilinear) |
| Assembly | Required | Required |
| Complexity | Same | Same |

**Advantage**: CONREC provides better numerical accuracy.

### vs. Direct Line Tracing

| Aspect | Direct Tracing | Three-Stage |
|--------|---|---|
| Memory | O(contours) | O(segments) |
| Time | O(∞) worst case | O(n) guaranteed |
| Robustness | Poor | Excellent |
| Implementation | Complex | Straightforward |

**Advantage**: Three-stage guarantees correctness and efficiency.

---

## References

1. Rodriges, H., Pedrosa, B., Figueredo, L., and Oliveira, A. (2011).
   "Efficient Isolines Construction Method for Visualization of Gridded Georeferenced Data."
   EVA 2011 Conference Proceedings.

2. Marching Squares Algorithm:
   Lorensen, W. E., and Cline, H. E. (1987).
   "Marching Cubes: A High Resolution 3D Surface Construction Algorithm."
   Computer Graphics, 21(4), 163-169.

3. R-Tree Data Structure:
   Guttman, A. (1984).
   "R-Trees: A Dynamic Index Structure for Spatial Searching."
   ACM SIGMOD Record, 14(2), 47-57.

---

**Last Updated**: December 2025
