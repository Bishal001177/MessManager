/**
 * মেস হিসাব ম্যানেজার — DB connection + calculation engine
 * Node.js port of api/config.php + api/calc.php, for Vercel serverless.
 *
 * Uses Postgres (Vercel Postgres / Neon / Supabase all work) via the `pg`
 * package. Reads the connection string from POSTGRES_URL (set automatically
 * if you use Vercel's Postgres/Neon integration) or DATABASE_URL.
 */
const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

// Reuse the pool across warm serverless invocations.
let pool;
function getPool() {
  if (!pool) {
    if (!connectionString) {
      throw new Error(
        'ডাটাবেস কানেকশন স্ট্রিং পাওয়া যায়নি (POSTGRES_URL / DATABASE_URL)।'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 1, // safest default for serverless functions
    });
  }
  return pool;
}

/**
 * Mirrors calculate_month() from calc.php exactly:
 *  meal_rate          = total_bazar / total_meals
 *  per_person_shared  = (total_extra + rent) / num_members
 *  khaise (per member)= meals * meal_rate
 *  dibe                = max(0, khaise - bazar)
 *  pabe                = max(0, bazar - khaise)
 *  moto                = (dibe - pabe) + per_person_shared
 *  status              = 'পাবে' if moto < 0 else 'দিবে'
 */
async function calculateMonth(client, monthId) {
  const totalsRes = await client.query(
    `SELECT COALESCE(SUM(meals),0)::float AS meals, COALESCE(SUM(bazar),0)::float AS bazar
     FROM meal_records WHERE month_id = $1`,
    [monthId]
  );
  const totalMeals = totalsRes.rows[0].meals;
  const totalBazar = totalsRes.rows[0].bazar;
  const mealRate = totalMeals ? totalBazar / totalMeals : 0;

  const extraRes = await client.query(
    `SELECT COALESCE(SUM(amount),0)::float AS e FROM extra_costs WHERE month_id = $1`,
    [monthId]
  );
  const totalExtra = extraRes.rows[0].e;

  const rentRes = await client.query(`SELECT rent::float FROM months WHERE id = $1`, [monthId]);
  const rent = rentRes.rows[0]?.rent || 0;

  const memberRes = await client.query(
    `SELECT m.id, m.name, mr.meals, mr.bazar::float AS bazar
     FROM members m
     JOIN meal_records mr ON mr.member_id = m.id
     WHERE mr.month_id = $1
     ORDER BY m.name`,
    [monthId]
  );

  const numMembers = memberRes.rows.length;
  const grandTotalCost = totalExtra + rent;
  const perPersonShared = numMembers ? grandTotalCost / numMembers : 0;

  const rows = memberRes.rows.map((r) => {
    const meals = r.meals;
    const bazar = r.bazar;
    const khaise = meals * mealRate;
    const dibe = Math.max(0, khaise - bazar);
    const pabe = Math.max(0, bazar - khaise);
    const moto = dibe - pabe + perPersonShared;
    const status = moto < 0 ? 'পাবে' : 'দিবে';
    return { id: r.id, name: r.name, meals, bazar, khaise, dibe, pabe, moto, status };
  });

  const sum = (key) => rows.reduce((acc, r) => acc + r[key], 0);

  const totals = {
    meals: totalMeals,
    bazar: totalBazar,
    khaise: sum('khaise'),
    dibe: sum('dibe'),
    pabe: sum('pabe'),
    moto: sum('moto'),
    total_extra: totalExtra,
    rent,
    meal_rate: mealRate,
    per_person_shared: perPersonShared,
    num_members: numMembers,
  };

  return { rows, totals };
}

module.exports = { getPool, calculateMonth };
