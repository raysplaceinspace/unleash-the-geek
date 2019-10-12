export const DiscountRate = 0.9;

export const ExplosionCost = 100;

export const OreStartX = 4;
export const OreBeforeStartXPriorBelief = -1;
export const OreMargin = 1;
export const OreMarginPriorBelief = -1;

export const MinimumVisibleOrePerRobot = 1;
export const MaximumVisibleOre = 100;
export const MaximumTraps = 0;

export const BluffInterval = 5;

export const MaximumRadarCoverage = 0.9;
export const RadarPlacementWeight = 10;

export const TrapPlacementWeight = 1;
export const TrapPlacementRange = 5;

export const OreNeighbourRange = 2; // When successfully dug ore at a cell, increase probability of ore in neighbouring cells within this range

export const OrePayoffPower = 8; // Convert ore probability into a payoff using this power

export const ReturnNextOreWeight = 1; // When returning, how much weight to put on the distance to the next dig after returning