import * as wu from 'wu';
import * as w from '../world';
import * as angles from '../util/angles';
import * as log from '../log';
import Vec from '../util/vector';

function withinBounds(p: Vec, world: w.World) {
    return 0 <= p.x && p.x < world.width && 0 <= p.y && p.y < world.height;
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

export default class Agent {
    private beliefs: CellBelief[][];

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

    choose(previous: w.World, world: w.World, teamId: number): w.Action[] {
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
                const previousRobot = previous.entities.find(r => r.id === robot.id);
                if (previousRobot && previousRobot.pos.x === robot.pos.x && previousRobot.pos.y === robot.pos.y) {
                    const knownDig = wu(unexplainedDigs.values()).some(dig => Vec.l1(dig, previousRobot.pos) <= w.DigRange);
                    if (!knownDig) {
                        wu(neighbours(previousRobot.pos, world)).forEach(n => {
                            if (world.map[n.y][n.x].hole) {
                                this.beliefs[n.y][n.x].observedStillEnemy();
                            }
                        });
                    }
                }
            }
        });

        unexplainedDigs.forEach(dig => {
            this.beliefs[dig.y][dig.x].observedEnemyDig();
        });

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

        const actions = new Array<w.Action>();
        const robots = world.entities.filter(r => r.type === w.ItemType.RobotTeam0);
        for (const robot of robots) {
            actions.push(this.chooseForRobot(world, robot, actions));
        }

        return actions;
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

    private chooseForRobot(world: w.World, robot: w.Entity, otherActions: w.Action[]): w.Action {
        if (robot.dead) {
            return {
                entityId: robot.id,
                type: "wait",
            }
        } else if (robot.carrying === w.ItemType.Ore) {
            return {
                entityId: robot.id,
                type: "move",
                target: new Vec(0, robot.pos.y),
            };
        } else if (world.teams[0].radarCooldown === 0 && robot.pos.x === 0) {
            console.error("Requesting radar");
            return {
                entityId: robot.id,
                type: "request",
                item: w.ItemType.Radar,
            };
        } else {
            return {
                entityId: robot.id,
                type: "dig",
                target: this.closestUndug(robot.pos, world, otherActions),
            }
        }
    }

    private closestUndug(from: Vec, world: w.World, otherActions: w.Action[]) {
        let target = from;
        let best = 0;

        const payoffs = new Array<number[]>();
        for (let y = 0; y < world.height; ++y) {
            payoffs[y] = new Array<number>();
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                const belief = this.beliefs[y][x];
                if (belief.trapBelief <= 0) {
                    const moveCost = Math.ceil(Math.max(0, Vec.l1(cell.pos, from) - w.DigRange) / w.MovementSpeed)
                    const returnCost = Math.ceil(cell.pos.x / w.MovementSpeed);
                    const duplication = this.duplicationCost(cell.pos, otherActions);
                    const cost = moveCost + returnCost + duplication;

                    const payoff = (belief.oreProbability() * Math.exp(-cost));
                    payoffs[y][x] = payoff;
                }
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
        console.error(`Targeting ${target.string()} with payoff ${best}`);
        return target;
    }

    private duplicationCost(target: Vec, otherActions: w.Action[]): number {
        const DuplicationRange = 1;

        const outside = DuplicationRange + 1;
        let closest = outside;
        otherActions.forEach(action => {
            if (action && action.type === "dig") {
                const distance = Vec.l1(action.target, target);
                if (distance < closest) {
                    closest = distance;
                }
            }
        });

        return outside - closest;
    }
}

class CellBelief {
    pos: Vec;

    oreBelief = 0;
    oreKnown = 0;
    hadOre = false;
    trapBelief = 0;

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
            this.oreBelief -= 5 * modifier;
        }
    }

    observedStillEnemy() {
        this.trapBelief += 0.01;
    }

    observedEnemyDig() {
        this.trapBelief += 0.1;
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
}