/* eslint-disable @typescript-eslint/no-explicit-any */
export const hrefOf = (fn: any): string => (fn && fn.href) || "#";
