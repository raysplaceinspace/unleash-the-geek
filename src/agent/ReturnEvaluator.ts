import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Intent from './Intent';
import PathMap from './PathMap';
import Vec from '../util/vector';

export function generateBestReturn(robot: w.Entity, pathMap: PathMap): ReturnIntent {
    const intents = collections.map(
        collections.range(pathMap.bounds.height),
        y => ReturnIntent.evaluate(robot, y, pathMap));
    const best = collections.maxBy(intents, x => x.value);
    return best;
}

export class ReturnIntent extends Intent {
    type: "return";

    private constructor(robotId: number, public target: Vec, value: number) {
        super(robotId, value);
    }

    public static evaluate(robot: w.Entity, y: number, pathMap: PathMap): ReturnIntent {
        const centerY = (pathMap.bounds.height - 1) / 2;
        const distanceToCenter = Math.abs(y - centerY);
        const payoff = 1 - distanceToCenter / centerY;

        const target = new Vec(0, y);
        const value = discount(payoff, pathMap.cost(target));
        return new ReturnIntent(robot.id, target, value);
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
