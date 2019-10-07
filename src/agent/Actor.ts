import * as w from '../model';
import { some } from '../util/collections';
import Vec from '../util/vector';
import Beliefs from './Beliefs';
import TrapMap from './TrapMap';

export default class Actor {
    private trapMap: TrapMap;
    private actions = new Map<number, w.Action>();

    constructor(private world: w.World, private beliefs: Beliefs) {
        this.trapMap = TrapMap.generate(world, beliefs);
    }

    choose(): Map<number, w.Action> {
        const robots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0);
        for (const robot of robots) {
            const action = this.chooseForRobot(robot);
            this.actions.set(robot.id, action);
        }

        return this.actions;
    }

    private chooseForRobot(robot: w.Entity): w.Action {
        const world = this.world;
        if (robot.dead) {
            return {
                entityId: robot.id,
                type: "wait",
            }
        } else if (robot.carrying === w.ItemType.Ore) {
            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Radar,
            };
        } else if (robot.carrying === w.ItemType.None && world.teams[0].radarCooldown === 0 && robot.pos.x === 0
            && !some(this.actions.values(), a => a.type === "request" && a.item === w.ItemType.Radar)) {

            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Radar,
            };
        } else if (robot.carrying === w.ItemType.None && world.teams[0].trapCooldown === 0 && robot.pos.x === 0
            && !some(this.actions.values(), a => a.type === "request" && a.item === w.ItemType.Trap)) {

            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Trap,
            };
        } else {
            return this.closestUndug(robot);
        }
    }

    private closestUndug(robot: w.Entity): w.Action {
        const world = this.world;

        const hasRadar = robot.carrying === w.ItemType.Radar;
        const hasTrap = robot.carrying === w.ItemType.Trap;

        let target = robot.pos;
        let best = 0;

        const payoffs = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            payoffs[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];

                const destination = this.moveNeighbour(robot.pos, cell.pos, world);

                const digCost = Vec.l1(robot.pos, cell.pos) <= w.DigRange ? 0 : 1;
                const moveCost = Math.ceil(Vec.l1(robot.pos, destination) / w.MovementSpeed);
                const returnCost = Math.ceil(destination.x / w.MovementSpeed);
                const radarCost = hasRadar ? this.radarCost(cell.pos, world) : 0;
                const placementCost = hasTrap ? this.placementCost(cell.pos, world) : 0;
                const explosionCost = this.trapMap.explodeProbability(destination.x, destination.y);
                const duplication = this.duplicationCost(cell.pos);
                const cost =
                    0.1 * digCost
                    + 1 * moveCost
                    + 0.25 * returnCost
                    + 1 + placementCost
                    + 3 * radarCost
                    + 10 * duplication
                    + 1 * explosionCost;

                const oreProbability = this.beliefs.oreProbability(x, y);
                const trapProbability = this.beliefs.trapProbability(x, y);

                const payoff = oreProbability / (1 + cost) - trapProbability

                payoffs[y][x] = payoff;
            }
        }

        for (let y = 0; y < world.height; ++y) {
            for (let x = 1; x < world.width; ++x) { // Start at 1 because cannot dig headquarter row
                const cell = world.map[y][x];
                const payoff = payoffs[y][x];
                if (payoff > best) {
                    best = payoff;
                    target = cell.pos;
                }
            }
        }

        return {
            entityId: robot.id,
            type: "dig",
            target,
            tag: `${(100 * best).toFixed(0)}%`,
        }
    }

    private moveNeighbour(from: Vec, to: Vec, world: w.World) {
        let closest = to;
        let closestDistance = Infinity;

        for (const n of w.neighbours(to, world)) {
            const distance = Vec.l1(from, n);
            if (distance < closestDistance) {
                closestDistance = distance;
                closest = n;
            }
        }
        return closest;
    }
    
    private duplicationCost(target: Vec): number {
        const duplicate = some(this.actions.values(), a => a.type === "dig" && a.target.x === target.x && a.target.y === target.y);
        return duplicate ? 1 : 0;
    }

    private placementCost(target: Vec, world: w.World): number {
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

    private radarCost(target: Vec, world: w.World): number {
        const outside = 2 * w.RadarRange + 1; // 2x because two radars have overlapping range
        let closest = Math.min(outside, 2 * w.distanceToEdge(target, world)); // edge doesn't have a radar attached, so double it to match scale
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
