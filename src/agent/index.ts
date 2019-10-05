import * as w from '../model/world';
import * as angles from '../util/angles';
import * as log from '../log';
import * as simulator from '../simulator';
import { Vec } from '../util/vector';

export function choose(world: w.World, robotId: number): w.Action {
    return {
        type: "wait",
    };
}