let num = 120;
let i = 0;

let printFn = () => {
    console.log(`\x1b[36mRandom value: \x1b[34m${Math.random()}`)
    if (i++ < num) {
        setTimeout(() => printFn(), 500)
    }
}
printFn();
