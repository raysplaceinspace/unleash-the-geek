import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import * as Params from './Params';
import Vec from '../util/vector';

export default class PayoffMap {
    private constructor(private payoffMap: number[][]) {
    }

    payoff(x: number, y: number) {
        return this.payoffMap[y][x];
    }

    public static generate(world: w.World, beliefs: Beliefs): PayoffMap {
        const payoffs = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            payoffs[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                payoffs[y][x] = PayoffMap.generateCell(cell, world, beliefs);
            }
        }

        return new PayoffMap(payoffs);
    }

    private static generateCell(cell: w.Cell, world: w.World, beliefs: Beliefs): number {
        if (cell.pos.x <= 0) {
            // No payoff when digging headquarters
            return 0;
        }

        const trapProbability = beliefs.trapProbability(cell.pos.x, cell.pos.y);
        if (trapProbability > 0) {
            // Don't ever dig somewhere which could be trapped
            return -1;
        }

        const returnTicks = cell.pos.x / w.MovementSpeed;
        const orePayoff = Math.pow(beliefs.oreProbability(cell.pos.x, cell.pos.y), Params.OrePayoffPower);

        const payoff = discount(orePayoff, returnTicks);
        return payoff;
    }
}
