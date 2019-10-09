import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import CellBelief from './CellBelief';
import EnemyRobotBelief from './EnemyRobotBelief';
import * as Params from './Params';

export default class Beliefs {
    private beliefs: CellBelief[][];
    private enemyBeliefs = new Map<number, EnemyRobotBelief>();

    constructor(width: number, height: number) {
        this.beliefs = Beliefs.initialBeliefs(width, height);
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

    oreProbability(x: number, y: number) {
        return this.beliefs[y][x].oreProbability();
    }

    trapProbability(x: number, y: number) {
        return this.beliefs[y][x].trapProbability();
    }

    carryingProbability(robotId: number) {
        const belief = this.enemyBeliefs.get(robotId);
        return belief ? belief.carryingProbability() : 0;
    }

    update(previous: w.World, world: w.World) {
        this.updateBeliefsFromDigs(previous, world);
        this.updateBeliefsFromMap(world);
        this.updateBeliefsFromEntities(previous, world);
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
                    for (const p of traverse.neighbours(target, world, Params.OreNeighbourRange)) {
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
                        for (const n of traverse.neighbours(previousRobot.pos, world)) {
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
                const oldCell = previous.map[y][x];
                const newCell = world.map[y][x];

                if (newCell.hole && !oldCell.hole
                    || newCell.ore !== null && oldCell.ore !== null && newCell.ore < oldCell.ore) {

                    result.set(newCell.pos.string(), newCell.pos);
                }
            }
        }
        return result;
    }
}
