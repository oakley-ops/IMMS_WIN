// backend/src/scripts/seedDemo.js
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const now = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function truncateDemoTables(client) {
  await client.query(`
    TRUNCATE TABLE
      demo_sent_emails,
      die_sharpening_records,
      die_change_history,
      die_documents,
      die_maintenance_schedule,
      transactions,
      purchase_order_items,
      purchase_orders,
      work_orders,
      part_assignments,
      contacts,
      projects,
      technicians,
      suppliers,
      parts,
      dies,
      machines,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function seedUsers(client) {
  const hash = await bcrypt.hash('demo-password-unused', 10);
  await client.query(`
    INSERT INTO users (username, password_hash, role) VALUES
      ('demo-admin',     $1, 'admin'),
      ('demo-purchaser', $1, 'purchasing'),
      ('demo-viewer',    $1, 'tech')
  `, [hash]);
}

async function seedSuppliers(client) {
  await client.query(`
    INSERT INTO suppliers (name, contact_name, email, phone, address) VALUES
      ('Apex Hydraulics Inc.',   'Tom Reyes',    'orders@apex-hydraulics.demo.invalid',  '555-0101', '100 Industrial Blvd, Detroit MI 48201'),
      ('MidWest Bearings Co.',   'Lisa Chen',    'supply@mwbearings.demo.invalid',       '555-0102', '500 Commerce Dr, Cleveland OH 44101'),
      ('FilterPro Supply',       'Mark Okafor',  'po@filterpro.demo.invalid',            '555-0103', '220 Filter Way, Chicago IL 60601'),
      ('National Belt & Drive',  'Sara Patel',   'orders@nationalbelt.demo.invalid',     '555-0104', '88 Drive St, Columbus OH 43201')
  `);
}

async function seedTechnicians(client) {
  await client.query(`
    INSERT INTO technicians (name, email, phone, specialization) VALUES
      ('J. Martinez',   'j.martinez@demo.invalid',   '555-1001', 'Hydraulics'),
      ('A. Thompson',   'a.thompson@demo.invalid',   '555-1002', 'Electrical'),
      ('D. Williams',   'd.williams@demo.invalid',   '555-1003', 'Mechanical'),
      ('R. Nguyen',     'r.nguyen@demo.invalid',     '555-1004', 'General Maintenance')
  `);
}

async function seedContacts(client) {
  await client.query(`
    INSERT INTO contacts (name, company, type, email, phone) VALUES
      ('Tom Reyes',   'Apex Hydraulics Inc.',   'supplier',   'tom.reyes@apex-hydraulics.demo.invalid',   '555-0101'),
      ('Lisa Chen',   'MidWest Bearings Co.',   'supplier',   'lisa.chen@mwbearings.demo.invalid',         '555-0102'),
      ('Bob Keller',  'Keller Manufacturing',   'vendor',     'bkeller@kellermfg.demo.invalid',            '555-2001'),
      ('Dana Park',   'Facilities Dept',        'contractor', 'dpark@facilities.demo.invalid',             '555-2002')
  `);
}

async function seedParts(client) {
  const parts = [
    ['HYD-SEAL-04',  'Hydraulic Cylinder Seal Kit 4"',      3,  10, 28.50,  1],
    ['FILT-OIL-12',  'Oil Filter 12-Micron',                1,   6,  9.75,  3],
    ['BLT-VBELT-B52','V-Belt B52',                          2,   5, 14.20,  4],
    ['PMP-IMP-3IN',  'Pump Impeller 3"',                    0,   2, 142.00, 1],
    ['SEAL-ORNG-112','O-Ring Seal 1-1/2"',                  4,  20,  1.85,  1],
    ['LUB-GREASE-EP2','EP2 Grease Cartridge',               3,  12,  6.40,  1],
    ['FUSE-30A',     '30A Slow-Blow Fuse',                  5,  10,  2.10,  2],
    ['PROX-NPN-M12', 'NPN Proximity Switch M12',            1,   3, 32.00,  2],
    ['CTRL-RELAY-24V','24V Control Relay',                  2,   5, 18.75,  2],
    ['BRG-6205-2RS', 'Ball Bearing 6205-2RS',              24,   5, 12.40,  2],
    ['BRG-6305-2RS', 'Ball Bearing 6305-2RS',              18,   5, 15.20,  2],
    ['BRG-6004-ZZ',  'Ball Bearing 6004-ZZ',               30,   8, 10.80,  2],
    ['MTR-BELT-08',  'Motor Drive Belt 8-Groove',          12,   4, 22.50,  4],
    ['MTR-BELT-06',  'Motor Drive Belt 6-Groove',           9,   3, 18.90,  4],
    ['FILT-AIR-25',  'Air Filter 25-Micron',               16,   6,  7.30,  3],
    ['FILT-HYD-10',  'Hydraulic Filter 10-Micron',         14,   4, 11.60,  3],
    ['HYD-SEAL-02',  'Hydraulic Cylinder Seal Kit 2"',     22,   6, 19.75,  1],
    ['HYD-HOSE-38',  'Hydraulic Hose 3/8" x 36"',         11,   3, 31.20,  1],
    ['HYD-FIT-90-38','Hydraulic 90° Fitting 3/8"',         35,  10,  6.80,  1],
    ['HYD-FIT-STR-38','Hydraulic Straight Fitting 3/8"',   40,  10,  4.90,  1],
    ['LUB-OIL-ISO46','Hydraulic Oil ISO 46 (1 gal)',        8,   3, 24.00,  1],
    ['LUB-OIL-ISO68','Hydraulic Oil ISO 68 (1 gal)',        6,   3, 26.50,  1],
    ['ELC-CONTACTOR-32A','Contactor 32A 24VDC Coil',       7,   2, 44.00,  2],
    ['ELC-OVERLOAD-25A','Overload Relay 18-25A',            5,   2, 38.50,  2],
    ['ELC-BREAKER-20A','Circuit Breaker 20A',              10,   3, 21.40,  2],
    ['ELC-BREAKER-10A','Circuit Breaker 10A',              12,   3, 17.80,  2],
    ['SEN-TEMP-PT100','PT100 Temperature Sensor',           6,   2, 55.00,  2],
    ['SEN-PRESS-100PSI','Pressure Sensor 0-100 PSI',        4,   2, 67.50,  2],
    ['SEN-FLOW-1IN','Flow Switch 1" NPT',                   3,   2, 84.00,  2],
    ['MTR-CAP-25UF','Motor Start Capacitor 25μF',          15,   4, 11.20,  2],
    ['MTR-CAP-40UF','Motor Run Capacitor 40μF',            10,   4, 14.60,  2],
    ['PMP-SEAL-KIT','Pump Mechanical Seal Kit',            12,   3, 38.00,  1],
    ['VLV-SOLENOID-34','Solenoid Valve 3/4" 24VDC',         8,   2, 72.00,  1],
    ['VLV-CHECK-12', 'Check Valve 1/2" NPT',               20,   5, 18.50,  1],
    ['VLV-RELIEF-100','Relief Valve 100 PSI',               5,   2, 55.00,  1],
    ['GSKT-VITON-SET','Viton Gasket Assortment Set',        7,   2, 29.75,  1],
    ['GSKT-BUNA-SET','Buna-N Gasket Assortment Set',       10,   2, 21.50,  1],
    ['SCREW-M8-SS',  'M8 x 25 Stainless Socket Head (pk50)',20,  5,  8.40,  1],
    ['SCREW-M6-SS',  'M6 x 20 Stainless Socket Head (pk50)',25,  5,  6.80,  1],
    ['COUP-SPIDER-L090','Jaw Coupling Spider L090',        18,   4, 12.00,  4],
    ['COUP-SPIDER-L095','Jaw Coupling Spider L095',        14,   4, 14.50,  4],
    ['GEARBOX-OIL',  'Gearbox Oil EP220 (1 qt)',            9,   3, 16.80,  1],
    ['CHN-ROLLER-50','Roller Chain #50 (10ft)',             5,   2, 48.00,  4],
    ['SPR-DRIVE-50-17','Drive Sprocket #50 17T',            4,   2, 35.00,  4],
    ['SPR-DRIVEN-50-34','Driven Sprocket #50 34T',          3,   2, 42.00,  4],
    ['PLT-ACRLC-14', 'Acrylic Sheet 1/4" 12x12"',          6,   2, 22.00,  1],
    ['BOLT-HEX-12-SS','1/2-13 x 2" SS Hex Bolt (pk25)',   30,   8,  9.60,  1],
    ['NUT-HEX-12-SS','1/2-13 SS Hex Nut (pk50)',           45,  10,  6.20,  1],
    ['WSHR-FLAT-12-SS','1/2" SS Flat Washer (pk100)',      60,  15,  4.80,  1],
    ['FUSE-10A',     '10A Slow-Blow Fuse',                 25,  10,  1.80,  2],
    ['FUSE-15A',     '15A Slow-Blow Fuse',                 20,  10,  1.90,  2],
  ];
  for (const [pn, name, qty, min, cost, suppIdx] of parts) {
    await client.query(
      `INSERT INTO parts (manufacturer_part_number, name, quantity, minimum_quantity, unit_cost, supplier_id)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [pn, name, qty, min, cost, suppIdx]
    );
  }
}

