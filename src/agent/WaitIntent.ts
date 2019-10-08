import * as w from '../model';
import ExplosionAvoider from './ExplosionAvoider';
import Intent from './Intent';
import PathMap from './PathMap';

export default class WaitIntent extends Intent {
    toAction(robot: w.Entity, explosionAvoider: ExplosionAvoider, pathMap: PathMap): w.Action {
        return {
            entityId: robot.id,
            type: "wait",
        };
    }
}