import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import ExplosionMap from './ExplosionMap';
import * as Params from './Params';
import SquirrelMap from './SquirrelMap';
import Vec from '../util/vector';

export default class ReturnMap {
    private constructor(private returnMap: number[]) {
    }

    nextOreValue(y: number) {
        return this.returnMap[y];
    }

    public static generate(world: w.World, beliefs: Beliefs, squirrelMap: SquirrelMap): ReturnMap {
        const distances = new Array<number>();
        for (let y = 0; y < world.height; ++y) {
            distances[y] = ReturnMap.findOreDistance(y, world, beliefs, squirrelMap);
        }

        for (let y = 0; y < world.height; ++y) {
            const baseDistance = distances[y];
            if (baseDistance < Infinity) {
                // The ore on this row can be accessed from the other rows with +1 cost per row
                for (let y2 = 0; y2 < world.height; ++y2) {
                    const distance = baseDistance + Math.abs(y2 - y);
                    distances[y2] = Math.min(distances[y2], distance);
                }
            }
        }

        const returnMap = new Array<number>();
        for (let y = 0; y < world.height; ++y) {
            const distance = Math.min(distances[y], world.width);

            let ticks = distance / w.MovementSpeed;

            returnMap[y] = discount(1, ticks);
        }

        return new ReturnMap(returnMap);
    }

    private static findOreDistance(y: number, world: w.World, beliefs: Beliefs, squirrelMap: SquirrelMap) {
        const squirrelling = world.tick < squirrelMap.unsquirrelTick;
        for (let x = 1; x < world.width; ++x) {
            const location = new Vec(x, y);
            if ((!squirrelling || !squirrelMap.isSquirrel(location))
                && beliefs.oreProbability(x, y) >= 1 && beliefs.trapProbability(x, y) <= 0) {

                return x;
            }
        }
        return Infinity;
    }
}
