import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import Beliefs from './Beliefs';

export default class ExplosionMap {
    numExplosions = 0;
    private exploded: boolean[][];
    private explosionIds: number[][];
    private explosionMap: number[][];

    private constructor(private bounds: traverse.Dimensions) {
        this.exploded = collections.create2D<boolean>(bounds.width, bounds.height, false);
        this.explosionIds = collections.create2D<number>(bounds.width, bounds.height, null);
        this.explosionMap = collections.create2D<number>(bounds.width, bounds.height, 0);
    }

    public explodeProbability(x: number, y: number): number {
        return this.explosionMap[y][x];
    }

    public getExplosionId(x: number, y: number): number {
        return this.explosionIds[y][x];
    }

    public static generate(world: w.World, beliefs: Beliefs) {
        const result = new ExplosionMap(world);

        let nextExplosionId = 1;
        world.entities.forEach(enemy => {
            if (enemy.type === w.ItemType.RobotTeam1) {
                const carryingProbability = beliefs.carryingProbability(enemy.id);
                if (carryingProbability > 0) {
                    // The enemy can place the trap here and detonate it before we can escape
                    const explosionId = nextExplosionId++;
                    for (const trap of traverse.neighbours(enemy.pos, world)) {
                        result.explodeTrap(explosionId, trap, carryingProbability, beliefs);
                    }
                }

                // The enemy can reach this trap and explode it before we can escape
                for (const trap of traverse.neighbours(enemy.pos, world, w.MovementSpeed)) {
                    const trapProbability = beliefs.trapProbability(trap.x, trap.y);
                    if (trapProbability > 0) {
                        result.explodeTrap(nextExplosionId++, trap, trapProbability, beliefs);
                    }
                }
            }
        });

        return result;
    }

    private explodeTrap(explosionId: number, trap: Vec, trapProbability: number, beliefs: Beliefs) {
        if (trapProbability <= 0) {
            return;
        }

        if (this.exploded[trap.y][trap.x]) {
            return;
        }
        this.exploded[trap.y][trap.x] = true;

        ++this.numExplosions;

        for (const explosion of traverse.neighbours(trap, this.bounds)) {
            const previous = this.explosionMap[explosion.y][explosion.x];
            if (previous < trapProbability) {
                this.explosionMap[explosion.y][explosion.x] = trapProbability;
                this.explosionIds[explosion.y][explosion.x] = explosionId;
            }
        }

        for (const explosion of traverse.neighbours(trap, this.bounds)) {
            const nextTrapProbability = beliefs.trapProbability(explosion.x, explosion.y);
            if (nextTrapProbability > 0) {
                this.explodeTrap(explosionId, explosion, nextTrapProbability, beliefs);
            }
        }
    }
}
