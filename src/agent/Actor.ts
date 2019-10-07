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
    private explosionMap: ExplosionMap;

    constructor(private world: w.World, private beliefs: Beliefs) {
        this.explosionMap = ExplosionMap.generate(world, beliefs);
    }

    choose(): Map<number, w.Action> {
        console.error(this.explosionMap.format());

        const robots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0);

        const potentialActions = this.evaluateChoices(robots);

        for (let attempt = 0; attempt < this.world.numRobots; ++attempt) {
            const changed = this.subsumeActions(robots, potentialActions);
            if (!changed) {
                break;
            }
        }

        const result = new Map<number, w.Action>();
        for (const robot of robots) {
            const potentials = potentialActions.get(robot.id);
            const actionValue = potentials[0] || this.generateNoop(robot.id);
            result.set(robot.id, actionValue.action);
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