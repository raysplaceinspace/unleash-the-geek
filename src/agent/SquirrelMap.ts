import * as collections from '../util/collections';	
import * as traverse from '../util/traverse';	
import * as w from '../model';	
import { discount } from './Discount';	
import Beliefs from './Beliefs';	
import * as Params from './Params';	
import Vec from '../util/vector';	

export default class SquirrelMap {
    private locationLookup: Set<number>;

    private constructor(public locations: Vec[], public unsquirrelTick: number, public numSquirrelableLocations: number) {	
        this.locationLookup = new Set(locations.map(x => x.hash()));
    }

    isSquirrel(location: Vec) {
        return this.locationLookup.has(location.hash());
    }

    public static generate(world: w.World, beliefs: Beliefs): SquirrelMap {	
        const locations = new Array<Vec>();

        let squirrelledOre = 0;
        let numSquirrelableLocations = 0;
        let ticksToUnsquirrel = 0;
        for (let y = 0; y < world.height; ++y) {
            for (let x = 0; x < world.width; ++x) {	
                const cell = world.map[y][x];
                const visible = typeof cell.ore === 'number';
                if (beliefs.appearsTrapped(x, y)) {
                    if (visible) {
                        locations.push(new Vec(x, y));
                        squirrelledOre += cell.ore;
                        ticksToUnsquirrel += cell.ore * (1 + 2 * Math.ceil(cell.pos.x / w.MovementSpeed));
                    }
                } else {
                    if (visible && cell.ore > 1 && beliefs.trapProbability(x, y) <= 0) {
                        // No point squirrelling unless there is more than one ore at the cell
                        ++numSquirrelableLocations;
                    }
                }
            }	
        }

        const numRobots = world.entities.filter(r => r.type === w.ItemType.RobotTeam0 && !r.dead).length;
        const unsquirrelTick = Math.min(Params.MaxUnsquirrelTick, w.MaxTicks - Math.ceil(Params.UnsquirrelTicksMultiplier * ticksToUnsquirrel / Math.max(1, numRobots)));
        console.error(`Squirrel: until ${unsquirrelTick}, ore ${squirrelledOre}`);
        return new SquirrelMap(locations, unsquirrelTick, numSquirrelableLocations);	
    }
}
