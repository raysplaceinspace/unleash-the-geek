import * as w from '../model';
import Vec from '../util/vector';
import CellBelief from './CellBelief';
import EnemyRobotBelief from './EnemyRobotBelief';

export default class Agent {
    private beliefs: CellBelief[][];
    private enemyBeliefs = new Map<number, EnemyRobotBelief>();

    constructor(width: number, height: number) {
        this.beliefs = Agent.initialBeliefs(width, height);
    }

    private static initialBeliefs(width: number, height: number) {
        const beliefs = new Array<CellBelief[]>();
        for (let y = 0; y < height; ++y) {
            beliefs[y] = new Array<CellBelief>();
            for (let x = 0; x < width; ++x) {
                beliefs[y][x] = new CellBelief(new Vec(x, y));
            }
        }
        return beliefs;
    }

    choose(previous: w.World, world: w.World): w.Action[] {
        this.updateBeliefsFromDigs(previous, world);
        this.updateBeliefsFromMap(world);
        this.updateBeliefsFromEntities(previous, world);

        const trapMap = this.generateTrapMap(world);

        const actions = new Map<number, w.Action>();
        const robots = world.entities.filter(r => r.type === w.ItemType.RobotTeam0);
        for (const robot of robots) {
            const action = this.chooseForRobot(world, robot, trapMap, [...actions.values()]);
            actions.set(robot.id, action);
        }

        return robots.map(robot => actions.get(robot.id));
    }

    private updateBeliefsFromDigs(previous: w.World, world: w.World) {
        const allDigs = this.findDigs(previous, world);
        const unexplainedDigs = new Map(allDigs);
        world.entities.forEach(robot => {
            if (robot.type === w.ItemType.RobotTeam0 && !robot.dead) {
                const previousRobot = previous.entities.find(r => r.id === robot.id);
                const previousAction = previous.actions.find(a => a.entityId === robot.id);
                if (previousAction
                    && previousAction.type === "dig"
                    && Vec.l1(previousRobot.pos, robot.pos) === 0 // Stand still to dig
                    && Vec.l1(previousAction.target, previousRobot.pos) <= w.DigRange) { // Must be next to cell to dig it

                    unexplainedDigs.delete(previousAction.target.string());

                    const target = previousAction.target;
                    const success = previousRobot && previousRobot.carrying !== robot.carrying && robot.carrying === w.ItemType.Ore;
                    console.error(`Self dig ${robot.id}, success=${success}`);

                    const cellBelief = this.beliefs[target.y][target.x];
                    cellBelief.observedSelfDig(success);
                    for (const p of w.neighbours(target, world, 2)) {
                        this.beliefs[p.y][p.x].observedNeighbour(success, cellBelief);
                    }
                }
            }
        });

        world.entities.forEach(robot => {
            if (robot.type === w.ItemType.RobotTeam1 && !robot.dead) {
                const robotBelief = this.getOrCreateEnemyBelief(robot.id);

                const previousRobot = previous.entities.find(r => r.id === robot.id);
                if (previousRobot && previousRobot.pos.x === robot.pos.x && previousRobot.pos.y === robot.pos.y) {
                    let knownDig = new Array<Vec>();
                    for (const dig of unexplainedDigs.values()) {
                        if (Vec.l1(dig, previousRobot.pos) <= w.DigRange) {
                            knownDig.push(dig);
                        }
                    }

                    const carryingProbability = robotBelief.carryingProbability();
                    if (knownDig.length > 0) {
                        console.error(`Enemy dig ${robot.id}: carrying=${carryingProbability.toFixed(2)} at ${knownDig.map(x => x.string()).join(' ')}`);

                        robotBelief.observedEnemyDig();

                        for (const dig of knownDig) {
                            this.beliefs[dig.y][dig.x].observedEnemyDig(carryingProbability);
                        }

                    } else {
                        let potentialDig = false;
                        for (const n of w.neighbours(previousRobot.pos, world)) {
                            if (world.map[n.y][n.x].hole) {
                                potentialDig = true;
                                this.beliefs[n.y][n.x].observedStillEnemy(carryingProbability);
                            }
                        }

                        if (potentialDig) {
                            console.error(`Enemy still ${robot.id}: carrying=${carryingProbability.toFixed(2)}`);
                            robotBelief.observedPotentialDig();
                        }
                    }

                    if (robot.pos.x === 0) {
                        // Stood still at headquarters
                        console.error(`Enemy pickup ${robot.id} possible`);
                        robotBelief.observedStillAtHeadquarters();
                    }
                }
            }
        });
    }

