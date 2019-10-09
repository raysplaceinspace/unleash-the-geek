import * as w from '../model';
import Agent from '../agent';
import Vec from '../util/vector';

export function testAgent() {
    const world: w.World = w.initialWorld(30, 15);
    const agent = new Agent(world);

    const next = w.clone(world);
    next.entities.push({
        id: 0,
        type: w.ItemType.RobotTeam0,
        pos: new Vec(0, 3),
        carrying: w.ItemType.None,
    });
    next.entities.push({
        id: 1,
        type: w.ItemType.RobotTeam0,
        pos: new Vec(0, 5),
        carrying: w.ItemType.None,
    });
    next.entities.push({
        id: 2,
        type: w.ItemType.RobotTeam1,
        pos: new Vec(0, 3),
        carrying: w.ItemType.None,
    });
    next.entities.push({
        id: 3,
        type: w.ItemType.RobotTeam1,
        pos: new Vec(0, 5),
        carrying: w.ItemType.None,
    });
    world.numRobots = 2;
    const actions = agent.choose(world, next);
}