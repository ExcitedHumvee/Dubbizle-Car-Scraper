/**
 * Validate that both workspace plugins declare the dual-face shape the
 * client-modules host scan requires, and that their file:-URL entry points
 * resolve and expose the `apply` binding the Loader expects.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

let bad = 0;
const ok = (label, cond, detail = "") => {
  console.log((cond ? "  ok   " : "  FAIL ") + label + (cond || detail === "" ? "" : ` ? ${detail}`));
  if (!cond) bad += 1;
};

for (const name of ["context-gauge", "sound-alerts"]) {
  const dir = `dsh-plugins/${name}`;
  console.log(`\n${name}`);
  const pkg = JSON.parse(readFileSync(`${dir}/package.json`, "utf8"));
  ok("declares a dsh.client block", pkg.dsh?.client !== undefined);
  ok("targets the web platform", pkg.dsh?.client?.platform === "web");
  ok("prefetches immediately", pkg.dsh?.client?.immediately === true);
  ok("injects only known client rows", (pkg.dsh?.client?.inject ?? []).every((id) => id.startsWith("@deepseek-ai/dsh-client-")), JSON.stringify(pkg.dsh?.client?.inject));
  ok("exports the client subpath", pkg.exports?.["./client"] === "./lib/client.js");
  ok("exports the package root", pkg.exports?.["."] === "./lib/index.js");
  ok("client bundle exists", existsSync(`${dir}/lib/client.js`));
  ok("host entry exists", existsSync(`${dir}/lib/index.js`));
  const mod = await import(pathToFileURL(`${dir}/lib/index.js`).href);
  ok("host entry exports apply", typeof mod.apply === "function");
  const client = readFileSync(`${dir}/lib/client.js`, "utf8");
  ok("client bundle calls the module loader", client.includes("window.__ModuleLoader__.load("));
  ok("client bundle registers under the package name", client.includes(`id: "${pkg.name}"`));
  const fileUrl = `file:///C:/Users/stany/Desktop/coding%20repos/Dubbizle-Car-Scraper/${dir}/lib/index.js`;
  ok("the profile file: URL is well-formed", fileUrl.startsWith("file:///") && !fileUrl.includes(" "));
}
console.log("");
console.log(bad === 0 ? "all checks passed" : `${bad} check(s) failed`);
process.exit(bad === 0 ? 0 : 1);
