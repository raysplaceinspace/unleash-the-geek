import * as w from '../model/world';
import * as angles from '../util/angles';
import * as log from '../log';
import { Vec } from '../util/vector';

export function choose(world: w.World, teamId: number): w.Action[] {
    const robots = world.entities.filter(x => x.type === teamId);

    const actions = new Array<w.Action>();
    for (let i = 0; i < w.NumRobots; ++i) {
        actions.push({ type: "wait" });
    }

    const actionBaseIndex = w.NumRobots * teamId;
    for (const robot of robots) {
        actions[actionBaseIndex + robot.id] = chooseForRobot(world, robot);
    }

    return actions;
}

function chooseForRobot(world: w.World, robot: w.Entity): w.Action {
    if (robot.carrying === w.ItemType.Ore) {
        return {
            type: "move",
            target: new Vec(0, robot.pos.y),
        };
    } else {
        return {
            type: "dig",
            target: closestUndug(robot.pos, world),
        }
    }
}

function closestUndug(from: Vec, world: w.World) {
    let target = from;
    let closest = Infinity;
    for (let y = 0; y < world.height; ++y) {
        for (let x = 1; x < world.width; ++x) { // Start at 1 because cannot dig headquarter row
            const cell = world.map[y][x];
            if (!cell.hole) {
                const distance = Vec.distance(cell.pos, from);
                if (distance < closest) {
                    closest = distance;
                    target = cell.pos;
                }
            }
        }
    }
    return target;
}