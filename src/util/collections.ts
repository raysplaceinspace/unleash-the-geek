export function some<K, V>(collection: Iterable<V>, predicate: (value: V) => boolean) {
    for (const value of collection) {
        if (predicate(value)) {
            return true;
        }
    }
    return false;
}
