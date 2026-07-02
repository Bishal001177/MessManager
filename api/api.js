/**
 * মেস হিসাব ম্যানেজার — API
 * Single entry point, same contract as the original api.php:
 *   GET  /api/api?action=...          (read-only actions)
 *   POST /api/api?action=...  {json}  (write actions)
 */
const { getPool, calculateMonth } = require('./_db');

function ok(res, data = null) {
  res.status(200).json({ ok: true, data });
}
function fail(res, msg, code = 400) {
  res.status(code).json({ ok: false, error: msg });
}

module.exports = async (req, res) => {
  const action = req.query.action || '';
  const body = req.method === 'POST' ? req.body || {} : {};
  const pool = getPool();
  const client = await pool.connect();

  try {
    switch (action) {
      // ── MONTHS ──────────────────────────────
      case 'months': {
        const r = await client.query(
          `SELECT id, label, rent::float AS rent FROM months ORDER BY id DESC`
        );
        return ok(res, r.rows);
      }

      case 'add_month': {
        const label = String(body.label || '').trim();
        const rent = Number(body.rent ?? 2000);
        if (!label) return fail(res, 'মাসের নাম দিন।');

        const exists = await client.query(`SELECT COUNT(*) FROM months WHERE label = $1`, [label]);
        if (Number(exists.rows[0].count) > 0) return fail(res, 'এই নামে মাস ইতিমধ্যে আছে।');

        await client.query('BEGIN');
        const ins = await client.query(
          `INSERT INTO months(label, rent) VALUES ($1, $2) RETURNING id`,
          [label, rent]
        );
        const monthId = ins.rows[0].id;

        const members = await client.query(`SELECT id FROM members`);
        for (const m of members.rows) {
          await client.query(
            `INSERT INTO meal_records(month_id, member_id, meals, bazar)
             VALUES ($1, $2, 0, 0) ON CONFLICT (month_id, member_id) DO NOTHING`,
            [monthId, m.id]
          );
        }
        await client.query('COMMIT');
        return ok(res, { id: monthId, label, rent });
      }

      case 'delete_month': {
        const monthId = Number(body.month_id || 0);
        if (!monthId) return fail(res, 'মাস নির্বাচন করুন।');
        await client.query(`DELETE FROM months WHERE id = $1`, [monthId]);
        return ok(res);
      }

      case 'change_rent': {
        const monthId = Number(body.month_id || 0);
        const rent = Number(body.rent ?? 0);
        if (!monthId) return fail(res, 'মাস নির্বাচন করুন।');
        if (rent < 0) return fail(res, 'সঠিক ভাড়া দিন।');
        await client.query(`UPDATE months SET rent = $1 WHERE id = $2`, [rent, monthId]);
        return ok(res);
      }

      // ── MEMBERS ─────────────────────────────
      case 'members': {
        const r = await client.query(`SELECT id, name FROM members ORDER BY name`);
        return ok(res, r.rows);
      }

      case 'add_member': {
        const name = String(body.name || '').trim();
        if (!name) return fail(res, 'নাম দিন।');

        const exists = await client.query(`SELECT COUNT(*) FROM members WHERE name = $1`, [name]);
        if (Number(exists.rows[0].count) > 0) return fail(res, 'এই নামে সদস্য আছে।');

        await client.query('BEGIN');
        const ins = await client.query(`INSERT INTO members(name) VALUES ($1) RETURNING id`, [name]);
        const memberId = ins.rows[0].id;

        const months = await client.query(`SELECT id FROM months`);
        for (const m of months.rows) {
          await client.query(
            `INSERT INTO meal_records(month_id, member_id, meals, bazar)
             VALUES ($1, $2, 0, 0) ON CONFLICT (month_id, member_id) DO NOTHING`,
            [m.id, memberId]
          );
        }
        await client.query('COMMIT');
        return ok(res, { id: memberId, name });
      }

      case 'delete_member': {
        const memberId = Number(body.member_id || 0);
        if (!memberId) return fail(res, 'সদস্য নির্বাচন করুন।');
        await client.query(`DELETE FROM members WHERE id = $1`, [memberId]);
        return ok(res);
      }

      // ── MONTH DATA (table + summary cards + extras) ──
      case 'month_data': {
        const monthId = Number(req.query.month_id || 0);
        if (!monthId) return fail(res, 'মাস নির্বাচন করুন।');

        const monthRes = await client.query(
          `SELECT label, rent::float AS rent FROM months WHERE id = $1`,
          [monthId]
        );
        if (!monthRes.rows[0]) return fail(res, 'মাস পাওয়া যায়নি।', 404);

        const { rows, totals } = await calculateMonth(client, monthId);

        const extrasRes = await client.query(
          `SELECT id, label, amount::float AS amount FROM extra_costs WHERE month_id = $1 ORDER BY id`,
          [monthId]
        );

        return ok(res, {
          month: { id: monthId, label: monthRes.rows[0].label, rent: monthRes.rows[0].rent },
          rows,
          totals,
          extras: extrasRes.rows,
        });
      }

      // ── MEAL / BAZAR RECORDS ────────────────
      case 'add_record': {
        const monthId = Number(body.month_id || 0);
        const memberId = Number(body.member_id || 0);
        const meals = Number(body.meals ?? -1);
        const bazar = body.bazar;
        if (!monthId || !memberId) return fail(res, 'মাস ও সদস্য নির্বাচন করুন।');
        if (meals < 0 || !isFinite(Number(bazar)) || Number(bazar) < 0) {
          return fail(res, 'সঠিক সংখ্যা দিন।');
        }
        await client.query(
          `INSERT INTO meal_records(month_id, member_id, meals, bazar)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (month_id, member_id)
           DO UPDATE SET meals = meal_records.meals + EXCLUDED.meals,
                         bazar = meal_records.bazar + EXCLUDED.bazar`,
          [monthId, memberId, meals, Number(bazar)]
        );
        return ok(res);
      }

      case 'edit_record': {
        const monthId = Number(body.month_id || 0);
        const memberId = Number(body.member_id || 0);
        const meals = Number(body.meals ?? -1);
        const bazar = body.bazar;
        if (!monthId || !memberId) return fail(res, 'মাস ও সদস্য নির্বাচন করুন।');
        if (meals < 0 || !isFinite(Number(bazar)) || Number(bazar) < 0) {
          return fail(res, 'সঠিক সংখ্যা দিন।');
        }
        await client.query(
          `UPDATE meal_records SET meals = $1, bazar = $2 WHERE month_id = $3 AND member_id = $4`,
          [meals, Number(bazar), monthId, memberId]
        );
        return ok(res);
      }

      case 'delete_record': {
        const monthId = Number(body.month_id || 0);
        const memberId = Number(body.member_id || 0);
        if (!monthId || !memberId) return fail(res, 'মাস ও সদস্য নির্বাচন করুন।');
        await client.query(
          `UPDATE meal_records SET meals = 0, bazar = 0 WHERE month_id = $1 AND member_id = $2`,
          [monthId, memberId]
        );
        return ok(res);
      }

      // ── EXTRA COSTS ─────────────────────────
      case 'add_extra': {
        const monthId = Number(body.month_id || 0);
        const label = String(body.label || '').trim();
        const amount = body.amount;
        if (!monthId || !label || !isFinite(Number(amount))) {
          return fail(res, 'লেবেল ও পরিমাণ সঠিক দিন।');
        }
        await client.query(
          `INSERT INTO extra_costs(month_id, label, amount) VALUES ($1, $2, $3)`,
          [monthId, label, Number(amount)]
        );
        return ok(res);
      }

      case 'delete_extra': {
        const extraId = Number(body.extra_id || 0);
        if (!extraId) return fail(res, 'খরচ নির্বাচন করুন।');
        await client.query(`DELETE FROM extra_costs WHERE id = $1`, [extraId]);
        return ok(res);
      }

      // ── PAYMENTS / STATEMENT ────────────────
      case 'toggle_payment': {
        const monthId = Number(body.month_id || 0);
        const memberId = Number(body.member_id || 0);
        const paid = body.paid ? 1 : 0;
        if (!monthId || !memberId) return fail(res, 'মাস ও সদস্য নির্বাচন করুন।');
        await client.query(
          `INSERT INTO payments(month_id, member_id, paid) VALUES ($1, $2, $3)
           ON CONFLICT (month_id, member_id) DO UPDATE SET paid = EXCLUDED.paid`,
          [monthId, memberId, paid]
        );
        return ok(res);
      }

      case 'statement': {
        const monthId = Number(req.query.month_id || 0);
        if (!monthId) return fail(res, 'মাস নির্বাচন করুন।');

        const { rows, totals } = await calculateMonth(client, monthId);

        const paidRes = await client.query(
          `SELECT member_id, paid FROM payments WHERE month_id = $1`,
          [monthId]
        );
        const paidMap = {};
        for (const p of paidRes.rows) paidMap[p.member_id] = !!p.paid;

        const rowsWithPaid = rows.map((r) => ({ ...r, paid: paidMap[r.id] ?? false }));

        return ok(res, { rows: rowsWithPaid, totals });
      }

      default:
        return fail(res, 'অজানা action.', 404);
    }
  } catch (e) {
    if (['add_month', 'add_member'].includes(action)) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    return fail(res, 'ডাটাবেস ত্রুটি: ' + e.message, 500);
  } finally {
    client.release();
  }
};
