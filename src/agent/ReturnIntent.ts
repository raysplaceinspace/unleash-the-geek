import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
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

    private static evaluate(robot: w.Entity, y: number, returnMap: ReturnMap, pathMap: PathMap): ReturnIntent {
        const target = new Vec(0, y);

        const returnTicks = pathMap.cost(target);
        const returnValue = discount(1, returnTicks);

        const nextOreValue = returnMap.nextOreValue(y);

        const value = returnValue + Params.ReturnNextOreWeight * nextOreValue;

        return new ReturnIntent(robot.id, target, value);
    }

    toAction(robot: w.Entity, explosionAvoider: ExplosionAvoider, pathMap: PathMap): w.Action {
        return {
            entityId: robot.id,
            type: "move",
            // Always avoid when carrying because we'd lose an ore
            target: explosionAvoider.avoidancePath(robot.id, pathMap, this.target),
        };
    }
}
