import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import * as Params from './Params';
import PayoffMap from './PayoffMap';
import PathMap from './PathMap';
import RadarMap from './RadarMap';
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

    public static generateDigActions(robot: w.Entity, world: w.World, payoffMap: PayoffMap, pathMap: PathMap, radarMap: RadarMap, beliefs: Beliefs): DigIntent[] {
        const cellValues = [...collections.map(
            traverse.right(world, 1),
            dig => DigIntent.evaluatePos(robot, dig, world, payoffMap, pathMap, radarMap, beliefs))];
        cellValues.sort(maximumValue);

        return cellValues;
    }

    private static evaluatePos(robot: w.Entity, dig: Vec, world: w.World, payoffs: PayoffMap, pathMap: PathMap, radarMap: RadarMap, beliefs: Beliefs): DigIntent {
        const placementCost = robot.carrying === w.ItemType.Trap ? DigIntent.placementCost(dig, world) : 0;

        const divisor = Params.TrapPlacementWeight + placementCost

        const payoff = payoffs.payoff(dig.x, dig.y);
        const destination = collections.minBy(
            traverse.neighbours(dig, pathMap.bounds),
            n => DigIntent.calculateReturnTicks(n, pathMap));
        const moveTicks = DigIntent.calculateReturnTicks(destination, pathMap);

        const initialValue = discount(payoff / (1 + divisor), moveTicks);

        let value = initialValue;
        value += DigIntent.evaluateFutureDigs(robot, dig, world, beliefs, moveTicks);
        value += DigIntent.evaluateRadar(robot, dig, world, pathMap, radarMap);

        if (beliefs.trapProbability(dig.x, dig.y) > 0) {
            value -= Params.ExplosionCost;
        }

        return new DigIntent(robot.id, dig, destination, value);
    }

    private static evaluateRadar(robot: w.Entity, dig: Vec, world: w.World, pathMap: PathMap, radarMap: RadarMap): number {
        if (robot.carrying !== w.ItemType.Radar) {
            return 0;
        }

        const travelTicks = pathMap.cost(dig);
        const digAndReturnTicks = this.calculateDigAndReturnTicks(dig);

        let payoff = 0;
        for (const n of traverse.neighbours(dig, world, w.RadarRange)) {
            payoff += radarMap.payoff(n.x, n.y);
        }
        payoff /= w.RadarRange * w.RadarRange;

        const ticks = travelTicks + digAndReturnTicks;
        const value = discount(Params.RadarPlacementWeight * payoff, ticks);
        return value;
    }

    private static evaluateFutureDigs(robot: w.Entity, dig: Vec, world: w.World, beliefs: Beliefs, initialTicks: number): number {
        // The first one to touch an ore while carrying seals the cell because the enemy won't risk setting off a trap set there
        const appearsCarrying = beliefs.carryingProbability(robot.id) > 0;
        if (!(appearsCarrying && !beliefs.appearsTrapped(dig.x, dig.y))) {
            return 0;
        }

        const cell = world.map[dig.y][dig.x];
        if (typeof cell.ore !== 'number') {
            return 0;
        }

        const numFutureDigs = cell.ore - 1; // -1 because the first ore is the current dig
        if (numFutureDigs <= 0) {
            return 0;
        }

        const digAndReturnTicks = this.calculateDigAndReturnTicks(dig);

        let extraValue = 0;

        let tick = initialTicks;
        for (let i = 0; i < numFutureDigs; ++i) {
            tick += digAndReturnTicks;
            extraValue += discount(1, tick);
        }

        return Params.FutureOreWeight * extraValue;
    }

    private static calculateDigAndReturnTicks(dig: Vec) {
        const digAndReturnTicks = 2 * Math.ceil(dig.x / w.MovementSpeed);
        return digAndReturnTicks;
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