import * as w from '.';
import Vec from '../util/vector';

export function withinBounds(p: Vec, world: w.World) {
    return distanceToEdge(p, world) >= 0;
}

export function* neighbours(pos: Vec, world: w.World, range: number = 1): Iterable<Vec> {
    for (let y = pos.y - range; y <= pos.y + range; ++y) {
        for (let x = pos.x - range; x <= pos.x + range; ++x) {
            const n = new Vec(x, y);
            if (Vec.l1(pos, n) <= range && withinBounds(n, world)) {
                yield n;
            }
        }
    }
}

export function distanceToEdge(p: Vec, world: w.World) {
    return Math.min(
        p.x, world.width - p.x - 1,
        p.y, world.height - p.y - 1,
    );
}
