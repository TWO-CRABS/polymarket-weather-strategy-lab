/**
 * server/store.js — persistence.
 *
 * `data/store.json`     strategies + run index (atomic write via tmp+rename)
 * `data/runs/<id>.jsonl` append-only run journal (signal/trade/equity/run lines)
 *
 * The store tolerates a missing/corrupt data directory, writes serially and
 * recovers in-progress runs as `stopped` on boot (per architecture doc §8).
 */
import fs from "node:fs/promises";
import path from "node:path";

const STORE_VERSION = 1;

export class Store {
  /** @param {{dataDir: string, storeFile: string, runsDir: string, log?: (level:string,msg:string)=>void}} cfg */
  constructor(cfg) {
    this.dataDir = cfg.dataDir;
    this.storeFile = cfg.storeFile;
    this.runsDir = cfg.runsDir;
    this.log = cfg.log ?? (() => {});
    /** @type {{version:number, strategies:Record<string,any>, runs:Record<string,any>}} */
    this.state = { version: STORE_VERSION, strategies: {}, runs: {} };
    this._writeChain = Promise.resolve();
    this._saveTimer = null;
    this._saveQueued = false;
  }

  async init() {
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.mkdir(this.runsDir, { recursive: true });
    await this._load();
    await this._recover();
    return this;
  }

  /* ------------------------------ strategies ----------------------------- */

  /** @returns {Array<{id:string,name:string,description:string,updatedAt:number,config:object}>} */
  listStrategies() {
    return Object.values(this.state.strategies)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
      .map((entry) => ({ ...entry }));
  }

  getStrategy(id) {
    const entry = this.state.strategies[id];
    return entry ? { ...entry } : null;
  }

  async upsertStrategy(entry) {
    this.state.strategies[entry.id] = entry;
    await this.saveNow();
    return { ...entry };
  }

  async deleteStrategy(id) {
    if (!this.state.strategies[id]) return false;
    delete this.state.strategies[id];
    await this.saveNow();
    return true;
  }

  /* -------------------------------- runs --------------------------------- */

  listRunRecords() {
    return Object.values(this.state.runs).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }

  getRunRecord(id) {
    return this.state.runs[id] ? { ...this.state.runs[id] } : null;
  }

  /** Persist a run summary/index record (throttled by caller). */
  async upsertRunRecord(record) {
    this.state.runs[record.id] = record;
    await this.scheduleSave();
    return record;
  }

  async deleteRunRecord(id) {
    delete this.state.runs[id];
    await this.scheduleSave();
    try {
      await fs.rm(this._runFile(id), { force: true });
    } catch {
      /* ignore */
    }
  }

  /* ------------------------------- journal ------------------------------- */

  _runFile(runId) {
    return path.join(this.runsDir, `${runId}.jsonl`);
  }

  /**
   * Append one journal line (`{type, ts, data}`).
   * Serialized so ordering is preserved even under concurrent ticks.
   * @param {string} runId
   * @param {string} type signal|trade|equity|run|log
   * @param {any} data
   */
  appendRecord(runId, type, data) {
    const line = JSON.stringify({ type, ts: Date.now(), data }) + "\n";
    const file = this._runFile(runId);
    const task = this._writeChain.then(() => fs.appendFile(file, line, "utf8"));
    this._writeChain = task.catch((err) => {
      this.log("warn", `store append failed for ${runId}: ${err.message}`);
    });
    return task.catch(() => undefined);
  }

  /**
   * Read journal records for a run.
   * @param {string} runId
   * @param {{type?: string, limit?: number, offset?: number}} [opts]
   * @returns {Promise<{items:any[], total:number}>}
   */
  async readRecords(runId, opts = {}) {
    const { type, limit = 500, offset = 0 } = opts;
    let text = "";
    try {
      text = await fs.readFile(this._runFile(runId), "utf8");
    } catch {
      return { items: [], total: 0 };
    }
    const items = [];
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const rec = JSON.parse(line);
        if (!type || rec.type === type) items.push(rec.data);
      } catch {
        /* skip corrupt line */
      }
    }
    return { items: items.slice(offset, offset + limit), total: items.length };
  }

  /** Synchronously read the raw journal for one run (used by recovery). */
  async readAllRecords(runId) {
    return this.readRecords(runId, { limit: Number.MAX_SAFE_INTEGER, offset: 0 });
  }

  /* ------------------------------ lifecycle ------------------------------ */

  /** Atomic write of the whole store.json, coalescing bursts into one write. */
  scheduleSave() {
    if (this._saveTimer) {
      this._saveQueued = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this._saveTimer = setTimeout(async () => {
        this._saveTimer = null;
        const runAgain = this._saveQueued;
        this._saveQueued = false;
        try {
          await this._flush();
        } finally {
          resolve();
        }
        if (runAgain) {
          this._saveTimer = setTimeout(() => {
            this._saveTimer = null;
            this._flush().catch(() => {});
          }, 25);
        }
      }, 50);
      if (typeof this._saveTimer.unref === "function") this._saveTimer.unref();
    });
  }

  /** Write immediately (used on shutdown / strategy mutations). */
  async saveNow() {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    return this._flush();
  }

  async _flush() {
    const payload = JSON.stringify(this.state);
    const task = this._writeChain.then(async () => {
      const tmp = `${this.storeFile}.${process.pid}.tmp`;
      await fs.writeFile(tmp, payload, "utf8");
      await fs.rename(tmp, this.storeFile);
    });
    this._writeChain = task.catch((err) => {
      this.log("warn", `store save failed: ${err.message}`);
    });
    return this._writeChain;
  }

  /** Wait for all queued disk writes (shutdown). */
  async flush() {
    await this.saveNow();
    await this._writeChain;
  }

  /* ------------------------------- internal ------------------------------ */

  async _load() {
    try {
      const text = await fs.readFile(this.storeFile, "utf8");
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object") {
        this.state = {
          version: parsed.version ?? STORE_VERSION,
          strategies: parsed.strategies && typeof parsed.strategies === "object" ? parsed.strategies : {},
          runs: parsed.runs && typeof parsed.runs === "object" ? parsed.runs : {},
        };
      }
    } catch (err) {
      if (err.code !== "ENOENT") this.log("warn", `store.json unreadable, starting fresh: ${err.message}`);
    }
  }

  /**
   * Any run that was starting/running/paused/stopping when the process died is
   * marked `stopped` so the UI never shows a zombie run. Historical journal
   * data stays available through the REST endpoints.
   */
  async _recover() {
    const terminal = new Set(["stopped", "ended", "error"]);
    let changed = false;
    for (const record of Object.values(this.state.runs)) {
      if (!terminal.has(record.status)) {
        record.status = "stopped";
        record.endedAt = record.endedAt ?? Date.now();
        record.note = "server restarted; run marked stopped";
        changed = true;
      }
    }
    if (changed) await this.saveNow();
  }
}

export default Store;
