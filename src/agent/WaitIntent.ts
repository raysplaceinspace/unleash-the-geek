import * as w from '../model';
import Intent from './Intent';
import PathMap from './PathMap';

export default class WaitIntent extends Intent {
    toAction(robot: w.Entity, pathMap: PathMap): w.Action {
        return {
            entityId: robot.id,
            type: "wait",
        };
    }
}