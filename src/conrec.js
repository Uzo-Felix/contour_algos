class Conrec {
  constructor() {
    this.EPSILON = 0.0001;
  }

  preprocessGrid(grid) {
    // Ensure we always return a valid 2D array or an empty array
    if (!Array.isArray(grid) || grid.length === 0 || !Array.isArray(grid[0]) || grid[0].length === 0) {
      return [];
    }

    const rows = grid.length;
    const cols = grid[0].length;

    const processedGrid = grid.map(row => Array.isArray(row) ? [...row] : []);

    // Normalize top row (north pole) with mean if available
    if (rows > 0 && Array.isArray(processedGrid[0]) && processedGrid[0].length === cols) {
      const validTop = processedGrid[0].filter(val => typeof val === 'number' && !isNaN(val));
      if (validTop.length > 0) {
        const northPoleValue = validTop.reduce((sum, val) => sum + val, 0) / validTop.length;
        processedGrid[0] = Array(cols).fill(northPoleValue);
      }
    }

    // Normalize bottom row (south pole) with mean if available
    if (rows > 1 && Array.isArray(processedGrid[rows - 1]) && processedGrid[rows - 1].length === cols) {
      const validBottom = processedGrid[rows - 1].filter(val => typeof val === 'number' && !isNaN(val));
      if (validBottom.length > 0) {
        const southPoleValue = validBottom.reduce((sum, val) => sum + val, 0) / validBottom.length;
        processedGrid[rows - 1] = Array(cols).fill(southPoleValue);
      }
    }

    // Smooth wrap-around columns if present
    if (cols > 1) {
      for (let i = 0; i < rows; i++) {
        const left = processedGrid[i][0];
        const right = processedGrid[i][cols - 1];
        const leftOk = typeof left === 'number' && !isNaN(left);
        const rightOk = typeof right === 'number' && !isNaN(right);

        if (leftOk && rightOk) {
          const avg = (left + right) / 2;
          processedGrid[i][0] = avg;
          processedGrid[i][cols - 1] = avg;
        } else if (leftOk && !rightOk) {
          processedGrid[i][cols - 1] = left;
        } else if (!leftOk && rightOk) {
          processedGrid[i][0] = right;
        } // else both invalid: leave as-is
      }
    }

    return processedGrid;
  }

  computeSegments(grid, levels) {
    const processedGrid = this.preprocessGrid(grid);

    // Defensive guards: need at least a 2x2 grid and levels array
    if (
      !Array.isArray(processedGrid) ||
      processedGrid.length < 2 ||
      !Array.isArray(processedGrid[0]) ||
      processedGrid[0].length < 2 ||
      !Array.isArray(levels) ||
      levels.length === 0
    ) {
      return [];
    }

    const segments = [];
    const rows = processedGrid.length;
    const cols = processedGrid[0].length;

    for (let lat = 0; lat < rows - 1; lat++) {
      for (let lon = 0; lon < cols - 1; lon++) {
        const z = [
          processedGrid[lat][lon],
          processedGrid[lat][lon + 1],
          processedGrid[lat + 1][lon + 1],
          processedGrid[lat + 1][lon]
        ];

        for (const level of levels) {
          this.processGridCell(z, level, lat, lon, segments);
        }
      }
    }
    return segments;
  }

  processGridCell(z, level, lat, lon, segments) {
    let caseIndex = 0;
    if (z[0] >= level) caseIndex |= 1;
    if (z[1] >= level) caseIndex |= 2;
    if (z[2] >= level) caseIndex |= 4;
    if (z[3] >= level) caseIndex |= 8;

    if (caseIndex === 0 || caseIndex === 15) return;

    const points = [];

    if ((caseIndex & 1) !== ((caseIndex & 2) >> 1)) {
      points.push(this.interpolate(z[0], z[1], level, lat, lon, lat, lon + 1));
    }

    if ((caseIndex & 2) !== ((caseIndex & 4) >> 1)) {
      points.push(this.interpolate(z[1], z[2], level, lat, lon + 1, lat + 1, lon + 1));
    }

    if ((caseIndex & 4) !== ((caseIndex & 8) >> 1)) {
      points.push(this.interpolate(z[2], z[3], level, lat + 1, lon + 1, lat + 1, lon));
    }

    if ((caseIndex & 8) !== ((caseIndex & 1) << 3)) {
      points.push(this.interpolate(z[3], z[0], level, lat + 1, lon, lat, lon));
    }

    if (points.length === 2) {
      segments.push({
        p1: points[0],
        p2: points[1],
        level: level
      });
    } else if (points.length === 4) {
      segments.push({
        p1: points[0],
        p2: points[1],
        level: level
      });
      segments.push({
        p1: points[2],
        p2: points[3],
        level: level
      });
    }
  }

  interpolate(z1, z2, level, lat1, lon1, lat2, lon2) {
    if (Math.abs(z1 - z2) < this.EPSILON) {
      return { lat: lat1, lon: lon1 };
    }

    const t = (level - z1) / (z2 - z1);
    return {
      lat: lat1 + t * (lat2 - lat1),
      lon: lon1 + t * (lon2 - lon1)
    };
  }

  normalizeAntimeridian(lon) {
    while (lon > 180) lon -= 360;
    while (lon < -180) lon += 360;
    return lon;
  }
}

module.exports = Conrec;