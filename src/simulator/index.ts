import * as w from '../model/world';
import * as angles from '../util/angles';
import { Vec } from '../util/vector';

export function tick(world: w.World, actions: w.Action[]) {
    ++world.tick;
}