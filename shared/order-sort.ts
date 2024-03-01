export const orderSort = (a, b) => {
    if (typeof a.order != 'number') return 1;
    if (typeof b.order != 'number') return -1;
    return a.order - b.order;
};
