import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { queryCityLeaderboard } from "../server/research/leaderboardQuery.js";

function fact({ slug, date, nodes }) {
  return {
    status: "ok",
    slug,
    city: "TestCity",
    eventDate: date,
    nodes,
    names: { "0xabc": "Tester" },
  };
}

function node({ id, ts, ahead = true }) {
  return {
    nodeId: id,
    nodeTs: ts,
    bracket: "35°C",
    qualified: true,
    baselinePrice: 0.4,
    repriceTs: ts + 60,
    repricePrice: 0.5,
    aheadWallets: ahead ? ["0xabc"] : [],
    prePositionedWallets: [],
    involvedWallets: ["0xabc"],
  };
}

test("per-city date filter recomputes denominator and user rates", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "pmw-lb-"));
  try {
    await fs.writeFile(
      path.join(dir, "a.json"),
      JSON.stringify(fact({ slug: "event-a", date: "2026-11-01", nodes: [node({ id: "a", ts: 1 })] })),
    );
    await fs.writeFile(
      path.join(dir, "b.json"),
      JSON.stringify(fact({ slug: "event-b", date: "2026-11-02", nodes: [node({ id: "b", ts: 2, ahead: false })] })),
    );
    const all = await queryCityLeaderboard({ city: "TestCity", eventsDir: dir });
    assert.equal(all.eventCount, 2);
    assert.equal(all.qualifiedWarmingNodes, 2);
    assert.equal(all.users.find((u) => u.wallet === "0xabc").ahead, 1);
    assert.equal(all.users.find((u) => u.wallet === "0xabc").reactionRate, 0.5);

    const day = await queryCityLeaderboard({
      city: "TestCity",
      fromDate: "2026-11-02",
      toDate: "2026-11-02",
      eventsDir: dir,
    });
    assert.equal(day.eventCount, 1);
    assert.equal(day.qualifiedWarmingNodes, 1);
    assert.equal(day.users.find((u) => u.wallet === "0xabc").ahead, 0);
    assert.equal(day.users.find((u) => u.wallet === "0xabc").reactionRate, 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
