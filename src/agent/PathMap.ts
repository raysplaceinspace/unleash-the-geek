import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import ExplosionMap from './ExplosionMap';

const ExplosionCost = 100;

export default class PathMap {
    public expansions = 0;

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
        const result = new PathMap(from, bounds, pathMap);

        const neighbours = [new Neighbour(from, 0)];
        while (neighbours.length > 0) {
            const neighbour = neighbours.shift();
            result.expand(neighbour, explosionMap, neighbours);
        }
        return result;
    }

    private expand(neighbour: Neighbour, explosionMap: ExplosionMap, neighbours: Neighbour[]) {
        const pos = neighbour.pos;
        const cost = neighbour.cost;

        const previous = this.pathMap[pos.y][pos.x];
        if (cost >= previous) {
            // Cannot beat existing path
            return;
        }

        this.pathMap[pos.y][pos.x] = cost;
        ++this.expansions;

        for (const n of traverse.neighbours(pos, this.bounds, w.MovementSpeed)) {
            if (n.equals(pos)) {
                continue;
            }

            let next = cost + 1;
            if (explosionMap.explodeProbability(n.x, n.y) > 0) {
                next += ExplosionCost;
            }

            if (next < this.pathMap[n.y][n.x]) {
                neighbours.push(new Neighbour(n, next));
            }
        }
    }
}

class Neighbour {
    constructor(public pos: Vec, public cost: number) {
    }
}