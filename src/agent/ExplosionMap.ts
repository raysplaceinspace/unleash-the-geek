import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import Beliefs from './Beliefs';

export default class ExplosionMap {
    numExplosions = 0;
    private explosionIds: Set<number>[][];
    private explosionMap: number[][];

    private nextExplosionId = 1;

    private constructor(private bounds: traverse.Dimensions) {
        this.explosionIds = collections.create2D<Set<number>>(bounds.width, bounds.height, null);
        this.explosionMap = collections.create2D<number>(bounds.width, bounds.height, 0);
    }

    public explodeProbability(x: number, y: number): number {
        return this.explosionMap[y][x];
    }

    public getExplosionIds(x: number, y: number): Set<number> {
        return this.explosionIds[y][x];
    }

    public static generate(world: w.World, beliefs: Beliefs) {
        const result = new ExplosionMap(world);

        world.entities.forEach(enemy => {
            if (enemy.type === w.ItemType.RobotTeam1) {
                const carryingProbability = beliefs.carryingProbability(enemy.id);
                if (carryingProbability > 0) {
                    // The enemy can place the trap here and detonate it before we can escape
                    for (const trap of traverse.neighbours(enemy.pos, world)) {
                        result.explodeTrap(trap, carryingProbability, beliefs);
                    }
                }

                // The enemy can reach this trap and explode it before we can escape
                for (const trap of traverse.neighbours(enemy.pos, world, w.MovementSpeed + w.DigRange)) {
                    const trapProbability = beliefs.trapProbability(trap.x, trap.y);
                    if (trapProbability > 0) {
                        result.explodeTrap(trap, trapProbability, beliefs);
                    }
                }
            }
        });

        return result;
    }

    private explodeTrap(trap: Vec, trapProbability: number, beliefs: Beliefs, explosion: Explosion = null) {
        if (trapProbability <= 0 || trap.x <= 0) { // traps can never be in headquarters
            return;
        }

        if (!explosion) {
            explosion = new Explosion(this.nextExplosionId++);
        }

        if (explosion.visited.has(trap.hash())) {
            return;
        }
        explosion.visited.add(trap.hash());

        ++this.numExplosions;

        for (const n of traverse.neighbours(trap, this.bounds)) {
            // Set explosion probability
            const previousProbability = this.explosionMap[n.y][n.x];
            if (previousProbability < trapProbability) {
                this.explosionMap[n.y][n.x] = trapProbability;
            }

            // Mark neighbours with explosionId
            let explosionIds = this.explosionIds[n.y][n.x];
            if (!explosionIds) {
                this.explosionIds[n.y][n.x] = explosionIds = new Set<number>();
            }
            explosionIds.add(explosion.explosionId);

            // Explode other traps
            const nextTrapProbability = beliefs.trapProbability(n.x, n.y);
            if (nextTrapProbability > 0) {
                this.explodeTrap(n, nextTrapProbability, beliefs, explosion);
            }
        }
    }
}

class Explosion {
    visited = new Set<number>();

    constructor(public explosionId: number) {
    }
}