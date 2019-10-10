import * as collections from '../util/collections';	
import * as traverse from '../util/traverse';	
import * as w from '../model';	
import { discount } from './Discount';	
import Beliefs from './Beliefs';	
import * as Params from './Params';	
import Vec from '../util/vector';	

export default class RadarMap {	
    private constructor(private payoffMap: number[][], public coverage: number) {	
    }	

    payoff(x: number, y: number) {	
        return this.payoffMap[y][x];	
    }	

    public static generate(world: w.World, beliefs: Beliefs): RadarMap {	
        const payoffs = collections.create2D(world.width, world.height, 0);	

        // Payoff equals number of potential ore uncovered	
        for (let y = 0; y < world.height; ++y) {	
            for (let x = 0; x < world.width; ++x) {	
                payoffs[y][x] = beliefs.oreProbability(x, y);	
            }	
        }	

        // If already covered, gain nothing	
        let numCellsCovered = 0;	
        const covered = collections.create2D(world.width, world.height, false);	
        world.entities.forEach(radar => {	
            if (radar.type === w.ItemType.Radar) {	
                for (const n of traverse.neighbours(radar.pos, world, w.RadarRange)) {	
                    payoffs[n.y][n.x] = 0;	

                    if (!covered[n.y][n.x]) {	
                        covered[n.y][n.x] = true;	
                        ++numCellsCovered;	
                    }	
                }	
            }	
        });	

        const numCells = world.width * world.height;	
        const coverage = numCellsCovered / numCells;	
        return new RadarMap(payoffs, coverage);	
    }	
}
