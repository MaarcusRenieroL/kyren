import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../src/server/routers");

// Every free-text input needs an upper bound so a caller cannot send megabytes
// through a field meant for a name. Ids, emails, dates and enums are exempt.
describe("router inputs are bounded", () => {
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".ts"))) {
    it(`${file} has no unbounded strings, arrays or free-form JSON`, () => {
      const lines = readFileSync(join(dir, file), "utf8").split("\n");
      const loose = lines.filter(
        (line) =>
          !/size-capped|\.(safeP|p)arse\(/.test(line) &&
          ((/z\.string\(\)/.test(line) &&
            !/\.max\(|\.uuid\(|\.length\(|\.email\(|\.regex\(|\.datetime|\.date\(\)/.test(
              line,
            )) ||
            (/z\.array\(/.test(line) && !/\.max\(/.test(line)) ||
            /z\.(any|unknown)\(\)/.test(line)),
      );
      expect(loose.map((line) => line.trim())).toEqual([]);
    });
  }
});
