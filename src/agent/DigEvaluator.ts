import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import ActionValue from './ActionValue';
import Beliefs from './Beliefs';
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

export function generateDigActions(robot: w.Entity, world: w.World, beliefs: Beliefs, pathMap: PathMap): ActionValue[] {
    const payoffs = PayoffMap.generate(world, beliefs, robot);

    const cellValues = [...collections.map(
        traverse.all(world),
        dig => DigIntent.evaluatePos(dig, payoffs, pathMap))];
    cellValues.sort(maximumValue);

    const actionValues =
        cellValues
        .slice(0, world.numRobots)
        .map(cellValue => cellValue.toActionValue(robot, pathMap));
    return actionValues;
}

class DigIntent {
    constructor(public dig: Vec, public destination: Vec, public value: number) {
    }

    public static evaluatePos(dig: Vec, payoffs: PayoffMap, pathMap: PathMap): DigIntent {
        const payoff = payoffs.payoff(dig.x, dig.y);
        const destination = collections.minBy(traverse.neighbours(dig, pathMap.bounds), n => pathMap.cost(n));
        const moveCost = pathMap.cost(destination);

        const value = payoff / (1 + moveCost);
        return new DigIntent(dig, destination, value);
    }

    toActionValue(robot: w.Entity, pathMap: PathMap): ActionValue {
        if (robot.pos.equals(this.destination)) {
            return new ActionValue(this.value, {
                entityId: robot.id,
                type: "dig",
                target: this.dig,
                tag: this.dig.string(),
            });
        } else {
            const path = pathMap.pathTo(this.destination);
            return new ActionValue(this.value, {
                entityId: robot.id,
                type: "move",
                target: path[0],
                tag: this.dig.string(),
            });
        }
    }
}