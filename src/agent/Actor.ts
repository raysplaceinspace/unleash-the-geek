import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Beliefs from './Beliefs';
import BluffIntent from './BluffIntent';
import BluffScheduler from './BluffScheduler';
import DigIntent from './DigIntent';
import ExplosionAvoider from './ExplosionAvoider';
import ExplosionMap from './ExplosionMap';
import Intent from './Intent';
import PathMap from './PathMap';
import * as Params from './Params';
import PayoffMap from './PayoffMap';
import RadarMap from './RadarMap';
import RequestIntent from './RequestIntent';
import ReturnIntent from './ReturnIntent';
import ReturnMap from './ReturnMap';
import SquirrelMap from './SquirrelMap';
import Vec from '../util/vector';
import WaitIntent from './WaitIntent';
import SquirrelIntent from './SquirrelIntent';

export default class Actor {
    private totalVisibleOre: number = null;
    private explosionMap: ExplosionMap;
    private pathMaps = new Map<number, PathMap>();
    private payoffMap: PayoffMap;
    private radarMap: RadarMap;
    private returnMap: ReturnMap;
    private squirrelMap: SquirrelMap;

    private constructor(private world: w.World, private beliefs: Beliefs, private bluffScheduler: BluffScheduler) {
    }

    public static create(world: w.World, beliefs: Beliefs, bluffScheduler: BluffScheduler) {
        return new Actor(world, beliefs, bluffScheduler);
    }


    private getOrCreateTotalVisibleOre(): number {
        if (this.totalVisibleOre === null) {
            this.totalVisibleOre = collections.sum(traverse.all(this.world), n => {
                if (this.beliefs.trapProbability(n.x, n.y) <= 0) {
                    return this.world.map[n.y][n.x].ore ? 1 : 0;
                } else {
                    return 0;
                }
            });
        }
        return this.totalVisibleOre;
    }

    private getOrCreateExplosionMap(): ExplosionMap {
        if (!this.explosionMap) {
            this.explosionMap = ExplosionMap.generate(this.world, this.beliefs);
        }
        return this.explosionMap;
    }

    private getOrCreatePathMap(robotId: number): PathMap {
        let pathMap = this.pathMaps.get(robotId);
        if (!pathMap) {
            const robot = this.world.entities.find(x => x.id === robotId);
            const explosionMap = this.getOrCreateExplosionMap();

            pathMap = PathMap.generate(robot.pos, this.world, explosionMap);

            this.pathMaps.set(robotId, pathMap);
        }
        return pathMap;
    }

    private getOrCreatePayoffMap(): PayoffMap {
        if (!this.payoffMap) {
            this.payoffMap = PayoffMap.generate(this.world, this.beliefs);
        }
        return this.payoffMap;
    }

    private getOrCreateRadarMap(): RadarMap {
        if (!this.radarMap) {
            this.radarMap = RadarMap.generate(this.world, this.beliefs);
        }
        return this.radarMap;
    }

    private getOrCreateReturnMap(): ReturnMap {
        if (!this.returnMap) {
            const squirrelMap = this.getOrCreateSquirrelMap();
            this.returnMap = ReturnMap.generate(this.world, this.beliefs, squirrelMap);
        }
        return this.returnMap;
    }

    private getOrCreateSquirrelMap(): SquirrelMap {
        if (!this.squirrelMap) {
            this.squirrelMap = SquirrelMap.generate(this.world, this.beliefs);
        }
        return this.squirrelMap;
    }

    choose(): Map<number, w.Action> {
        const robots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0);

        const potentialActions = this.evaluateChoices(robots);

        this.coordinateDigs(potentialActions);

        for (let attempt = 0; attempt < this.world.numRobots; ++attempt) {
            const changed = this.subsumeActions(robots, potentialActions);
            if (!changed) {
                break;
            }
        }

        const result = new Map<number, w.Action>();
        const explosionAvoider = new ExplosionAvoider(this.getOrCreateExplosionMap(), this.world);
        for (const robot of robots) {
            const potentials = potentialActions.get(robot.id);
            const intent = potentials[0] || this.generateNoop(robot.id);

            const pathMap = this.getOrCreatePathMap(robot.id);
            result.set(robot.id, intent.toAction(robot, explosionAvoider, pathMap));

            // Bluff was chosen
            if (intent instanceof BluffIntent) {
                this.bluffScheduler.bluff(this.world.tick);
            }
        }

