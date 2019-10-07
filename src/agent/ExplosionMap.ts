import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import Beliefs from './Beliefs';

export default class ExplosionMap {
    private constructor(private trapMap: number[][]) {
    }

    public explodeProbability(x: number, y: number): number {
        return this.trapMap[y][x];
    }

    public static generate(world: w.World, beliefs: Beliefs) {
        const explosionMap = collections.create2D(world.width, world.height, 0);

        world.entities.forEach(enemy => {
            if (enemy.type === w.ItemType.RobotTeam1) {
                for (const trap of traverse.neighbours(enemy.pos, world)) {
                    const trapProbability = beliefs.trapProbability(trap.x, trap.y);
                    ExplosionMap.explodeTrap(trap, trapProbability, world, beliefs, explosionMap);
                }
            }
        });

        return new ExplosionMap(explosionMap);
    }

    private static explodeTrap(trap: Vec, trapProbability: number, world: w.World, beliefs: Beliefs, explosionMap: Array<number[]>) {
        if (trapProbability <= 0) {
            return;
        }

        const initialTrapProbability = explosionMap[trap.y][trap.x];
        if (trapProbability > initialTrapProbability) {
            explosionMap[trap.y][trap.x] = trapProbability;

            for (const explosion of traverse.neighbours(trap, world)) {
                explosionMap[explosion.y][explosion.x] = Math.max(explosionMap[explosion.y][explosion.x], trapProbability);

                const nextTrapProbability = beliefs.trapProbability(explosion.x, explosion.y);
                ExplosionMap.explodeTrap(explosion, nextTrapProbability, world, beliefs, explosionMap);
            }
        }
    }
}