async function seedMachines(client) {
  const machines = [
    ['Press #1',  'Hydraulic Press',    'Line A', '2019-03-12'],
    ['Press #2',  'Hydraulic Press',    'Line A', '2019-03-12'],
    ['Press #3',  'Hydraulic Press',    'Line B', '2020-07-22'],
    ['Press #7',  'Hydraulic Press',    'Line C', '2021-01-15'],
    ['Lathe #1',  'CNC Lathe',          'Shop',   '2018-06-05'],
    ['Mill #1',   'Vertical Mill',      'Shop',   '2020-09-18'],
    ['Comp #1',   'Air Compressor',     'Utility','2017-11-30'],
    ['Conv #1',   'Belt Conveyor',      'Line A', '2022-04-03'],
    ['Conv #2',   'Belt Conveyor',      'Line B', '2022-04-03'],
    ['Pump #1',   'Coolant Pump',       'Shop',   '2021-08-14'],
  ];
  for (const [name, type, location, install] of machines) {
    await client.query(
      `INSERT INTO machines (name, machine_type, location, installation_date, status)
       VALUES ($1,$2,$3,$4,'active')`,
      [name, type, location, install]
    );
  }
}

async function seedPurchaseOrders(client) {
  const hydSeal = await client.query(`SELECT part_id FROM parts WHERE manufacturer_part_number='HYD-SEAL-04'`);
  const filtOil = await client.query(`SELECT part_id FROM parts WHERE manufacturer_part_number='FILT-OIL-12'`);
  const brg6205 = await client.query(`SELECT part_id FROM parts WHERE manufacturer_part_number='BRG-6205-2RS'`);
  const apexId  = 1;

  const po1 = await client.query(`
    INSERT INTO purchase_orders
      (po_number, supplier_id, status, approval_status, requested_by, approved_by, created_at, updated_at)
    VALUES
      ('PO-2026-0041', $1, 'received', 'approved', 'demo-purchaser', 'demo-admin', $2, $3)
    RETURNING po_id`,
    [apexId, daysAgo(5), daysAgo(3)]
  );
  await client.query(`
    INSERT INTO purchase_order_items (po_id, part_id, quantity, unit_price)
    VALUES ($1, $2, 20, 28.50)`,
    [po1.rows[0].po_id, hydSeal.rows[0].part_id]
  );

  const po2 = await client.query(`
    INSERT INTO purchase_orders
      (po_number, supplier_id, status, approval_status, requested_by, created_at, updated_at)
    VALUES
      ('PO-2026-0042', 3, 'pending', 'pending', 'demo-purchaser', $1, $1)
    RETURNING po_id`,
    [daysAgo(1)]
  );
  await client.query(`
    INSERT INTO purchase_order_items (po_id, part_id, quantity, unit_price)
    VALUES ($1, $2, 12, 9.75)`,
    [po2.rows[0].po_id, filtOil.rows[0].part_id]
  );

  await client.query(`
    INSERT INTO purchase_orders
      (po_number, supplier_id, status, approval_status, requested_by, created_at, updated_at)
    VALUES
      ('PO-2026-0043', 2, 'submitted', 'pending', 'demo-purchaser', $1, $1)`,
    [daysAgo(0)]
  );

  const po4 = await client.query(`
    INSERT INTO purchase_orders
      (po_number, supplier_id, status, approval_status, requested_by, approved_by, created_at, updated_at)
    VALUES
      ('PO-2026-0038', 2, 'received', 'approved', 'demo-purchaser', 'demo-admin', $1, $2)
    RETURNING po_id`,
    [daysAgo(21), daysAgo(18)]
  );
  await client.query(`
    INSERT INTO purchase_order_items (po_id, part_id, quantity, unit_price)
    VALUES ($1, $2, 30, 12.40)`,
    [po4.rows[0].po_id, brg6205.rows[0].part_id]
  );
}