        // console.error(this.formatMap(explosionAvoider));

        return result;
    }

    private formatMap(explosionAvoider: ExplosionAvoider) {
        const explosionMap = this.getOrCreateExplosionMap();

        let result = ' ';
        for (let x = 0; x < this.world.width; ++x) {
            result += `${(x % 10)}`;
        }
        result += "\n";

        for (let y = 0; y < this.world.height; ++y) {
            let line = `${(y % 10)}`;
            for (let x = 0; x < this.world.width; ++x) {
                let c = '.';

                const cell = this.world.map[y][x];
                const trap = this.beliefs.trapProbability(x, y) > 0;
                const explosion = explosionMap.explodeProbability(x, y) > 0;
                const enemy = this.world.entities.some(v => v.type === w.ItemType.RobotTeam1 && v.pos.equals(cell.pos));
                if (explosion) {
                    if (trap) {
                        const assignedRobotIds = explosionAvoider.assignedRobots(cell.pos);
                        const assignedRobotId = assignedRobotIds && assignedRobotIds.length > 0 ? assignedRobotIds[0] : null;
                        c = typeof assignedRobotId === 'number' ? `${assignedRobotId}` : '*';
                    } else {
                        c = 'x';
                    }
                } else if (trap) {
                    c = 't';
                } else if (enemy) {
                    c = 'e';
                }

                line += c;
            }
            result += line + "\n";
        }
        return result;

    }

    private coordinateDigs(potentialActions: Map<number, Intent[]>) {
        let numCoordinations = 0;
        while (true) {
            const actions = collections.map(potentialActions.values(), x => x ? x[0] : undefined);
            const digActions = collections.filter(actions, x => x && x instanceof DigIntent) as DigIntent[];

            const duplicateDigs = this.findDuplicateDigs(digActions);
            if (duplicateDigs.length > 0) {
                numCoordinations += duplicateDigs.length;
                this.removeFromPotentialActions(potentialActions, duplicateDigs);
                continue;
            }
            
            const duplicateDestinations = this.findDuplicateDestinations(digActions);
            if (duplicateDestinations.length > 0) {
                numCoordinations += duplicateDestinations.length;
                this.removeFromPotentialActions(potentialActions, duplicateDestinations);
                continue;
            }

            break;
        }

        console.error(`Coordinated ${numCoordinations} digs`);
    }

    private findDuplicateDigs(digActions: DigIntent[]) {
        const squirrelling = this.world.tick < this.getOrCreateSquirrelMap().unsquirrelTick;

        const toRemove = new Array<Intent>();

        const digsPerTarget = collections.groupBy(digActions, x => x.target.hash());
        for (const digs of digsPerTarget.values()) {
            if (digs.length > 1) {
                const target = digs[0].target;
                const cell = this.world.map[target.y][target.x];

                let limit = typeof cell.ore === 'number' ? cell.ore : 1;
                if (squirrelling && digs.some(d => this.beliefs.carryingProbability(d.robotId) > 0)) {
                    // If someone is going to seal the cell, just let one robot do it
                    limit = 1;
                }

                if (digs.length > limit) {
                    digs.sort(Intent.maximumValue);
                    toRemove.push(...digs.slice(limit));
                }
            }
        }

        return toRemove;
    }

    private findDuplicateDestinations(digActions: DigIntent[]) {
        const explosionMap = this.getOrCreateExplosionMap();

        const toRemove = new Array<Intent>();

        const digsPerDestination = collections.groupBy(digActions, x => x.destination.hash());
        for (const digs of digsPerDestination.values()) {
            const destination = digs[0].destination;
            if (digs.length > 1 && explosionMap.explodeProbability(destination.x, destination.y) > 0) {
                const limit = 1;
                if (digs.length > limit) {
                    digs.sort(Intent.maximumValue);
                    toRemove.push(...digs.slice(limit));
                }
            }
        }

        return toRemove;
    }

    private removeFromPotentialActions(potentialActions: Map<number, Intent[]>, toSubsume: Intent[]) {
        for (const action of toSubsume) {
            const robotActions = potentialActions.get(action.robotId);
            const index = robotActions.findIndex(x => x === action);
            if (index !== -1) {
                robotActions.splice(index, 1);
            }
        }
    }

    private subsumeActions(robots: w.Entity[], potentialActions: Map<number, Intent[]>): boolean {
        let changed = false;
        for (const robot1 of robots) {
            const potentials1 = potentialActions.get(robot1.id);
            const action1 = potentials1[0];
            for (const robot2 of robots) {
                const potentials2 = potentialActions.get(robot2.id);
                const action2 = potentials2[0];

                if (action1 && action2 && action1.subsumes(action2)) {
                    potentials2.shift(); // Give the action to robot 1, give robot 2 something else to do
                    changed = true;
                }
            }
        }
        return changed;
    }

    private evaluateChoices(robots: w.Entity[]): Map<number, Intent[]> {
        const result = new Map<number, Intent[]>();
        for (const robot of robots) {
            const intents = this.evaluateRobotChoices(robot);
            result.set(robot.id, intents);
        }
        return result;
    }

    // Return actions, sorted best to worst
    private evaluateRobotChoices(robot: w.Entity): Intent[] {
        const actions = new Array<Intent>();
        if (robot.dead) {
            actions.push(this.generateNoop(robot.id));
        } else {
            if (robot.carrying === w.ItemType.Ore && robot.pos.x > 0) {
                this.evaluateReturn(robot, actions);
            } else {
                this.evaluatePickup(robot, actions);
                this.evaluateDig(robot, actions);
            }
        }
        return actions;
    }

    private evaluateReturn(robot: w.Entity, actions: Intent[]) {
        const avoid = Params.AlwaysAvoidOnReturn; // this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0 && r.dead).length > 0; // After 1 robot killed, always avoid on returning

        const pathMap = this.getOrCreatePathMap(robot.id);
        const returnMap = this.getOrCreateReturnMap();
        const squirrelMap = this.getOrCreateSquirrelMap();

        actions.push(...SquirrelIntent.generate(robot, avoid, squirrelMap, pathMap, this.world));
        actions.push(ReturnIntent.generateBestReturn(robot, avoid, returnMap, pathMap));
    }
    
    private evaluatePickup(robot: w.Entity, actions: Intent[]) {
        if (robot.carrying !== w.ItemType.None) {
            return;
        }

        const pathMap = this.getOrCreatePathMap(robot.id);
        const radarMap = this.getOrCreateRadarMap();
        const squirrelMap = this.getOrCreateSquirrelMap();

        const explosionMap = this.getOrCreateExplosionMap();

        const visibleOre = this.getOrCreateTotalVisibleOre();
        const numRobots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0).length;

        if (this.world.teams[0].radarCooldown === 0
            && (robot.pos.x === 0 || visibleOre < Params.MinimumVisibleOrePerRobot * numRobots)
            && visibleOre < Params.MaximumVisibleOre
            && radarMap.coverage < Params.MaximumRadarCoverage) {

            actions.push(RequestIntent.evaluate(robot, w.ItemType.Radar, radarMap, pathMap, explosionMap));
        }
        if (this.world.teams[0].trapCooldown === 0 && robot.pos.x === 0 && this.activeTrapCount() < Params.MaximumTraps) {
            actions.push(RequestIntent.evaluate(robot, w.ItemType.Trap, radarMap, pathMap, explosionMap));
        }
        if (robot.pos.x === 0 && this.beliefs.carryingProbability(robot.id) <= 0 && this.bluffScheduler.bluffReady(this.world.tick) && this.world.tick < squirrelMap.unsquirrelTick) {
            actions.push(...BluffIntent.generate(robot, pathMap, explosionMap, squirrelMap));
        }
    }

    private evaluateDig(robot: w.Entity, actions: Intent[]) {
        const pathMap = this.getOrCreatePathMap(robot.id);
        const payoffMap = this.getOrCreatePayoffMap();
        const radarMap = this.getOrCreateRadarMap();
        const squirrelMap = this.getOrCreateSquirrelMap();
        actions.push(...DigIntent.generateDigActions(robot, this.world, payoffMap, pathMap, radarMap, squirrelMap, this.beliefs));

    }

    private generateNoop(robotId: number): WaitIntent {
        return new WaitIntent(robotId, 0);
    }

    private activeTrapCount(): number {
        let numTraps = 0;
        for (const entity of this.world.entities) {
            if (entity.type === w.ItemType.Trap && this.beliefs.oreProbability(entity.pos.x, entity.pos.y) >= 1) {
                ++numTraps;
            }
        }
        return numTraps;
    }
}