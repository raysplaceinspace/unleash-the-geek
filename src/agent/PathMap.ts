import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import ExplosionMap from './ExplosionMap';

const ExplosionCost = 100;

export default class PathMap {
    constructor(public from: Vec, public bounds: traverse.Dimensions, private pathMap: number[][]) {
    }

    public cost(target: Vec) {
        return this.pathMap[target.y][target.x];
    }

    public pathTo(target: Vec): Vec[] {
        const path = new Array<Vec>();

        let current = target;
        while (!current.equals(this.from)) {
            path.unshift(current);

            current = collections.minBy(
                traverse.neighbours(current, this.bounds, w.MovementSpeed),
                n => this.pathMap[n.y][n.x]);
        }

        if (path.length === 0) {
            // current.equals(target) - just insert a target move anyway
            path.push(target);
        }

        return path;
    }

    public static generate(from: Vec, bounds: traverse.Dimensions, explosionMap: ExplosionMap): PathMap {
        const pathMap = collections.create2D<number>(bounds.width, bounds.height, Infinity);

        PathMap.expand(from, bounds, explosionMap, pathMap, 0);

        return new PathMap(from, bounds, pathMap);
    }

    private static expand(pos: Vec, bounds: traverse.Dimensions, explosionMap: ExplosionMap, pathMap: number[][], steps: number) {
        const current = pathMap[pos.y][pos.x];
        if (steps >= current) {
            // Cannot beat existing path
            return;
        }

        let cost = steps;
        if (explosionMap.explodeProbability(pos.x, pos.y) > 0) {
            cost += ExplosionCost;
        }

        if (cost >= current) {
            // Cannot beat existing path
            return;
        }

        pathMap[pos.y][pos.x] = cost;

        for (const n of traverse.neighbours(pos, bounds, w.MovementSpeed)) {
            PathMap.expand(n, bounds, explosionMap, pathMap, steps + 1);
        }
    }
}
