import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import ExplosionMap from './ExplosionMap';

const ExplosionCost = 100;

export default class PathMap {
    public assignments = 0;
    public expansions = new Set<number>();

    private constructor(public from: Vec, public bounds: traverse.Dimensions, private pathMap: number[][], public bait = false) {
    }

    public cost(target: Vec) {
        return this.pathMap[target.y][target.x];
    }

    public pathTo(target: Vec): Vec[] {
        const path = new Array<Vec>();

        let current = target;
        while (!current.equals(this.from)) {
            path.unshift(current);

            current = this.previousNeighbour(target, current);
        }

        if (path.length === 0) {
            // current.equals(target) - just insert a target move anyway
            path.push(target);
        }

        return path;
    }

    private previousNeighbour(target: Vec, current: Vec) {
        let best: Vec = null;
        let bestCost: number = Infinity;
        let bestDistance: number = Infinity;
        for (const n of traverse.neighbours(current, this.bounds, w.MovementSpeed)) {
            const cost = this.pathMap[n.y][n.x];
            const distance = Vec.distance(target, n);
            if (cost < bestCost || cost === bestCost && distance < bestDistance) {
                best = n;
                bestCost = cost;
                bestDistance = distance;
            }
        }
        return best;
    }

    public static generate(from: Vec, bounds: traverse.Dimensions, explosionMap: ExplosionMap, bait: boolean = false): PathMap {
        const pathMap = collections.create2D<number>(bounds.width, bounds.height, Infinity);
        const result = new PathMap(from, bounds, pathMap, bait);
        
        if (traverse.withinBounds(from, bounds)) {
            const initial = new Neighbour(from, 0);
            result.assign(initial);

            const neighbours = [initial];
            while (neighbours.length > 0) {
                const neighbour = neighbours.shift();
                result.expand(neighbour, explosionMap, neighbours);
            }
        } else {
            // Probably a dead robot
        }

        return result;
    }

    private assign(neighbour: Neighbour) {
        const pos = neighbour.pos;
        const cost = neighbour.cost;

        const previous = this.pathMap[pos.y][pos.x];
        if (cost < previous) {
            this.pathMap[pos.y][pos.x] = cost;
            ++this.assignments;
        }
    }

    private expand(from: Neighbour, explosionMap: ExplosionMap, neighbours: Neighbour[]) {
        const pos = from.pos;
        const cost = from.cost;

        if (this.expansions.has(pos.hash())) {
            // Already expanded
            return;
        } else {
            this.expansions.add(pos.hash());
        }

        for (const n of traverse.neighbours(pos, this.bounds, w.MovementSpeed)) {
            if (n.equals(pos)) {
                continue;
            }

            let next = cost + 1;
            if (!this.bait && explosionMap.explodeProbability(n.x, n.y) > 0) {
                next += ExplosionCost;
            }

            if (next < this.pathMap[n.y][n.x]) {
                const neighbour = new Neighbour(n, next);
                this.assign(neighbour);
                this.insertNeighbour(neighbour, neighbours);
            }
        }
    }

    private insertNeighbour(toInsert: Neighbour, neighbours: Neighbour[]) {
        let i = 0;
        while (i < neighbours.length && neighbours[i].cost < toInsert.cost) {
            ++i;
        }

        if (i < neighbours.length) {
            neighbours.splice(i, 0, toInsert);
        } else {
            neighbours.push(toInsert);
        }
    }
}

class Neighbour {
    constructor(public pos: Vec, public cost: number) {
    }
}