import * as traverse from '../util/traverse';
import * as w from '../model';
import Vec from '../util/vector';
import CellBelief from './CellBelief';
import RobotBelief from './RobotBelief';
import * as Params from './Params';

export default class Beliefs {
    private cellBeliefs: CellBelief[][];
    private robotBeliefs = new Map<number, RobotBelief>();

    constructor(bounds: traverse.Dimensions) {
        this.cellBeliefs = Beliefs.initialBeliefs(bounds);
    }

    private static initialBeliefs(bounds: traverse.Dimensions) {
        const beliefs = new Array<CellBelief[]>();
        for (let y = 0; y < bounds.height; ++y) {
            beliefs[y] = new Array<CellBelief>();
            for (let x = 0; x < bounds.width; ++x) {
                beliefs[y][x] = CellBelief.create(new Vec(x, y), bounds);
            }
        }
        return beliefs;
    }

    oreProbability(x: number, y: number) {
        return this.cellBeliefs[y][x].oreProbability();
    }

    trapProbability(x: number, y: number) {
        return this.cellBeliefs[y][x].trapProbability();
    }

    carryingProbability(robotId: number) {
        const belief = this.robotBeliefs.get(robotId);
        return belief ? belief.carryingProbability() : 0;
    }

    appearsTrapped(x: number, y: number) {
        return this.cellBeliefs[y][x].appearsTrapped;
    }

    update(previous: w.World, world: w.World) {
        this.updateBeliefsFromDigs(previous, world);
        this.updateBeliefsFromMap(world);
        this.updateBeliefsFromEntities(previous, world);
    }

    private updateBeliefsFromDigs(previous: w.World, world: w.World) {
        const allDigs = this.findDigs(previous, world);
        const unexplainedDigs = [...allDigs];
        world.entities.forEach(robot => {
            if (robot.type === w.ItemType.RobotTeam0 && !robot.dead) {
                this.observeSelfRobots(robot, previous, world, unexplainedDigs);
            }
        });

        const diggingEnemies = this.findDiggingEnemies(previous, world);
        const knownAssignments = this.assignDigsToEnemies(unexplainedDigs, diggingEnemies);

        world.entities.forEach(robot => {
            if (robot.type === w.ItemType.RobotTeam1 && !robot.dead) {
                const knownDigs = knownAssignments.get(robot.id) || [];
                this.observeEnemyRobot(robot, previous, world, knownDigs);
            }
        });
    }

    private observeSelfRobots(robot: w.Entity, previous: w.World, world: w.World, unexplainedDigs: Vec[]) {
        const previousRobot = previous.entities.find(r => r.id === robot.id);
        const previousAction = previous.actions.find(a => a.entityId === robot.id);

        this.observeSelfDig(robot, previousAction, previousRobot, previous, world, unexplainedDigs);
        this.observeSelfPickup(robot, previousRobot);
    }

    private observeSelfDig(robot: w.Entity, dig: w.Action, previousRobot: w.Entity, previous: w.World, world: w.World, unexplainedDigs: Vec[]) {
        if (!(dig
            && dig.type === "dig"
            && previousRobot.pos.equals(robot.pos) // Stand still to dig
            && Vec.l1(dig.target, previousRobot.pos) <= w.DigRange)) { // Must be next to cell to dig it

            return;
        }

        // Dig has been explained
        {
            let index = unexplainedDigs.findIndex(x => x.equals(dig.target));
            if (index !== -1) {
                unexplainedDigs.splice(index, 1);
            }
        }

        // Update beliefs
        const target = dig.target;
        const cellBelief = this.cellBeliefs[target.y][target.x];
        const robotBelief = this.getOrCreateRobotBelief(robot.id);

        const previousCell = previous && previous.map[target.y][target.x];

        // Update cells
        const drop = previousRobot && previousRobot.carrying !== robot.carrying && previousRobot.carrying === w.ItemType.Ore;
        const success = previousRobot && previousRobot.carrying !== robot.carrying && robot.carrying === w.ItemType.Ore;
        const appearsTrapped = previousCell && !previousCell.hole && robotBelief.carryingProbability() > 0;
        console.error(`Self dig ${robot.id}, success=${success}, drop=${drop} appearsTrapped=${appearsTrapped}`);

        cellBelief.observedSelfDig(success, drop, appearsTrapped);
        for (const p of traverse.neighbours(target, world, Params.OreNeighbourRange)) {
            this.cellBeliefs[p.y][p.x].observedSelfDigNeighbour(success, cellBelief);
        }

        // Update carrying belief
        robotBelief.observedDig();
    }

    private observeSelfPickup(robot: w.Entity, previousRobot: w.Entity) {
        if (robot.pos.x === 0 && previousRobot && previousRobot.pos.equals(robot.pos)) {
            console.error(`Potential self pickup ${robot.id}`);

            // Still in headquarters -> belief
            const robotBelief = this.getOrCreateRobotBelief(robot.id);
            robotBelief.observedStillAtHeadquarters();
        }
    }

    private observeEnemyRobot(robot: w.Entity, previous: w.World, world: w.World, knownDigs: Vec[]) {
        const previousRobot = previous.entities.find(r => r.id === robot.id);

        this.observeEnemyDig(robot, previousRobot, world, knownDigs);
        this.observeEnemyPickup(robot, previousRobot);
    }