    private updateBeliefsFromMap(world: w.World) {
        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                if (typeof cell.ore === 'number') {
                    const success = cell.ore > 0;

                    const cellBelief = this.beliefs[y][x];
                    cellBelief.observedOre(success);
                }
            }
        }
    }

    private updateBeliefsFromEntities(previous: w.World, world: w.World) {
        world.entities.forEach(entity => {
            if (entity.type === w.ItemType.Trap) {
                const cellBelief = this.beliefs[entity.pos.y][entity.pos.x];
                cellBelief.observedTrap();
            }
        });
    }

    private getOrCreateEnemyBelief(robotId: number) {
        let enemyBelief = this.enemyBeliefs.get(robotId)
        if (!enemyBelief) {
            enemyBelief = new EnemyRobotBelief(robotId);
            this.enemyBeliefs.set(robotId, enemyBelief);
        }
        return enemyBelief;
    }

    private findDigs(previous: w.World, world: w.World): Map<string, Vec> {
        const result = new Map<string, Vec>();
        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {
                const previousCell = previous.map[y][x];
                const newCell = world.map[y][x];

                if (newCell.hole && !previousCell.hole) {
                    result.set(newCell.pos.string(), newCell.pos);
                }
            }
        }
        return result;
    }

    private chooseForRobot(world: w.World, robot: w.Entity, trapMap: number[][], otherActions: w.Action[]): w.Action {
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
            && !otherActions.some(a => a.type === "request" && a.item === w.ItemType.Radar)) {

            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Radar,
            };
        } else if (robot.carrying === w.ItemType.None && world.teams[0].trapCooldown === 0 && robot.pos.x === 0
            && !otherActions.some(a => a.type === "request" && a.item === w.ItemType.Trap)) {

            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Trap,
            };
        } else {
            return this.closestUndug(robot, world, trapMap, otherActions);
        }
    }

    private closestUndug(robot: w.Entity, world: w.World, trapMap: number[][], otherActions: w.Action[]): w.Action {
        const hasRadar = robot.carrying === w.ItemType.Radar;
        const hasTrap = robot.carrying === w.ItemType.Trap;

        let target = robot.pos;
        let best = 0;

        const payoffs = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            payoffs[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                const cellBelief = this.beliefs[y][x];

                const destination = this.moveNeighbour(robot.pos, cell.pos, world);

                const digCost = Vec.l1(robot.pos, cell.pos) <= w.DigRange ? 0 : 1;
                const moveCost = Math.ceil(Vec.l1(robot.pos, destination) / w.MovementSpeed);
                const returnCost = Math.ceil(destination.x / w.MovementSpeed);
                const radarCost = hasRadar ? this.radarCost(cell.pos, world) : 0;
                const placementCost = hasTrap ? this.placementCost(cell.pos, world) : 0;
                const explosionCost = trapMap[destination.y][destination.x];
                const duplication = this.duplicationCost(cell.pos, otherActions);
                const cost =
                    0.1 * digCost
                    + 1 * moveCost
                    + 0.25 * returnCost
                    + 1 + placementCost
                    + 3 * radarCost
                    + 10 * duplication
                    + 1 * explosionCost;

                const payoff =
                    cellBelief.oreProbability() / (1 + cost)
                    - 1 * cellBelief.trapProbability()

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
    
    private generateTrapMap(world: w.World): number[][] {
        const trapMap = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            trapMap[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                trapMap[y][x] = 0;
            }
        }

        world.entities.forEach(enemy => {
            if (enemy.type === w.ItemType.RobotTeam1) {
                for (const trap of w.neighbours(enemy.pos, world)) {
                    const trapProbability = this.beliefs[trap.y][trap.x].trapProbability();
                    this.explodeTrap(trap, trapProbability, world, trapMap);
                }
            }
        });

        return trapMap;
    }

    private explodeTrap(trap: Vec, trapProbability: number, world: w.World, trapMap: Array<number[]>) {
        if (trapProbability <= 0) {
            return;
        }

        const initialTrapProbability = trapMap[trap.y][trap.x];
        if (trapProbability > initialTrapProbability) {
            trapMap[trap.y][trap.x] = trapProbability;

            for (const explosion of w.neighbours(trap, world)) {
                trapMap[explosion.y][explosion.x] = Math.max(trapMap[explosion.y][explosion.x], trapProbability);

                const nextTrapProbability = this.beliefs[explosion.y][explosion.x].trapProbability();
                this.explodeTrap(explosion, nextTrapProbability, world, trapMap);
            }
        }
    }

    private duplicationCost(target: Vec, otherActions: w.Action[]): number {
        const duplicate = otherActions.some(a => a.type === "dig" && a.target.x === target.x && a.target.y === target.y);
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
