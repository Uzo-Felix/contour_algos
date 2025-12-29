(function (global) {
  // Handle both browser and Node.js
  let Conrec, IsolineBuilder, SpatialIndex;
  
  if (typeof global.Conrec !== 'undefined') {
    Conrec = global.Conrec;
  } else if (typeof require !== 'undefined') {
    Conrec = require('./conrec');
  }
  
  if (typeof global.IsolineBuilder !== 'undefined') {
    IsolineBuilder = global.IsolineBuilder;
  } else if (typeof require !== 'undefined') {
    IsolineBuilder = require('./isolineBuilder');
  }
  
  if (typeof global.SpatialIndex !== 'undefined') {
    SpatialIndex = global.SpatialIndex;
  } else if (typeof require !== 'undefined') {
    SpatialIndex = require('./spatialIndex');
  }

  /**
   * Main generateIsolines function for browser and Node.js
   */
  function generateIsolines(grid, numLevels = 10) {
    if (!Array.isArray(grid) || grid.length === 0) {
      throw new Error('Invalid grid: must be a non-empty 2D array');
    }

    // Calculate levels based on grid data
    const flatData = grid.flat();
    const minVal = Math.min(...flatData.filter(v => typeof v === 'number' && !isNaN(v)));
    const maxVal = Math.max(...flatData.filter(v => typeof v === 'number' && !isNaN(v)));

    const levels = [];
    for (let i = 0; i < numLevels; i++) {
      const level = minVal + (maxVal - minVal) * (i / (numLevels - 1 || 1));
      levels.push(level);
    }

    // Generate segments using CONREC
    const conrec = new Conrec();
    const segments = conrec.computeSegments(grid, levels);

    // Build isolines
    const builder = new IsolineBuilder(0.0001);
    const isolines = builder.buildIsolines(segments, 1);

    return {
      isolines,
      segments,
      levels,
      stats: {
        gridSize: { rows: grid.length, cols: grid[0]?.length || 0 },
        totalSegments: segments.length,
        totalIsolines: isolines.length,
        valueRange: { min: minVal, max: maxVal }
      }
    };
  }

  // Export for browser
  global.generateIsolines = generateIsolines;

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      generateIsolines,
      Conrec,
      IsolineBuilder,
      SpatialIndex
    };
  }
})(typeof window !== 'undefined' ? window : global);
