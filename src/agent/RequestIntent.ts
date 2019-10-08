import * as w from '../model';
import { discount } from './Discount';
import ExplosionPath from './ExplosionAvoider';
import Intent from './Intent';
import PathMap from './PathMap';
import Vec from '../util/vector';

export class RequestIntent extends Intent {
    private constructor(robotId: number, public item: number, value: number) {
        super(robotId, value);
    }

    public static evaluate(robot: w.Entity, item: number, pathMap: PathMap) {
        const payoff = 1;

        const target = new Vec(0, robot.pos.y);
        const returnTicks = pathMap.cost(target);

        const value = discount(payoff, returnTicks);
        return new RequestIntent(robot.id, item, value);
    }

    toAction(robot: w.Entity, explosionPath: ExplosionPath, pathMap: PathMap): w.Action {
        if (robot.pos.x === 0) {
            return {
                entityId: robot.id,
                type: "request",
                item: this.item,
            };
        } else {
            const path = pathMap.pathTo(new Vec(0, robot.pos.y));
            return {
                entityId: robot.id,
                type: "move",
                target: path[0],
            };
        }
    }

    duplicates(other: Intent): boolean {
        if (other instanceof RequestIntent) {
            return this.item === other.item;
        } else {
            return super.duplicates(other);
        }
    }
}

export default RequestIntent;