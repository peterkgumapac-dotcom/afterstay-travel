type PromiseFinally = (onFinally?: (() => void) | null) => Promise<unknown>;

const promisePrototype = Promise.prototype as Promise<unknown> & {
  finally?: PromiseFinally;
};

if (typeof promisePrototype.finally !== 'function') {
  promisePrototype.finally = function promiseFinally(
    this: Promise<unknown>,
    onFinally?: (() => void) | null,
  ) {
    const runFinally = () => (typeof onFinally === 'function' ? onFinally() : undefined);
    return this.then(
      (value) => Promise.resolve(runFinally()).then(() => value),
      (reason) => Promise.resolve(runFinally()).then(() => {
        throw reason;
      }),
    );
  };
}
