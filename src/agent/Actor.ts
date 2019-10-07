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
        const robots = this.world.entities.filter(r => r.type === w.ItemType.RobotTeam0);

        const actions = new Map<number, w.Action>();
        for (const robot of robots) {
            const actionValues = this.evaluateRobotChoices(robot);
            const action = actionValues[0].action;
            actions.set(robot.id, action);
        }

        // TODO: Deduplicate actions
        return actions;
    }

    // Return actions, sorted best to worst
    private evaluateRobotChoices(robot: w.Entity): ActionValue[] {
        const actions = new Array<ActionValue>();
        if (robot.dead) {
            actions.push(new ActionValue(0, {
                entityId: robot.id,
                type: "wait",
            }));
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
}