import * as traverse from '../util/traverse'
import * as w from '../model';
import Vec from '../util/vector';
import Actor from './Actor';
import Beliefs from './Beliefs';
import BluffScheduler from './BluffScheduler';

export default class Agent {
    private beliefs: Beliefs;
    private bluffScheduler = new BluffScheduler();

    constructor(dimensions: traverse.Dimensions) {
        this.beliefs = new Beliefs(dimensions);
    }

    choose(previous: w.World, world: w.World): w.Action[] {
        this.beliefs.update(previous, world);

        const actor = Actor.create(world, this.beliefs, this.bluffScheduler);
        const actions = actor.choose();

        const robots = world.entities.filter(robot => robot.type === w.ItemType.RobotTeam0);
        return robots.map(robot => actions.get(robot.id));
    }
}
