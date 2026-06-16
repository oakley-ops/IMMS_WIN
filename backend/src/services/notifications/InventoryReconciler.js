const { computeAlerts } = require('./alerts');

class InventoryReconciler {
  constructor({ pool, notificationService }) {
    this.pool = pool;
    this.notificationService = notificationService;
  }

  async _loadPrevMap() {
    const { rows } = await this.pool.query(`SELECT part_id, last_status FROM part_alert_state`);
    return new Map(rows.map(r => [r.part_id, r.last_status]));
  }

  async _upsert(part_id, status) {
    await this.pool.query(
      `INSERT INTO part_alert_state (part_id, last_status) VALUES ($1, $2)
       ON CONFLICT (part_id) DO UPDATE SET last_status = $2, updated_at = NOW()`,
      [part_id, status]
    );
  }

  // seedOnly: persist current statuses without sending any notification
  async reconcile({ seedOnly = false } = {}) {
    const parts = (await this.pool.query(
      `SELECT part_id, name, quantity, minimum_quantity FROM parts WHERE status = 'active'`
    )).rows;
    const prevMap = await this._loadPrevMap();
    const { events, newStates } = computeAlerts(parts, prevMap);

    if (!seedOnly) {
      for (const { eventType, part } of events) {
        try {
          await this.notificationService.notify(eventType, part);
        } catch (e) {
          console.error('[notifications] reconcile notify failed:', e.message);
        }
      }
    }
    for (const s of newStates) {
      await this._upsert(s.part_id, s.status);
    }
  }

  async seedIfEmpty() {
    const { rows } = await this.pool.query(`SELECT COUNT(*) FROM part_alert_state`);
    if (parseInt(rows[0].count, 10) === 0) {
      console.log('[notifications] seeding part_alert_state (no alerts on first run)');
      await this.reconcile({ seedOnly: true });
    }
  }
}

module.exports = InventoryReconciler;
