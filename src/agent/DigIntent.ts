import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import * as Params from './Params';
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

export default class DigIntent extends Intent {
    type: "dig";

    private constructor(robotId: number, public target: Vec, public destination: Vec, value: number) {
        super(robotId, value);
    }

    public static generateDigActions(robot: w.Entity, world: w.World, payoffMap: PayoffMap, pathMap: PathMap): DigIntent[] {
        const cellValues = [...collections.map(
            traverse.all(world),
            dig => DigIntent.evaluatePos(robot, dig, world, payoffMap, pathMap))];
        cellValues.sort(maximumValue);

        const actionValues =
            cellValues
            .slice(0, world.numRobots)
        return actionValues;
    }

    public static evaluatePos(robot: w.Entity, dig: Vec, world: w.World, payoffs: PayoffMap, pathMap: PathMap): DigIntent {
        const radarCost = robot.carrying === w.ItemType.Radar ? DigIntent.radarCost(dig, world) : 0;
        const placementCost = robot.carrying === w.ItemType.Trap ? DigIntent.placementCost(dig, world) : 0;

        const divisor =
            + Params.TrapPlacementWeight + placementCost
            + Params.RadarPlacementWeight * radarCost

        const payoff = payoffs.payoff(dig.x, dig.y);
        const destination = collections.minBy(
            traverse.neighbours(dig, pathMap.bounds),
            n => DigIntent.calculateReturnTicks(n, pathMap));
        const moveCost = DigIntent.calculateReturnTicks(destination, pathMap);

        const value = discount(payoff / (1 + divisor), moveCost);
        return new DigIntent(robot.id, dig, destination, value);
    }

    private static calculateReturnTicks(n: Vec, pathMap: PathMap) {
        const returnTicks = n.x / w.MovementSpeed;
        return pathMap.cost(n) + returnTicks;
    }

    duplicates(other: Intent): boolean {
        if (other instanceof DigIntent) {
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
                tag: `[${this.target.string()}]`,
            };
        } else {
            return {
                entityId: robot.id,
                type: "move",
                target: explosionAvoider.claimPath(robot.id, pathMap, this.destination),
                tag: `[${this.target.string()}]`,
            };
        }
    }

    private static placementCost(target: Vec, world: w.World): number {
        const outside = Params.TrapPlacementRange + 1;
        let closest = outside;
        world.entities.forEach(enemy => {
            if (enemy && enemy.type === w.ItemType.RobotTeam1) {
                const distance = Vec.l1(enemy.pos, target);
                if (distance < closest) {
                    closest = distance;
                }
            }
        });

        return 1 - (outside - closest) / outside;
    }

    private static radarCost(target: Vec, world: w.World): number {
        const outside = 2 * w.RadarRange + 1; // 2x because two radars have overlapping range
        let closest = Math.min(outside, 2 * traverse.distanceToEdge(target, world)); // edge doesn't have a radar attached, so double it to match scale
        world.entities.forEach(radar => {
            if (radar && radar.type === w.ItemType.Radar) {
                const distance = Vec.l1(radar.pos, target);
                if (distance < closest) {
                    closest = distance;
                }
            }
        });

        return (outside - closest) / outside;
    }
}