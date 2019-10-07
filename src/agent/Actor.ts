import * as collections from '../util/collections';
import * as traverse from '../util/traverse';
import * as w from '../model';
import ActionValue from './ActionValue';
import Beliefs from './Beliefs';
import * as DigEvaluator from './DigEvaluator';
import ExplosionMap from './ExplosionMap';
import PathMap from './PathMap';
import * as ReturnEvaluator from './ReturnEvaluator';
import Vec from '../util/vector';

export default class Actor {
    private constructor(private world: w.World, private beliefs: Beliefs, private explosionMap: ExplosionMap) {
    }

    public static create(world: w.World, beliefs: Beliefs) {
        const explosionMap = ExplosionMap.generate(world, beliefs);
        return new Actor(world, beliefs, explosionMap);
    }

    choose(): Map<number, w.Action> {
        console.error(this.formatMap());

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
            const actionValue = potentials[0] || this.generateNoop(robot.id);
            result.set(robot.id, actionValue.action);
        }

        return result;
    }

    private formatMap() {
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
                const explosion = this.explosionMap.explodeProbability(x, y) > 0;
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

    private subsumeActions(robots: w.Entity[], potentialActions: Map<number, ActionValue[]>): boolean {
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

    private evaluateChoices(robots: w.Entity[]): Map<number, ActionValue[]> {
        const result = new Map<number, ActionValue[]>();
        for (const robot of robots) {
            const actionValues = this.evaluateRobotChoices(robot);
            result.set(robot.id, actionValues);
        }
        return result;
    }

    // Return actions, sorted best to worst
    private evaluateRobotChoices(robot: w.Entity): ActionValue[] {
        const start = Date.now();
        const actions = new Array<ActionValue>();
        if (robot.dead) {
            actions.push(this.generateNoop(robot.id));
        } else {
            const pathMap = PathMap.generate(robot.pos, this.world, this.explosionMap);
            if (robot.carrying === w.ItemType.Ore && robot.pos.x > 0) {
                actions.push(ReturnEvaluator.generateBestReturn(robot, pathMap));
            } else {
                if (robot.carrying === w.ItemType.None && robot.pos.x === 0) {
                    if (this.world.teams[0].radarCooldown === 0) {
                        actions.push(new ActionValue(1, {
                            entityId: robot.id,
                            type: "request",
                            item: w.ItemType.Radar,
                        }));
                    }
                    if (this.world.teams[0].trapCooldown === 0) {
                        actions.push(new ActionValue(1, {
                            entityId: robot.id,
                            type: "request",
                            item: w.ItemType.Trap,
                        }));
                    }
                }

                actions.push(...DigEvaluator.generateDigActions(robot, this.world, this.beliefs, pathMap));
            }
        }
        return actions;
    }

    private generateNoop(robotId: number): ActionValue {
        return new ActionValue(0, {
            entityId: robotId,
            type: "wait",
        });
    }
}