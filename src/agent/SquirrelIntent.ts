import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import * as Params from './Params';
import PathMap from './PathMap';
import SquirrelMap from './SquirrelMap';
import Vec from '../util/vector';

export default class SquirrelIntent extends Intent {
    type: "squirrel";

    private constructor(robotId: number, public target: Vec, public destination: Vec, private avoid: boolean, value: number) {
        super(robotId, value);
    }

    public static generate(robot: w.Entity, avoid: boolean, squirrelMap: SquirrelMap, pathMap: PathMap, world: w.World): SquirrelIntent[] {
        if (world.tick >= squirrelMap.unsquirrelTick) {
            return [];
        }

        const intents = squirrelMap.locations.map(location => SquirrelIntent.evaluate(robot, location, avoid, pathMap)).filter(x => !!x);
        intents.sort(Intent.maximumValue);
        return intents;
    }

    private static evaluate(robot: w.Entity, target: Vec, avoid: boolean, pathMap: PathMap): SquirrelIntent {
        if (target.x < Params.MinSquirrelX) {
            return null;
        }

        if (target.x > robot.pos.x) {
            return null;
        }

        const destination = collections.minBy(
            traverse.neighbours(target, pathMap.bounds),
            n => pathMap.cost(n));

        const returnTicks = pathMap.cost(destination);
        const value = discount(1, returnTicks);

        return new SquirrelIntent(robot.id, target, destination, avoid, value);
    }

    duplicates(other: Intent): boolean {
        if (other instanceof SquirrelIntent) {
            return this.target.equals(other.target);
        } else {
            return super.duplicates(other);
        }
    }

    toAction(robot: w.Entity, explosionAvoider: ExplosionAvoider, pathMap: PathMap): w.Action {
        if (robot.pos.equals(this.destination)) {
            return {
                entityId: robot.id,
                type: "dig",
                target: this.target,
                tag: `(${this.target.string()})`,
            };
        } else {
            return {
                entityId: robot.id,
                type: "move",
                target: explosionAvoider.claimPath(robot.id, pathMap, this.destination),
                tag: `(${this.target.string()})`,
            };
        }
    }
}