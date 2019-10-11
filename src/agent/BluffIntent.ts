import * as collections from '../util/collections';
import * as w from '../model';
import { discount } from './Discount';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import * as Params from './Params';
import PathMap from './PathMap';
import Vec from '../util/vector';
import ExplosionMap from './ExplosionMap';

export default class BluffIntent extends Intent {
    private constructor(robotId: number, public target: Vec, value: number) {
        super(robotId, value);
    }

    public static evaluate(robot: w.Entity, pathMap: PathMap, explosionMap: ExplosionMap) {
        const intents = collections.map(
            collections.range(pathMap.bounds.height),
            y => BluffIntent.evaluateAt(robot, y, pathMap, explosionMap));
        const best = collections.maxBy(intents, x => x.value);
        return best;
    }

    private static evaluateAt(robot: w.Entity, y: number, pathMap: PathMap, explosionMap: ExplosionMap): BluffIntent {
        const payoff = 1;

        const target = new Vec(0, y);
        let returnTicks = pathMap.cost(target);
        if (explosionMap.explodeProbability(target.x, target.y) > 0) {
            returnTicks += Params.ExplosionCost;
        }

        const value = discount(payoff, returnTicks);
        return new BluffIntent(robot.id, target, value);
    }

    toAction(robot: w.Entity, explosionAvoider: ExplosionAvoider, pathMap: PathMap): w.Action {
        if (robot.pos.equals(this.target)) {
            return {
                entityId: robot.id,
                type: "move",
                target: this.target,
            };
        } else {
            return {
                entityId: robot.id,
                type: "move",
                target: explosionAvoider.claimPath(robot.id, pathMap, this.target),
            };
        }
    }

    duplicates(other: Intent): boolean {
        if (other instanceof BluffIntent) {
            return true;
        } else {
            return super.duplicates(other);
        }
    }
}