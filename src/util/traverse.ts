import Vec from './vector';

export interface Dimensions {
    width: number;
    height: number;
}

export function* all(dimensions: Dimensions): Iterable<Vec> {
    for (let y = 0; y < dimensions.height; ++y) {
        for (let x = 0; x < dimensions.width; ++x) {
            yield new Vec(x, y);
        }
    }
}

export function withinBounds(p: Vec, dimensions: Dimensions) {
    return distanceToEdge(p, dimensions) >= 0;
}

export function* neighbours(pos: Vec, dimensions: Dimensions, range: number = 1): Iterable<Vec> {
    for (let y = pos.y - range; y <= pos.y + range; ++y) {
        for (let x = pos.x - range; x <= pos.x + range; ++x) {
            const n = new Vec(x, y);
            if (Vec.l1(pos, n) <= range && withinBounds(n, dimensions)) {
                yield n;
            }
        }
    }
}

export function distanceToEdge(p: Vec, dimensions: Dimensions) {
    return Math.min(
        p.x, dimensions.width - p.x - 1,
        p.y, dimensions.height - p.y - 1,
    );
}
