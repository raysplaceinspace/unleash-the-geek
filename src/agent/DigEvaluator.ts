import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Beliefs from './Beliefs';
import { discount } from './Discount';
import Intent from './Intent';
import PayoffMap from './PayoffMap';
import PathMap from './PathMap';
import Vec from '../util/vector';

function maximumValue(a: DigIntent, b: DigIntent) {
    if (a.value > b.value) {
        return -1;
    } else if (a.value < b.value) {
        return 1;
    } else {
        return 0;
    }
}

export function generateDigActions(robot: w.Entity, world: w.World, beliefs: Beliefs, pathMap: PathMap): DigIntent[] {
    const payoffs = PayoffMap.generate(world, beliefs, pathMap, robot);

    const cellValues = [...collections.map(
        traverse.all(world),
        dig => DigIntent.evaluatePos(robot, dig, payoffs, pathMap))];
    cellValues.sort(maximumValue);

    const actionValues =
        cellValues
        .slice(0, world.numRobots)
    return actionValues;
}

export class DigIntent extends Intent {
    type: "dig";

    private constructor(robotId: number, public target: Vec, public destination: Vec, value: number) {
        super(robotId, value);
    }

    public static evaluatePos(robot: w.Entity, dig: Vec, payoffs: PayoffMap, pathMap: PathMap): DigIntent {
        const payoff = payoffs.payoff(dig.x, dig.y);
        const destination = collections.minBy(traverse.neighbours(dig, pathMap.bounds), n => pathMap.cost(n));
        const moveCost = pathMap.cost(destination);

        const value = discount(payoff, moveCost);
        return new DigIntent(robot.id, dig, destination, value);
    }

    duplicates(other: Intent): boolean {
        if (other instanceof DigIntent) {
            return this.target.equals(other.target);
        } else {
            return super.duplicates(other);
        }
    }

    toAction(robot: w.Entity, pathMap: PathMap): w.Action {
        if (robot.pos.equals(this.destination)) {
            return {
                entityId: robot.id,
                type: "dig",
                target: this.target,
                tag: this.target.string(),
            };
        } else {
            const path = pathMap.pathTo(this.destination);
            return {
                entityId: robot.id,
                type: "move",
                target: path[0],
                tag: this.target.string(),
            };
        }
    }
}