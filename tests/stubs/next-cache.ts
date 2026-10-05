/* Unit and API tests run outside Next.js: no data cache, so cached functions just run. */
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const revalidateTag = () => {};
