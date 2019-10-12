import * as collections from '../util/collections';	
import * as traverse from '../util/traverse';	
import * as w from '../model';	
import { discount } from './Discount';	
import Beliefs from './Beliefs';	
import * as Params from './Params';	
import Vec from '../util/vector';	

export default class SquirrelMap {	
    private constructor(public locations: Vec[]) {	
    }

    public static generate(world: w.World, beliefs: Beliefs): SquirrelMap {	
        const locations = new Array<Vec>();

        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {	
                if (beliefs.appearsTrapped(x, y) && beliefs.oreProbability(x, y) <= 0) {
                    locations.push(new Vec(x, y));
                }
            }	
        }

        return new SquirrelMap(locations);	
    }
}
