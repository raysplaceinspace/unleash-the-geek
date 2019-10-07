import * as w from '../model';
import Vec from '../util/vector';
import Actor from './Actor';
import Beliefs from './Beliefs';

export default class Agent {
    private beliefs: Beliefs;

    constructor(width: number, height: number) {
        this.beliefs = new Beliefs(width, height);
    }

    choose(previous: w.World, world: w.World): w.Action[] {
        this.beliefs.update(previous, world);

        const actor = new Actor(world, this.beliefs);
        const actions = actor.choose();

        const robots = world.entities.filter(robot => robot.type === w.ItemType.RobotTeam0);
        return robots.map(robot => actions.get(robot.id));
    }
}
