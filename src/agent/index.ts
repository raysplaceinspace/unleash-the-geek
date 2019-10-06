import * as w from '../world';
import * as angles from '../util/angles';
import * as log from '../log';
import Vec from '../util/vector';

function withinBounds(p: Vec, world: w.World) {
    return distanceToEdge(p, world) >= 0;
}

function* neighbours(pos: Vec, world: w.World, range: number = 1): Iterable<Vec> {
    for (let y = pos.y - range; y <= pos.y + range; ++y) {
        for (let x = pos.x - range; x <= pos.x + range; ++x) {
            const n = new Vec(x, y);
            if (Vec.l1(pos, n) <= range && withinBounds(n, world)) {
                yield n;
            }
        }
    }
}

function distanceToEdge(p: Vec, world: w.World) {
    return Math.min(
        p.x, world.width - p.x - 1,
        p.y, world.height - p.y - 1,
    );
}

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

        const actions = new Array<w.Action>();
        const robots = world.entities.filter(r => r.type === w.ItemType.RobotTeam0);
        for (const robot of robots) {
            actions.push(this.chooseForRobot(world, robot, trapMap, actions));
        }

        return actions;
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
                    for (const p of neighbours(target, world, 2)) {
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
                            break;
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
                        for (const n of neighbours(previousRobot.pos, world)) {
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
                const belief = this.beliefs[y][x];

                const destination = this.moveNeighbour(robot.pos, cell.pos, world);

                const digCost = Vec.l1(robot.pos, cell.pos) <= w.DigRange ? 0 : 1;
                const moveCost = Math.ceil(Vec.l1(robot.pos, destination) / w.MovementSpeed);
                const returnCost = Math.ceil(destination.x / w.MovementSpeed);
                const radarCost = hasRadar ? this.radarCost(cell.pos, world) : 0;
                const explosionCost = trapMap[destination.y][destination.x];
                const duplication = this.duplicationCost(cell.pos, otherActions);
                const cost =
                    0.1 * digCost
                    1 * moveCost
                    + 0.1 * returnCost
                    + 3 * radarCost
                    + 1 * duplication
                    + 1 * explosionCost;

                const payoff =
                    belief.oreProbability() / (1 + cost)
                    - 1 * belief.trapProbability();

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
            tag: `${best.toFixed(2)}`,
        }
    }

    private moveNeighbour(from: Vec, to: Vec, world: w.World) {
        let closest = to;
        let closestDistance = Infinity;

        for (const n of neighbours(to, world)) {
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
                for (const trap of neighbours(enemy.pos, world)) {
                    const trapProbability = this.beliefs[trap.y][trap.x].trapProbability();
                    if (trapProbability > 0) {
                        for (const explosion of neighbours(trap, world)) {
                            trapMap[explosion.y][explosion.x] += trapProbability;
                        }
                    }
                }
            }
        });

        return trapMap;
    }

    private duplicationCost(target: Vec, otherActions: w.Action[]): number {
        const DuplicateCost = 10;
        const duplicate = otherActions.some(a => a.type === "dig" && a.target.x === target.x && a.target.y === target.y);
        return duplicate ? DuplicateCost : 0;
    }

    private radarCost(target: Vec, world: w.World): number {
        const outside = 2 * w.RadarRange + 1; // 2x because two radars have overlapping range
        let closest = Math.min(outside, 2 * distanceToEdge(target, world)); // edge doesn't have a radar attached, so double it to match scale
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

class CellBelief {
    pos: Vec;

    oreBelief = 0;
    oreKnown = 0;
    hadOre = false;

    trapBelief = 0;
    trapKnown = 0;

    constructor(pos: Vec) {
        this.pos = pos;
    }

    observedSelfDig(success: boolean) {
        if (success) {
            this.oreBelief = 1;
            this.oreKnown = 1;
            this.hadOre = true;
        } else {
            this.oreBelief = -1;
            this.oreKnown = -1;
        }
    }

    observedNeighbour(success: boolean, neighbour: CellBelief) {
        const distance = Vec.l1(this.pos, neighbour.pos);
        const modifier = Math.exp(-distance);

        if (success) {
            this.oreBelief += 10 * modifier;
        } else if (neighbour.hadOre) {
            // The only reason we're unsuccessful is because we always dig until the neighbour doesn't have ore anymore,
            // not because there is possibly no ore here
        } else {
            this.oreBelief -= 10 * modifier;
        }
    }

    observedStillEnemy(carryingProbability: number) {
        if (carryingProbability > 0) {
            this.trapBelief += 1;
        }
    }

    observedEnemyDig(carryingProbability: number) {
        if (carryingProbability > 0) {
            this.trapBelief += 1;
        }
    }

    observedOre(success: boolean) {
        if (success) {
            this.oreBelief = 1;
            this.oreKnown = 1;
            this.hadOre = true;
        } else {
            this.oreBelief = -1;
            this.oreKnown = -1;
        }
    }

    observedTrap() {
        this.trapKnown = 1;
    }

    oreProbability() {
        if (this.pos.x === 0) {
            return 0; // Never any ore in the headquarter row
        } else if (this.oreKnown < 0) {
            return 0;
        } else if (this.oreKnown > 0) {
            return 1;
        } else {
            return 1 / (1 + Math.exp(-this.oreBelief));
        }

    }

    trapProbability() {
        if (this.pos.x === 0) {
            return 0; // Never any traps in the headquarter row
        } else if (this.trapKnown > 0) {
            return 1;
        } else if (this.trapKnown < 0) {
            return -1;
        } else {
            return 1 - Math.exp(-this.trapBelief); // zero trap belief = 0 probability of a trap 
        }
    }
}

class EnemyRobotBelief {
    carryingBelief = 0;

    constructor(public entityId: number) {
    }

    observedStillAtHeadquarters() {
        this.carryingBelief = 1;
    }

    observedEnemyDig() {
        this.carryingBelief = -1;
    }

    observedPotentialDig() {
        this.carryingBelief -= 0.1;
    }

    carryingProbability() {
        return Math.max(0, 1 - Math.exp(-this.carryingBelief)); // zero probability if zero belief
    }
}