async function seedWorkOrders(client) {
  const tech1 = await client.query(`SELECT technician_id FROM technicians WHERE name='J. Martinez'`);
  const tech2 = await client.query(`SELECT technician_id FROM technicians WHERE name='A. Thompson'`);

  await client.query(`
    INSERT INTO work_orders
      (work_order_number, title, description, machine_name, technician_id, status, priority, created_at, completed_at)
    VALUES
      ('WO-2026-00001', 'Hydraulic Seal Replacement', 'Replace worn cylinder seals on Press #3 — units taken from PO-2026-0041 partial receipt.',
       'Press #3', $1, 'completed', 'high', $2, $3)`,
    [tech1.rows[0].technician_id, daysAgo(2), daysAgo(1)]
  );

  await client.query(`
    INSERT INTO work_orders
      (work_order_number, title, description, machine_name, technician_id, status, priority, created_at)
    VALUES
      ('WO-2026-00002', 'Quarterly PM — Press #7', 'Quarterly preventive maintenance. Check hydraulics, lubricate guide rods, inspect die seat.',
       'Press #7', $1, 'in_progress', 'medium', $2)`,
    [tech1.rows[0].technician_id, daysAgo(1)]
  );

  await client.query(`
    INSERT INTO work_orders (work_order_number, title, machine_name, technician_id, status, priority, created_at)
    VALUES ('WO-2026-00003', 'Replace Motor Belt', 'Press #3', $1, 'open', 'low', $2)`,
    [tech2.rows[0].technician_id, daysAgo(0)]
  );
}

