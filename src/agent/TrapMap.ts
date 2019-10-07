import * as w from '../model';
import Vec from '../util/vector';
import Beliefs from './Beliefs';

function generateTrapMap(world: w.World, beliefs: Beliefs): number[][] {
    const trapMap = new Array<number[]>();
    for (let y = 0; y < world.height; ++y) {
        trapMap[y] = new Array<number>();
        for (let x = 0; x < world.width; ++x) {
            trapMap[y][x] = 0;
        }
    }

    world.entities.forEach(enemy => {
        if (enemy.type === w.ItemType.RobotTeam1) {
            for (const trap of w.neighbours(enemy.pos, world)) {
                const trapProbability = beliefs.trapProbability(trap.x, trap.y);
                explodeTrap(trap, trapProbability, world, beliefs, trapMap);
            }
        }
    });

    return trapMap;
}

function explodeTrap(trap: Vec, trapProbability: number, world: w.World, beliefs: Beliefs, trapMap: Array<number[]>) {
    if (trapProbability <= 0) {
        return;
    }

    const initialTrapProbability = trapMap[trap.y][trap.x];
    if (trapProbability > initialTrapProbability) {
        trapMap[trap.y][trap.x] = trapProbability;

        for (const explosion of w.neighbours(trap, world)) {
            trapMap[explosion.y][explosion.x] = Math.max(trapMap[explosion.y][explosion.x], trapProbability);

            const nextTrapProbability = beliefs.trapProbability(explosion.x, explosion.y);
            explodeTrap(explosion, nextTrapProbability, world, beliefs, trapMap);
        }
    }
}

export default class TrapMap {
    private constructor(private trapMap: number[][]) {
    }

    public static generate(world: w.World, beliefs: Beliefs) {
        return new TrapMap(generateTrapMap(world, beliefs));
    }

    public explodeProbability(x: number, y: number): number {
        return this.trapMap[y][x];
    }
}
