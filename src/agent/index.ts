import * as wu from 'wu';
import * as w from '../world';
import * as angles from '../util/angles';
import * as log from '../log';
import Vec from '../util/vector';

function withinBounds(p: Vec, world: w.World) {
    return 0 <= p.x && p.x < world.width && 0 <= p.y && p.y < world.height;
}

function neighbours(pos: Vec, world: w.World): Iterable<Vec> {
    return wu(neighboursUntested(pos)).filter(p => withinBounds(p, world));
}

function* neighboursUntested(pos: Vec): Iterable<Vec> {
    yield pos;
    yield new Vec(pos.x + 1, pos.y);
    yield new Vec(pos.x - 1, pos.y);
    yield new Vec(pos.x, pos.y + 1);
    yield new Vec(pos.x, pos.y - 1);
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
                    && Vec.l1(previousAction.target, previousRobot.pos) <= 1) { // Must be next to cell to dig it

                    unexplainedDigs.delete(previousAction.target.string());

                    const target = previousAction.target;
                    if (previousRobot && previousRobot.carrying !== robot.carrying && robot.carrying === w.ItemType.Ore) {
                        console.error(`Successful dig at ${target.string()}`);
                        this.beliefs[target.y][target.x].observedSuccessfulDig();
                    } else {
                        console.error(`Unsuccessful dig at ${target.string()}`);
                        this.beliefs[target.y][target.x].observedUnsuccessfulDig();
                    }
                }
            }
        });

        world.entities.forEach(robot => {
            if (robot.type === w.ItemType.RobotTeam1 && !robot.dead) {
                const previousRobot = previous.entities.find(r => r.id === robot.id);
                if (previousRobot && previousRobot.pos.x === robot.pos.x && previousRobot.pos.y === robot.pos.y) {
                    const knownDig = wu(unexplainedDigs.values()).some(dig => Vec.l1(dig, previousRobot.pos) <= 1);
                    if (!knownDig) {
                        wu(neighbours(previousRobot.pos, world)).forEach(n => {
                            if (world.map[n.y][n.x].hole) {
                                console.error(`Enemy still near ${n.string()}`);
                                this.beliefs[n.y][n.x].observedStillEnemy();
                            }
                        });
                    }
                }
            }
        });

        unexplainedDigs.forEach(dig => {
            console.error(`Unexplained dig at ${dig.string()}`);
            this.beliefs[dig.y][dig.x].observedEnemyDig();
        });

        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                if (typeof cell.ore === 'number') {
                    if (cell.ore > 0) {
                        this.beliefs[y][x].observedOre();
                    } else {
                        this.beliefs[y][x].observedNoOre();
                    }
                }
            }
        }

        const actions = new Array<w.Action>();
        const robots = world.entities.filter(r => r.type === w.ItemType.RobotTeam0);
        for (const robot of robots) {
            actions.push(this.chooseForRobot(world, robot));
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

    private chooseForRobot(world: w.World, robot: w.Entity): w.Action {
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
        } else {
            return {
                entityId: robot.id,
                type: "dig",
                target: this.closestUndug(robot.pos, world),
            }
        }
    }

    private closestUndug(from: Vec, world: w.World) {
        let target = from;
        let closest = Infinity;
        for (let y = 0; y < world.height; ++y) {
            for (let x = 1; x < world.width; ++x) { // Start at 1 because cannot dig headquarter row
                const cell = world.map[y][x];
                const belief = this.beliefs[y][x];
                if (belief.oreBelief >= 0 && belief.trapBelief <= 0) {
                    const distance = Vec.distance(cell.pos, from);
                    if (distance < closest) {
                        closest = distance;
                        target = cell.pos;
                    }
                }
            }
        }
        return target;
    }
}

class CellBelief {
    pos: Vec;

    oreBelief = 0;
    trapBelief = 0;

    constructor(pos: Vec) {
        this.pos = pos;
    }

    observedSuccessfulDig() {
        this.oreBelief += 10;
    }

    observedUnsuccessfulDig() {
        this.oreBelief = -1000;
    }

    observedStillEnemy() {
        this.trapBelief += 1;
    }

    observedEnemyDig() {
        this.trapBelief += 10;
    }

    observedOre() {
        this.oreBelief = 1000;
    }

    observedNoOre() {
        this.oreBelief = -1000;
    }
}