import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import Beliefs from './Beliefs';
import * as DigEvaluator from './DigEvaluator';
import ExplosionMap from './ExplosionMap';
import { Intent, RequestIntent, WaitIntent } from './Intent';
import PathMap from './PathMap';
import PayoffMap from './PayoffMap';
import * as ReturnEvaluator from './ReturnEvaluator';
import Vec from '../util/vector';

const TargetRadarCount = 3;

export default class Actor {
    private baitId: number = null;
    private explosionMap: ExplosionMap;
    private pathMaps = new Map<number, PathMap>();
    private payoffMap: PayoffMap;

    private constructor(private world: w.World, private beliefs: Beliefs) {
    }

    public static create(world: w.World, beliefs: Beliefs) {
        return new Actor(world, beliefs);
    }

     // One of the robots is allowed to walk through mines because losing this would be a 1:1 tradeoff so an even loss for both
    private getOrCreateBaitId(): number {
        if (this.baitId === null) {
            const robots = this.world.entities.filter(robot => robot.type === w.ItemType.RobotTeam0);
            const enemyRobots = this.world.entities.filter(robot => robot.type === w.ItemType.RobotTeam1);

            if (robots.length >= enemyRobots.length) {
                const bait = collections.maxBy(robots, r => {
                    let score = r.id;
                    if (r.carrying === w.ItemType.Ore) {
                        score += 100 + (this.world.width - r.pos.x); // Choose robot closest to headquarters
                    }
                    return score;
                });
                this.baitId = bait ? bait.id : -1;
            } else {
                this.baitId = -1;
            }
        }
        return this.baitId;
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

            const bait = this.getOrCreateBaitId() === robot.id;
            pathMap = PathMap.generate(robot.pos, this.world, explosionMap, bait);

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
        for (const robot of robots) {
            const potentials = potentialActions.get(robot.id);
            const intent = potentials[0] || this.generateNoop(robot.id);

            const pathMap = this.getOrCreatePathMap(robot.id);
            result.set(robot.id, intent.toAction(robot, pathMap));
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
                actions.push(ReturnEvaluator.generateBestReturn(robot, this.beliefs, pathMap));
            } else {
                if (robot.carrying === w.ItemType.None) {
                    if (this.world.teams[0].radarCooldown === 0 && (robot.pos.x === 0 || this.radarCount() < TargetRadarCount)) {
                        actions.push(RequestIntent.evaluate(robot, w.ItemType.Radar, pathMap));
                    }
                    if (this.world.teams[0].trapCooldown === 0 && robot.pos.x === 0) {
                        actions.push(RequestIntent.evaluate(robot, w.ItemType.Trap, pathMap));
                    }
                }

                const payoffMap = this.getOrCreatePayoffMap();
                actions.push(...DigEvaluator.generateDigActions(robot, this.world, payoffMap, pathMap));
            }
        }
        return actions;
    }

    private generateNoop(robotId: number): WaitIntent {
        return new WaitIntent(robotId, 0);
    }

    private radarCount(): number {
        let numRadars = 0;
        for (const entity of this.world.entities) {
            if (entity.type === w.ItemType.Radar) {
                ++numRadars;
            }
        }
        return numRadars;
    }
}