import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import * as Params from './Params';
import PathMap from './PathMap';
import ReturnMap from './ReturnMap';
import Vec from '../util/vector';

export default class ReturnIntent extends Intent {
    type: "return";

    private constructor(robotId: number, public target: Vec, value: number) {
        super(robotId, value);
    }

    public static generateBestReturn(robot: w.Entity, returnMap: ReturnMap, pathMap: PathMap): ReturnIntent {
        const intents = collections.map(
            collections.range(pathMap.bounds.height),
            y => ReturnIntent.evaluate(robot, y, returnMap, pathMap));
        const best = collections.maxBy(intents, x => x.value);
        return best;
    }

    public static evaluate(robot: w.Entity, y: number, returnMap: ReturnMap, pathMap: PathMap): ReturnIntent {
        const target = new Vec(0, y);
        const returnTicks = pathMap.cost(target);
        const straightTicks = Vec.distance(target, robot.pos) / w.MovementSpeed;

        const ticks =
            returnTicks
            + Params.ReturnStraightWeight * straightTicks
        const returnValue = discount(1, ticks);

        const nextOreValue = returnMap.nextOreValue(y);

        const value = returnValue + Params.ReturnNextOreWeight * nextOreValue;

        return new ReturnIntent(robot.id, target, value);
    }

    private static findOreDistance(y: number, beliefs: Beliefs, bounds: traverse.Dimensions) {
        for (let x = 1; x < bounds.width; ++x) {
            if (beliefs.oreProbability(x, y) >= 1 && beliefs.trapProbability(x, y) <= 0) {
                return x;
            }
        }
        return bounds.width;
    }

    toAction(robot: w.Entity, explosionAvoider: ExplosionAvoider, pathMap: PathMap): w.Action {
        return {
            entityId: robot.id,
            type: "move",
            target: explosionAvoider.claimPath(robot.id, pathMap, this.target),
        };
    }
}
