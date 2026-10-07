/* Test end-to-end del backend contra el Session pooler. */
require('dotenv').config();
const { Pool } = require('pg');
const { spawn } = require('child_process');

const PORT = process.env.E2E_PORT || '3099';
const BASE = `http://127.0.0.1:${PORT}`;
const EMAIL = `e2e.karu.${Date.now()}@gmail.com`;
const PASS = 'PasswordE2E123!';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
let errores = 0;

function check(name, cond, extra) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (!cond) errores++;
  console.log(`  [${mark}] ${name}${extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''}`);
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta sin cuerpo */
  }
  return { status: res.status, data };
}

async function waitForServer(timeoutMs = 60000) {
  const net = require('net');
  const inicio = Date.now();
  while (Date.now() - inicio < timeoutMs) {
    const abierto = await new Promise((resolve) => {
      const s = net.connect(Number(PORT), '127.0.0.1');
      const done = (v) => {
        s.removeAllListeners();
        s.destroy();
        resolve(v);
      };
      s.setTimeout(1500, () => done(false));
      s.once('connect', () => done(true));
      s.once('error', () => done(false));
    });
    if (abierto) {
      // Espera a que Nest haya registrado rutas: un 404/401 del router ya sirve.
      for (let i = 0; i < 40; i++) {
        try {
          const r = await fetch(`${BASE}/api/auth/me`);
          if (r.status !== 404) return true;
        } catch {
          /* aun no */
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      return true;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function main() {
  const child = spawn(process.execPath, ['dist/main.js'], {
    env: { ...process.env, PORT: PORT, NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (d) => logs.push(d.toString()));
  child.stderr.on('data', (d) => logs.push(d.toString()));

  let restauranteId = null;
  const db = await pool.connect();
  await db.query(`SELECT set_config('app.is_superadmin', 'true', false)`);
  try {
    const listo = await waitForServer();
    if (!listo) throw new Error('El servidor no arranco:\n' + logs.join(''));

    console.log('\n=== 1. AUTH: registro + verificacion + login ===');
    const reg = await req('POST', '/api/auth/register-saas', {
      body: {
        email: EMAIL,
        password: PASS,
        nombre: 'Tester E2E',
        restaurante_nombre: `Resto E2E ${Date.now() % 100000}`,
      },
    });
    check('register-saas', reg.status === 201 || reg.status === 200, { status: reg.status, data: reg.data });

    const codeRow = await db.query(
      `SELECT code FROM verification_codes WHERE email=$1 AND purpose='account_activation' ORDER BY id DESC LIMIT 1`,
      [EMAIL],
    );
    check('codigo de activacion emitido', codeRow.rows.length === 1, { code: codeRow.rows[0]?.code });

    const ver = await req('POST', '/api/auth/verificar-cuenta', { body: { email: EMAIL, code: codeRow.rows[0].code } });
    check('verificar-cuenta', ver.status < 300, { status: ver.status, data: ver.data });

    const login = await req('POST', '/api/auth/login-saas', { body: { email: EMAIL, password: PASS } });
    check('login-saas', login.status < 300 && !!login.data?.access_token, { status: login.status });
    const token = login.data?.access_token || login.data?.token;
    check('JWT devuelto', !!token);

    const me = await req('GET', '/api/auth/me', { token });
    check('GET /me con JWT', me.status === 200 && !!me.data, { status: me.status });
    restauranteId = me.data?.restaurante_id ?? me.data?.user?.restaurante_id ?? me.data?.restaurante?.id;
    check('restaurante_id resuelto', !!restauranteId, { restauranteId });

    console.log('\n=== 2. CATALOGO: categorias / productos / mesas ===');
    const cat = await req('POST', '/api/categorias/crear', { token, body: { nombre: 'Bebidas' } });
    check('crear categoria', cat.status < 300 && !!cat.data?.categoria?.id, { status: cat.status, data: cat.data });
    const catId = cat.data?.categoria?.id ?? cat.data?.id;

    const prods = [];
    for (const p of [{ nombre: 'Empanada', precio: 7000 }, { nombre: 'Refresco', precio: 5000 }]) {
      const r = await req('POST', '/api/productos/crear', {
        token,
        body: { ...p, categoria_id: catId, iva: 10, variantes: [{ nombre: 'Grande', extra: 1000 }] },
      });
      check(`crear producto ${p.nombre}`, r.status < 300 && !!r.data?.producto?.id, { status: r.status, data: r.data });
      prods.push(r.data?.producto ?? r.data);
    }
    check('productos con id', prods.every((p) => p && p.id), prods.map((p) => p?.id));

    const lista = await req('GET', '/api/productos', { token });
    check('GET /api/productos responde', lista.status === 200, { status: lista.status });
    const productos = lista.data?.productos || lista.data;
    check('listado es array', Array.isArray(productos) && productos.length >= 2, productos?.length);
    const prodListo = productos?.[0];
    check('categoria aplanada (categoria_nombre)', typeof prodListo?.categoria_nombre === 'string', prodListo?.categoria_nombre);
    check('variantes JSONB parseado como array', Array.isArray(prodListo?.variantes), prodListo?.variantes);

    const mesa = await req('POST', '/api/mesas/crear', { token, body: { numero: 1, capacidad: 4, area: 'principal' } });
    check('crear mesa', mesa.status < 300 && !!mesa.data?.mesa?.id, { status: mesa.status, data: mesa.data });
    const mesaId = mesa.data?.mesa?.id ?? mesa.data?.id;
    const mesas = await req('GET', '/api/mesas', { token });
    check('GET /api/mesas', mesas.status === 200 && Array.isArray(mesas.data?.mesas), { status: mesas.status });
    const m0 = mesas.data?.mesas?.[0];
    const desfaseCreado = m0 ? Math.abs(new Date(m0.created_at).getTime() - Date.now()) : 0;
    check('created_at sin desfase de timezone (<60s)', desfaseCreado < 60000, { desfase_seg: Math.round(desfaseCreado / 1000) });
    const desfaseEdit = m0 ? Math.abs(new Date(m0.created_at) - new Date(m0.updated_at)) : 0;
    check('created_at y updated_at consistentes (<60s)', desfaseEdit < 60000, { desfase_seg: Math.round(desfaseEdit / 1000) });

    console.log('\n=== 3. PEDIDOS: escritura/lectura de items JSONB ===');
    const items = [
      { producto_id: prods[0].id, cantidad: 2 },
      { producto_id: prods[1].id, cantidad: 3 },
    ];
    const crear = await req('POST', '/api/pedidos/crear', {
      token,
      body: { mesa_id: mesaId, items, notas: 'sin sal' },
    });
    check('crear pedido', crear.status < 300 && !!crear.data?.pedido?.id, { status: crear.status, data: crear.data });
    const pedidoId = crear.data?.pedido?.id;

    const listados = await req('GET', '/api/pedidos', { token });

    // La creacion del pedido escribe updated_at desde JS y created_at lo pone la
    // base: si las zonas no coinciden, aparece un desfase de horas.
    const mesasPosPedido = await req('GET', '/api/mesas', { token });
    const mp = mesasPosPedido.data?.mesas?.[0];
    const desfase = mp ? Math.abs(new Date(mp.created_at) - new Date(mp.updated_at)) : 0;
    check('mesa: created_at (base) vs updated_at (JS) sin desfase', desfase < 60000, {
      desfase_seg: Math.round(desfase / 1000),
      created: mp?.created_at,
      updated: mp?.updated_at,
    });

    check('GET /api/pedidos', listados.status === 200, { status: listados.status });
    const pedidos = listados.data?.pedidos;
    check('pedidos es array', Array.isArray(pedidos) && pedidos.length === 1, pedidos?.length);
    const p = pedidos?.[0];
    check('numero_orden formateado', /^\d{3}$/.test(p?.numero_orden || ''), p?.numero_orden);
    check('items leido como array (JSONB round-trip)', Array.isArray(p?.items) && p.items.length === 2, p?.items);
    check('items conserva la estructura', p?.items?.[0]?.producto_nombre === 'Empanada', p?.items?.[0]);
    check('relacion mesa_numero via LEFT JOIN', p?.mesa_numero === 1, p?.mesa_numero);
    check('relacion mesero_nombre via LEFT JOIN', typeof p?.mesero_nombre === 'string', p?.mesero_nombre);
    check('total calculado (2*7000 + 3*5000 = 29000)', p?.total === 29000, p?.total);

    const cocina = await req('GET', '/api/cocina/pedidos', { token });
    check('GET cocina', cocina.status === 200 && Array.isArray(cocina.data?.pedidos), { status: cocina.status, n: cocina.data?.pedidos?.length });

    console.log('\n=== 3b. CICLO DE VIDA DEL PEDIDO ===');
    for (const estado of ['cocinando', 'listo', 'entregado']) {
      const r = await req('POST', `/api/cocina/pedidos/${pedidoId}/estado`, { token, body: { estado } });
      check(`cocina -> ${estado}`, r.status < 300, { status: r.status, data: r.data });
    }
    const invalida = await req('POST', `/api/cocina/pedidos/${pedidoId}/estado`, { token, body: { estado: 'pendiente' } });
    check('transicion invalida rechazada', invalida.status === 400, { status: invalida.status, data: invalida.data });

    console.log('\n=== 4. CAJA + COBRO ===');
    const apertura = await req('POST', '/api/caja/apertura', { token, body: { fondo_inicial: 100000 } });
    check('apertura de caja', apertura.status < 300, { status: apertura.status, data: apertura.data });

    const pagar = await req('POST', `/api/pedidos/${pedidoId}/pagar`, {
      token,
      body: { metodo_pago: 'efectivo', propina: 1000 },
    });
    check('pagar pedido', pagar.status < 300, { status: pagar.status, data: pagar.data });
    check('metodo_pago en respuesta snake_case', pagar.data?.pedido?.metodo_pago === 'efectivo', pagar.data?.pedido?.metodo_pago);
    check('propina reflejada', pagar.data?.pedido?.propina === '1000', pagar.data?.pedido?.propina);

    const mesasTras = await req('GET', '/api/mesas', { token });
    check('mesa liberada tras pagar', mesasTras.data?.mesas?.[0]?.estado === 'disponible', mesasTras.data?.mesas);

    const mov = await db.query(
      `SELECT tipo, monto, propina, moneda FROM caja_movimientos WHERE pedido_id=$1`,
      [pedidoId],
    );
    check('movimiento de caja insertado', mov.rows.length === 1, mov.rows[0]);
    check('monto en caja = total + propina', mov.rows[0]?.monto === 30000, mov.rows[0]?.monto);

    const historial = await req('GET', '/api/pedidos/historial', { token });
    check(
      'GET pedidos/historial (venta 29000 + propina 1000)',
      historial.status === 200 && historial.data?.resumen?.total === '29000' && historial.data?.resumen?.propinas === '1000',
      historial.data?.resumen,
    );

    const pagados = await req('GET', '/api/pedidos/pagados', { token });
    check('GET pedidos/pagados', pagados.status === 200 && Number(pagados.data?.total) === 1, {
      status: pagados.status,
      data: pagados.data,
    });
    check('pagados items parseado', Array.isArray(pagados.data?.pedidos?.[0]?.items), pagados.data?.pedidos?.[0]?.items);
    check('pagados propina como string', pagados.data?.pedidos?.[0]?.propina === '1000', pagados.data?.pedidos?.[0]?.propina);

    const dashboard = await req('GET', '/api/pedidos/delivery/dashboard', { token });
    check('dashboard delivery', dashboard.status === 200 && dashboard.data?.data?.pedidos !== undefined, {
      status: dashboard.status,
    });

    console.log('\n=== 5. INVENTARIO ===');
    const inv = await req('POST', '/api/inventario/actualizar', {
      token,
      body: { producto_id: prods[0].id, stock_actual: 20, stock_minimo: 5, unidad_medida: 'und' },
    });
    check('actualizar inventario', inv.status < 300, { status: inv.status, data: inv.data });
    const alertas = await req('GET', '/api/inventario/alertas', { token });
    check('alertas inventario', alertas.status === 200 && Array.isArray(alertas.data?.alertas), { n: alertas.data?.alertas?.length });
    const movInv = await req('POST', '/api/inventario/movimiento', {
      token,
      body: { inventario_id: inv.data?.inventario?.id, tipo: 'salida', cantidad: 5, motivo: 'e2e' },
    });
    check('movimiento inventario', movInv.status < 300, { status: movInv.status, data: movInv.data });
    const alertas2 = await req('GET', '/api/inventario/alertas', { token });
    check('alertas tras salida', alertas2.status === 200, { n: alertas2.data?.alertas?.length });
  } catch (e) {
    errores++;
    console.log('\n  [ERROR] ' + e.message);
    if (logs.length) {
      const todo = logs.join('');
      const erroresLog = todo
        .split('\n')
        .filter((l) => /error|exception|stack|QueryFailedError|P1\d{3}|fatal|warn/i.test(l));
      console.log('  --- errores en el log del servidor ---');
      console.log((erroresLog.slice(-30).join('\n') || '  (ninguna linea de error)'));
      if (!erroresLog.length) console.log('  --- ultimas lineas ---\n' + logs.slice(-12).join(''));
    }
  } finally {
    console.log('\n=== LIMPIEZA ===');
    const client = await pool.connect();
    try {
      await client.query(`SELECT set_config('app.is_superadmin', 'true', false)`);
      const ids = await client.query(
        `SELECT id FROM restaurantes WHERE slug LIKE '%e2e%' OR nombre LIKE '%E2E%'`,
      );
      if (!ids.rows.length) {
        console.log('  nada que limpiar');
      } else {
        const lista = ids.rows.map((r) => r.id);
        const tablas = [
          'impresiones',
          'facturas',
          'caja_movimientos',
          'caja_cortes',
          'caja_sesiones',
          'pedidos',
          'movimientos_inventario',
          'inventario',
          'productos',
          'categorias',
          'mesas',
          'metodos_pago',
          'timbrados',
          'configuracion',
          'pagos_licencia',
          'usuarios',
          'restaurantes',
        ];
        await client.query('BEGIN');
        await client.query(`DELETE FROM verification_codes WHERE email LIKE 'e2e.karu.%'`);
        for (const t of tablas) {
          const col = t === 'restaurantes' ? 'id' : 'restaurante_id';
          await client.query(`DELETE FROM ${t} WHERE ${col} = ANY($1)`, [lista]);
        }
        await client.query('COMMIT');
        console.log(`  restaurantes e2e eliminados: ${lista.join(', ')}`);
      }
      const restantes = await client.query(
        `SELECT (SELECT count(*) FROM usuarios WHERE email LIKE 'e2e.karu.%') AS users,
                (SELECT count(*) FROM restaurantes WHERE slug LIKE '%e2e%') AS restaurantes,
                (SELECT count(*) FROM pedidos) AS pedidos,
                (SELECT count(*) FROM caja_sesiones) AS cajas`,
      );
      console.log('  residuos: ' + JSON.stringify(restantes.rows[0]));
    } catch (e) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* sin transaccion activa */
      }
      console.log('  fallo limpieza: ' + e.message);
    } finally {
      client.release();
    }
    db.release();
    await pool.end();
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3000);
    console.log(`\n${errores === 0 ? 'TODOS LOS TESTS PASARON' : errores + ' TEST(S) FALLARON'}`);
    process.exit(errores === 0 ? 0 : 1);
  }
}

main();
