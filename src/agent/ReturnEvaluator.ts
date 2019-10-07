import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Intent from './Intent';
import PathMap from './PathMap';
import Vec from '../util/vector';
import PayoffMap from './PayoffMap';
import Beliefs from './Beliefs';

export function generateBestReturn(robot: w.Entity, beliefs: Beliefs, pathMap: PathMap): ReturnIntent {
    const intents = collections.map(
        collections.range(pathMap.bounds.height),
        y => ReturnIntent.evaluate(robot, y, beliefs, pathMap));
    const best = collections.maxBy(intents, x => x.value);
    return best;
}

export class ReturnIntent extends Intent {
    type: "return";

    private constructor(robotId: number, public target: Vec, value: number) {
        super(robotId, value);
    }

    public static evaluate(robot: w.Entity, y: number, beliefs: Beliefs, pathMap: PathMap): ReturnIntent {
        const payoff = 1;

        const target = new Vec(0, y);
        const returnTicks = pathMap.cost(target);

        const nearestOre = ReturnIntent.findOreDistance(y, beliefs, pathMap.bounds);
        const nextOreTicks = nearestOre / w.MovementSpeed;

        const value = discount(payoff, returnTicks + nextOreTicks);
        return new ReturnIntent(robot.id, target, value);
    }

    private static findOreDistance(y: number, beliefs: Beliefs, bounds: traverse.Dimensions) {
        for (let x = 1; x < bounds.width; ++x) {
            if (beliefs.oreProbability(x, y) > 0 && beliefs.trapProbability(x, y) <= 0) {
                return x;
            }
        }
        return bounds.width;
    }

    toAction(robot: w.Entity, pathMap: PathMap): w.Action {
        const path = pathMap.pathTo(this.target);
        return {
            entityId: robot.id,
            type: "move",
            target: path[0],
        };
    }
}
