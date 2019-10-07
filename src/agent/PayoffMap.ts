import * as traverse from '../util/traverse';
import * as w from '../model';
import { discount } from './Discount';
import Beliefs from './Beliefs';
import PathMap from './PathMap';
import Vec from '../util/vector';

export default class PayoffMap {
    private constructor(private payoffMap: number[][]) {
    }

    payoff(x: number, y: number) {
        return this.payoffMap[y][x];
    }

    public static generate(world: w.World, beliefs: Beliefs, pathMap: PathMap, robot: w.Entity): PayoffMap {
        const payoffs = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            payoffs[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                payoffs[y][x] = PayoffMap.generateCell(cell, world, beliefs, pathMap, robot);
            }
        }

        return new PayoffMap(payoffs);
    }

    private static generateCell(cell: w.Cell, world: w.World, beliefs: Beliefs, pathMap: PathMap, robot: w.Entity): number {
        if (cell.pos.x <= 0) {
            // No payoff when digging headquarters
            return 0;
        }

        const trapProbability = beliefs.trapProbability(cell.pos.x, cell.pos.y);
        if (trapProbability > 0) {
            // Don't ever dig somewhere which could be trapped
            return -1;
        }

        const hasRadar = robot.carrying === w.ItemType.Radar;
        const hasTrap = robot.carrying === w.ItemType.Trap;

        const radarCost = hasRadar ? PayoffMap.radarCost(cell.pos, world) : 0;
        const placementCost = hasTrap ? PayoffMap.placementCost(cell.pos, world) : 0;
        const cost =
            + 1 + placementCost
            + 3 * radarCost

        const returnTicks = pathMap.cost(cell.pos);
        const oreProbability = beliefs.oreProbability(cell.pos.x, cell.pos.y);

        const payoff = discount(oreProbability / (1 + cost), returnTicks);
        return payoff;
    }

    private static placementCost(target: Vec, world: w.World): number {
        const PlacementRange = 5;
        const outside = PlacementRange + 1;
        let closest = outside;
        world.entities.forEach(enemy => {
            if (enemy && enemy.type === w.ItemType.RobotTeam1) {
                const distance = Vec.l1(enemy.pos, target);
                if (distance < closest) {
                    closest = distance;
                }
            }
        });

        return (outside - closest) / outside;
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
