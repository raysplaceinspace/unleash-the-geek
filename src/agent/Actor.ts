import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Beliefs from './Beliefs';
import DigIntent from './DigIntent';
import ExplosionAvoider from './ExplosionAvoider';
import ExplosionMap from './ExplosionMap';
import Intent from './Intent';
import PathMap from './PathMap';
import * as Params from './Params';
import PayoffMap from './PayoffMap';
import RequestIntent from './RequestIntent';
import ReturnIntent from './ReturnIntent';
import ReturnMap from './ReturnMap';
import Vec from '../util/vector';
import WaitIntent from './WaitIntent';

export default class Actor {
    private totalVisibleOre: number = null;
    private explosionMap: ExplosionMap;
    private pathMaps = new Map<number, PathMap>();
    private payoffMap: PayoffMap;
    private returnMap: ReturnMap;

    private constructor(private world: w.World, private beliefs: Beliefs) {
    }

    public static create(world: w.World, beliefs: Beliefs) {
        return new Actor(world, beliefs);
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

    private getOrCreateReturnMap(): ReturnMap {
        if (!this.returnMap) {
            this.returnMap = ReturnMap.generate(this.world, this.beliefs);
        }
        return this.returnMap;
    }

    choose(): Map<number, w.Action> {
        // console.error(this.formatMap());

        const robots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0);

        const potentialActions = this.evaluateChoices(robots);

        let numDeduplications = 0;
        for (let attempt = 0; attempt < this.world.numRobots; ++attempt) {
            const changed = this.subsumeActions(robots, potentialActions);
            if (!changed) {
                break;
            }

            ++numDeduplications;
        }

        const result = new Map<number, w.Action>();
        const explosionAvoider = new ExplosionAvoider(this.getOrCreateExplosionMap(), this.world);
        for (const robot of robots) {
            const potentials = potentialActions.get(robot.id);
            const intent = potentials[0] || this.generateNoop(robot.id);

            const pathMap = this.getOrCreatePathMap(robot.id);
            result.set(robot.id, intent.toAction(robot, explosionAvoider, pathMap));
        }

        return result;
    }

    private formatMap() {
        const explosionMap = this.getOrCreateExplosionMap();

        let result = '';
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
                    c = trap ? '*' : 'x';
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
        const start = Date.now();
        const actions = new Array<Intent>();
        if (robot.dead) {
            actions.push(this.generateNoop(robot.id));
        } else {
            const pathMap = this.getOrCreatePathMap(robot.id);
            if (robot.carrying === w.ItemType.Ore && robot.pos.x > 0) {
                const returnMap = this.getOrCreateReturnMap();
                actions.push(ReturnIntent.generateBestReturn(robot, returnMap, pathMap));
            } else {
                if (robot.carrying === w.ItemType.None) {
                    const visibleOre = this.getOrCreateTotalVisibleOre();
                    const numRobots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0).length;

                    if (this.world.teams[0].radarCooldown === 0
                        && (robot.pos.x === 0 || visibleOre < Params.MinimumVisibleOrePerRobot * numRobots)
                        && visibleOre < Params.MaximumVisibleOre) {

                        actions.push(RequestIntent.evaluate(robot, w.ItemType.Radar, pathMap));
                    }
                    if (this.world.teams[0].trapCooldown === 0 && robot.pos.x === 0 && this.activeTrapCount() < Params.MaximumTraps) {
                        actions.push(RequestIntent.evaluate(robot, w.ItemType.Trap, pathMap));
                    }
                }

                const payoffMap = this.getOrCreatePayoffMap();
                actions.push(...DigIntent.generateDigActions(robot, this.world, payoffMap, pathMap));
            }
        }
        return actions;
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