async function seedDies(client) {
  const press7 = await client.query(`SELECT machine_id FROM machines WHERE name='Press #7'`);

  await client.query(`
    INSERT INTO dies (die_number, die_name, die_type, status, machine_id, sharpenings_count, max_sharpenings, total_cycles, max_cycles_before_sharpening)
    VALUES ('DIE-1042', 'Progressive Stamp Die 4"', 'progressive', 'INSTALLED', $1, 3, 10, 48000, 50000)`,
    [press7.rows[0].machine_id]
  );

  await client.query(`
    INSERT INTO dies (die_number, die_name, die_type, status, sharpenings_count, max_sharpenings)
    VALUES ('DIE-0897', 'Blanking Die 6"', 'blanking', 'OUT_FOR_SHARPENING', 5, 10)`
  );

  await client.query(`
    INSERT INTO dies (die_number, die_name, die_type, status, sharpenings_count, max_sharpenings, total_cycles, max_cycles_before_sharpening)
    VALUES ('DIE-0654', 'Forming Die 3"', 'forming', 'AVAILABLE', 1, 10, 12000, 50000)`
  );
}

async function seedTransactions(client) {
  const hydSeal = await client.query(`SELECT part_id FROM parts WHERE manufacturer_part_number='HYD-SEAL-04'`);
  const filtOil = await client.query(`SELECT part_id FROM parts WHERE manufacturer_part_number='FILT-OIL-12'`);

  await client.query(`
    INSERT INTO transactions (part_id, quantity, type, notes, created_at)
    VALUES ($1, 8, 'usage', 'Used for hydraulic seal replacement WO — PO-2026-0041 receipt', $2)`,
    [hydSeal.rows[0].part_id, daysAgo(1)]
  );
  await client.query(`
    INSERT INTO transactions (part_id, quantity, type, notes, created_at)
    VALUES ($1, 5, 'restock', 'Received from PO-2026-0038', $2)`,
    [filtOil.rows[0].part_id, daysAgo(18)]
  );
}

