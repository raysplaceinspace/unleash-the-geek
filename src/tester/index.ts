import * as w from '../model/world';
import * as log from '../log';
import * as simulator from '../simulator';
import { Vec } from '../util/vector';

/*
const world: w.World = {
    tick: 0,
    laps: 3,
    checkpoints: [
        {
            id: 0,
            pos: new Vec(1000, 1000),
        },
        {
            id: 1,
            pos: new Vec(2000, 2000),
        },
    ],
    pods: [
        {
            id: 0,
            teamId: 0,
            pos: new Vec(5000, 100),
            velocity: new Vec(0, 0),
            angle: 0,
            nextCheckpointId: 0,
        },
        {
            id: 0,
            teamId: 1,
            pos: new Vec(5000, 300),
            velocity: new Vec(0, 0),
            angle: 0,
            nextCheckpointId: 0,
        },
    ],
};

log.debug(`${world.pods[0].pos.x} ${world.pods[0].pos.y}`);

for (let i = 0; i < 3; ++i) {
    log.debug(`Run ${i}`);

    const next = simulator.clone(world);
    simulator.tick(next, [{
        type: "thrust",
        target: new Vec(500, 500),
        thrust: 100,
    }]);

    log.debug(`${next.pods[0].pos.x} ${next.pods[0].pos.y}`);

    simulator.tick(next, [{
        type: "thrust",
        target: new Vec(10000, 500),
        thrust: 100,
    }]);

    log.debug(`${next.pods[0].pos.x} ${next.pods[0].pos.y}`);

    log.debug(`Run ${i} complete.`);
}
*/