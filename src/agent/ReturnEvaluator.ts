import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import ExplosionMap from './ExplosionMap';
import PathMap from './PathMap';
import Vec from '../util/vector';

import ActionValue from './ActionValue';

export function generateBestReturn(robot: w.Entity, pathMap: PathMap): ActionValue {
    const intents = collections.map(
        collections.range(pathMap.bounds.height),
        y => ReturnIntent.evaluate(y, pathMap));
    const best = collections.maxBy(intents, x => x.value);

    return best.toActionValue(robot.id, pathMap);
}

class ReturnIntent {
    constructor(public target: Vec, public value: number) {
    }

    public static evaluate(y: number, pathMap: PathMap): ReturnIntent {
        const centerY = (pathMap.bounds.height - 1) / 2;
        const distanceToCenter = Math.abs(y - centerY);
        const payoff = 1 - distanceToCenter / centerY;

        const target = new Vec(0, y);
        const value = payoff / (1 + pathMap.cost(target));
        return new ReturnIntent(target, value);
    }

    toActionValue(robotId: number, pathMap: PathMap): ActionValue {
        const path = pathMap.pathTo(this.target);
        return new ActionValue(this.value, {
            entityId: robotId,
            type: "move",
            target: path[0],
        });
    }
}
