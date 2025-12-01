/**
 * R-Tree Spatial Index Implementation
 * Based on Guttman (1984): "R-Trees: A Dynamic Index Structure for Spatial Searching"
 * 
 * Used for performance comparison against bucket grid optimization.
 * Original paper (2011) used R-Tree; we optimize to O(1) bucket grid.
 */

class RTreeNode {
  constructor(isLeaf = true, maxEntries = 4) {
    this.isLeaf = isLeaf;
    this.maxEntries = maxEntries;
    this.entries = [];
    this.bbox = null;
  }

  /**
   * Get bounding box of all entries
   */
  getChildBBox() {
    if (this.entries.length === 0) return null;

    let minLon = Infinity;
    let minLat = Infinity;
    let maxLon = -Infinity;
    let maxLat = -Infinity;

    for (const entry of this.entries) {
      const bbox = entry.bbox;
      minLon = Math.min(minLon, bbox.minLon);
      minLat = Math.min(minLat, bbox.minLat);
      maxLon = Math.max(maxLon, bbox.maxLon);
      maxLat = Math.max(maxLat, bbox.maxLat);
    }

    this.bbox = { minLon, minLat, maxLon, maxLat };
    return this.bbox;
  }

  /**
   * Calculate overlap area with another bbox
   */
  overlapArea(bbox) {
    const overlapLon = Math.max(0, Math.min(this.bbox.maxLon, bbox.maxLon) - Math.max(this.bbox.minLon, bbox.minLon));
    const overlapLat = Math.max(0, Math.min(this.bbox.maxLat, bbox.maxLat) - Math.max(this.bbox.minLat, bbox.minLat));
    return overlapLon * overlapLat;
  }

  /**
   * Calculate area to cover both this bbox and another
   */
  expandedArea(bbox) {
    const newMinLon = Math.min(this.bbox.minLon, bbox.minLon);
    const newMinLat = Math.min(this.bbox.minLat, bbox.minLat);
    const newMaxLon = Math.max(this.bbox.maxLon, bbox.maxLon);
    const newMaxLat = Math.max(this.bbox.maxLat, bbox.maxLat);
    return (newMaxLon - newMinLon) * (newMaxLat - newMinLat);
  }
}

class RTree {
  constructor(maxEntries = 4, minEntries = 2) {
    this.maxEntries = maxEntries;
    this.minEntries = minEntries;
    this.root = new RTreeNode(true, maxEntries);
    this.size = 0;
  }

  /**
   * Insert a segment with its bounding box
   */
  insert(segment) {
    const bbox = this.getBBox(segment);
    this._insertRecursive(this.root, { segment, bbox });
    this.size++;
  }

  /**
   * Get bounding box of a segment
   */
  getBBox(segment) {
    return {
      minLon: Math.min(segment.p1.lon, segment.p2.lon),
      minLat: Math.min(segment.p1.lat, segment.p2.lat),
      maxLon: Math.max(segment.p1.lon, segment.p2.lon),
      maxLat: Math.max(segment.p1.lat, segment.p2.lat)
    };
  }

  /**
   * Recursively insert into tree
   */
  _insertRecursive(node, entry) {
    if (node.isLeaf) {
      node.entries.push(entry);
      if (node.entries.length > this.maxEntries) {
        this._splitNode(node);
      }
    } else {
      // Find best child node
      let bestChild = null;
      let minEnlargement = Infinity;

      for (const childEntry of node.entries) {
        const child = childEntry.child;
        child.getChildBBox();

        const overlapBefore = child.bbox ? child.overlapArea(entry.bbox) : 0;
        const enlargement = child.expandedArea(entry.bbox) - (child.bbox ? (child.bbox.maxLon - child.bbox.minLon) * (child.bbox.maxLat - child.bbox.minLat) : 0);

        if (enlargement < minEnlargement) {
          minEnlargement = enlargement;
          bestChild = child;
        }
      }

      if (!bestChild) {
        bestChild = node.entries[0].child;
      }

      this._insertRecursive(bestChild, entry);
    }
  }

