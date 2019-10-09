import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import ExplosionMap from './ExplosionMap';
import * as Params from './Params';
import Vec from '../util/vector';

export default class ReturnMap {
    private constructor(private returnMap: number[]) {
    }

    nextOreValue(y: number) {
        return this.returnMap[y];
    }

    public static generate(bounds: traverse.Dimensions, beliefs: Beliefs): ReturnMap {
        const distances = new Array<number>();
        for (let y = 0; y < bounds.height; ++y) {
            distances[y] = ReturnMap.findOreDistance(y, beliefs, bounds);
        }

        for (let y = 0; y < bounds.height; ++y) {
            const baseDistance = distances[y];
            if (baseDistance < Infinity) {
                // The ore on this row can be accessed from the other rows with +1 cost per row
                for (let y2 = 0; y2 < bounds.height; ++y2) {
                    const distance = baseDistance + Math.abs(y2 - y);
                    distances[y2] = Math.min(distances[y2], distance);
                }
            }
        }

        const returnMap = new Array<number>();
        for (let y = 0; y < bounds.height; ++y) {
            const distance = Math.min(distances[y], bounds.width);

            let ticks = distance / w.MovementSpeed;

            returnMap[y] = discount(1, ticks);
        }

        return new ReturnMap(returnMap);
    }

    private static findOreDistance(y: number, beliefs: Beliefs, bounds: traverse.Dimensions) {
        for (let x = 1; x < bounds.width; ++x) {
            if (beliefs.oreProbability(x, y) >= 1 && beliefs.trapProbability(x, y) <= 0) {
                return x;
            }
        }
        return Infinity;
    }
}