async function seedProjects(client) {
  const proj = await client.query(`
    INSERT INTO projects (name, description, status, start_date, target_date)
    VALUES ('Press Line A Upgrade', 'Full hydraulic system upgrade across Press #1 and Press #2 on Line A.', 'in_progress', $1, $2)
    RETURNING project_id`,
    [daysAgo(30), new Date(Date.now() + 60 * 86400000)]
  );
  const pid = proj.rows[0].project_id;
  const m1 = await client.query(`
    INSERT INTO milestones (project_id, name, status, due_date, display_order)
    VALUES ($1, 'Engineering Assessment', 'completed', $2, 1) RETURNING milestone_id`,
    [pid, daysAgo(20)]
  );
  const m2 = await client.query(`
    INSERT INTO milestones (project_id, name, status, due_date, display_order)
    VALUES ($1, 'Parts Procurement', 'in_progress', $2, 2) RETURNING milestone_id`,
    [pid, daysAgo(5)]
  );
  await client.query(`
    INSERT INTO milestones (project_id, name, status, due_date, display_order)
    VALUES ($1, 'Installation & Commissioning', 'pending', $2, 3)`,
    [pid, new Date(Date.now() + 30 * 86400000)]
  );
  await client.query(`
    INSERT INTO tasks (milestone_id, title, status, assignee)
    VALUES ($1, 'Document current system specs', 'completed', 'J. Martinez')`,
    [m1.rows[0].milestone_id]
  );
  await client.query(`
    INSERT INTO tasks (milestone_id, title, status, assignee)
    VALUES ($1, 'Order hydraulic seals and fittings', 'completed', 'demo-purchaser')`,
    [m2.rows[0].milestone_id]
  );
  await client.query(`
    INSERT INTO tasks (milestone_id, title, status, assignee)
    VALUES ($1, 'Order replacement pump', 'in_progress', 'demo-purchaser')`,
    [m2.rows[0].milestone_id]
  );
}

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ensure demo-required columns the app expects exist (idempotent)
    await client.query(`ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50)`);
    console.log('Truncating demo tables...');
    await truncateDemoTables(client);
    console.log('Seeding users...');
    await seedUsers(client);
    console.log('Seeding suppliers...');
    await seedSuppliers(client);
    console.log('Seeding technicians...');
    await seedTechnicians(client);
    console.log('Seeding contacts...');
    await seedContacts(client);
    console.log('Seeding parts...');
    await seedParts(client);
    console.log('Seeding machines...');
    await seedMachines(client);
    console.log('Seeding purchase orders...');
    await seedPurchaseOrders(client);
    console.log('Seeding work orders...');
    await seedWorkOrders(client);
    console.log('Seeding dies...');
    await seedDies(client);
    console.log('Seeding transactions...');
    await seedTransactions(client);
    console.log('Seeding projects...');
    await seedProjects(client);
    await client.query('COMMIT');
    console.log('Demo seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed — rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