  /**
   * Split node when it exceeds max entries (basic linear split)
   */
  _splitNode(node) {
    // Linear split: find two entries that are farthest apart
    let maxDist = 0;
    let seed1 = 0, seed2 = 1;

    for (let i = 0; i < node.entries.length; i++) {
      for (let j = i + 1; j < node.entries.length; j++) {
        const dist = this._bboxDistance(node.entries[i].bbox, node.entries[j].bbox);
        if (dist > maxDist) {
          maxDist = dist;
          seed1 = i;
          seed2 = j;
        }
      }
    }

    // Create new node
    const newNode = new RTreeNode(node.isLeaf, this.maxEntries);

    // Distribute entries
    const group1 = [node.entries[seed1]];
    const group2 = [node.entries[seed2]];

    for (let i = 0; i < node.entries.length; i++) {
      if (i !== seed1 && i !== seed2) {
        // Assign to group with least enlargement
        const entry = node.entries[i];
        const e1 = this._calculateEnlargement(group1, entry);
        const e2 = this._calculateEnlargement(group2, entry);

        if (e1 < e2) {
          group1.push(entry);
        } else {
          group2.push(entry);
        }
      }
    }

    node.entries = group1;
    newNode.entries = group2;

    // Update parent
    if (this.root === node) {
      const newRoot = new RTreeNode(false, this.maxEntries);
      node.getChildBBox();
      newNode.getChildBBox();

      newRoot.entries.push({ child: node, bbox: node.bbox });
      newRoot.entries.push({ child: newNode, bbox: newNode.bbox });
      this.root = newRoot;
    }
  }

  /**
   * Calculate bbox distance between two bboxes
   */
  _bboxDistance(bbox1, bbox2) {
    const dLon = Math.max(bbox1.minLon - bbox2.maxLon, bbox2.minLon - bbox1.maxLon, 0);
    const dLat = Math.max(bbox1.minLat - bbox2.maxLat, bbox2.minLat - bbox1.maxLat, 0);
    return Math.sqrt(dLon * dLon + dLat * dLat);
  }

  /**
   * Calculate enlargement needed to include entry in group
   */
  _calculateEnlargement(group, entry) {
    let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;

    for (const e of group) {
      minLon = Math.min(minLon, e.bbox.minLon);
      minLat = Math.min(minLat, e.bbox.minLat);
      maxLon = Math.max(maxLon, e.bbox.maxLon);
      maxLat = Math.max(maxLat, e.bbox.maxLat);
    }

    const currentArea = (maxLon - minLon) * (maxLat - minLat);
    const newMinLon = Math.min(minLon, entry.bbox.minLon);
    const newMinLat = Math.min(minLat, entry.bbox.minLat);
    const newMaxLon = Math.max(maxLon, entry.bbox.maxLon);
    const newMaxLat = Math.max(maxLat, entry.bbox.maxLat);
    const newArea = (newMaxLon - newMinLon) * (newMaxLat - newMinLat);

    return newArea - currentArea;
  }

  /**
   * Find all segments near a point (range search)
   */
  search(point, epsilon = 0.01) {
    const results = [];
    const searchBBox = {
      minLon: point.lon - epsilon,
      minLat: point.lat - epsilon,
      maxLon: point.lon + epsilon,
      maxLat: point.lat + epsilon
    };

    this._searchRecursive(this.root, searchBBox, results);
    return results;
  }

  /**
   * Recursively search tree
   */
  _searchRecursive(node, searchBBox, results) {
    for (const entry of node.entries) {
      if (this._bboxIntersect(entry.bbox, searchBBox)) {
        if (node.isLeaf) {
          results.push(entry.segment);
        } else {
          this._searchRecursive(entry.child, searchBBox, results);
        }
      }
    }
  }

  /**
   * Check if two bboxes intersect
   */
  _bboxIntersect(bbox1, bbox2) {
    return !(
      bbox1.maxLon < bbox2.minLon ||
      bbox1.minLon > bbox2.maxLon ||
      bbox1.maxLat < bbox2.minLat ||
      bbox1.minLat > bbox2.maxLat
    );
  }

  /**
   * Get statistics about tree
   */
  getStats() {
    return {
      size: this.size,
      depth: this._getDepth(this.root),
      avgFanout: this._getAvgFanout(this.root)
    };
  }

  _getDepth(node) {
    if (node.isLeaf) return 1;
    return 1 + Math.max(...node.entries.map(e => this._getDepth(e.child)));
  }

  _getAvgFanout(node) {
    if (node.isLeaf) return node.entries.length;
    const childFanouts = node.entries.map(e => this._getAvgFanout(e.child));
    return (node.entries.length + childFanouts.reduce((a, b) => a + b, 0) / childFanouts.length) / 2;
  }
}

/**
 * Wrapper class for R-Tree spatial index (compatible with bucket grid interface)
 */
class RTreeSpatialIndex {
  constructor(maxEntries = 4, epsilon = 0.0001) {
    this.EPSILON = epsilon;
    this.rtree = new RTree(maxEntries);
  }

  /**
   * Build R-Tree from segments
   */
  buildIndex(segments) {
    for (const segment of segments) {
      this.rtree.insert(segment);
    }
  }

  /**
   * Find neighbors of a point (compatible with bucket grid)
   */
  findNeighbors(point) {
    return this.rtree.search(point, this.EPSILON);
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.rtree.getStats();
  }
}

module.exports = { RTree, RTreeSpatialIndex };