    private observeEnemyDig(robot: w.Entity, previousRobot: w.Entity, world: w.World, knownDigs: Vec[]) {
        if (!(previousRobot && previousRobot.pos.x === robot.pos.x && previousRobot.pos.y === robot.pos.y)) {
            return;
        }

        const robotBelief = this.getOrCreateRobotBelief(robot.id);

        const carryingProbability = robotBelief.carryingProbability();
        if (knownDigs.length > 0) {
            console.error(`Enemy dig ${robot.id}: carrying=${carryingProbability.toFixed(2)} at ${knownDigs.map(x => x.string()).join(' ')}`);

            robotBelief.observedDig();

            for (const dig of knownDigs) {
                this.cellBeliefs[dig.y][dig.x].observedEnemyDig(carryingProbability);
            }

        } else {
            let potentialDig = false;
            for (const n of traverse.neighbours(previousRobot.pos, world)) {
                if (world.map[n.y][n.x].hole) {
                    potentialDig = true;
                    this.cellBeliefs[n.y][n.x].observedStillEnemy(carryingProbability);
                }
            }

            if (potentialDig) {
                console.error(`Enemy still ${robot.id} (${robot.pos.string()}): carrying=${carryingProbability.toFixed(2)}`);
                robotBelief.observedPotentialDig();
            }
        }

        for (const n of traverse.neighbours(robot.pos, world, Params.OreNeighbourRange)) {
            if (world.map[n.y][n.x].hole) {
                this.cellBeliefs[n.y][n.x].observedEnemyDigNeighbour(robot.pos);
            }
        }
    }

    private observeEnemyPickup(robot: w.Entity, previousRobot: w.Entity) {
        if (robot.pos.x === 0 && previousRobot && previousRobot.pos.x === robot.pos.x && previousRobot.pos.y === robot.pos.y) {
            const robotBelief = this.getOrCreateRobotBelief(robot.id);
            // Stood still at headquarters
            console.error(`Enemy pickup ${robot.id} possible`);
            robotBelief.observedStillAtHeadquarters();
        }
    }

    private updateBeliefsFromMap(world: w.World) {
        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {
                const cell = world.map[y][x];
                if (typeof cell.ore === 'number') {
                    const success = cell.ore > 0;

                    const cellBelief = this.cellBeliefs[y][x];
                    cellBelief.observedOre(success);
                }
            }
        }
    }

    private updateBeliefsFromEntities(previous: w.World, world: w.World) {
        world.entities.forEach(entity => {
            if (entity.type === w.ItemType.Trap) {
                const cellBelief = this.cellBeliefs[entity.pos.y][entity.pos.x];
                cellBelief.observedTrap();
            }
        });
    }

    private getOrCreateRobotBelief(robotId: number) {
        let robotBelief = this.robotBeliefs.get(robotId)
        if (!robotBelief) {
            robotBelief = new RobotBelief(robotId);
            this.robotBeliefs.set(robotId, robotBelief);
        }
        return robotBelief;
    }

    private findDigs(previous: w.World, world: w.World): Vec[] {
        const result = new Array<Vec>();
        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {
                const oldCell = previous.map[y][x];
                const newCell = world.map[y][x];

                let numDigs = 0;
                if (newCell.hole && !oldCell.hole) {
                    numDigs = 1;
                    result.push(newCell.pos);
                }

                if (typeof newCell.ore === 'number' && typeof oldCell.ore === 'number' && newCell.ore < oldCell.ore) {
                    numDigs = Math.max(numDigs, oldCell.ore - newCell.ore);
                }

                for (let i = 0; i < numDigs; ++i) {
                    result.push(newCell.pos);
                }
            }
        }
        return result;
    }

    private findDiggingEnemies(previous: w.World, world: w.World): w.Entity[] {
        const result = new Array<w.Entity>();

        for (const robot of world.entities) {
            if (!(robot.type === w.ItemType.RobotTeam1 && !robot.dead)) {
                continue;
            }

            const previousRobot = previous.entities.find(r => r.id === robot.id);
            if (!previousRobot) {
                continue;
            }

            if (!(previousRobot.pos.equals(robot.pos))) {
                continue;
            }

            result.push(robot);
        }

        return result;
    }

    private assignDigsToEnemies(unexplainedDigs: Vec[], diggingEnemies: w.Entity[]): Map<number, Vec[]> {
        const result = new Map<number, Vec[]>();

        // Assign singles
        while (unexplainedDigs.length > 0) {
            let changed = false;
            for (const dig of [...unexplainedDigs]) {
                const potentialEnemies = diggingEnemies.filter(enemy => Vec.l1(enemy.pos, dig) <= w.DigRange);
                if (potentialEnemies.length === 1) {
                    changed = true;
                    const enemy = potentialEnemies[0];

                    // Explain the dig
                    {
                        const index = unexplainedDigs.findIndex(v => v === dig);
                        if (index !== -1) {
                            unexplainedDigs.splice(index, 1);
                        }
                    }

                    // Explain the enemy
                    {
                        const index = diggingEnemies.findIndex(v => v === enemy);
                        if (index !== -1) {
                            diggingEnemies.splice(index, 1);
                        }
                    }

                    // Assign
                    let assigned = result.get(enemy.id);
                    if (!assigned) {
                        assigned = [];
                        result.set(enemy.id, assigned);
                    }
                    assigned.push(dig);
                }
            }

            if (!changed) {
                break;
            }
        }

        return result;
    }
}
