import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPin = await bcrypt.hash('1234', 10);

  const restaurante = await prisma.restaurante.upsert({
    where: { slug: 'demo-restaurante' },
    update: {},
    create: {
      nombre: 'Demo Restaurante',
      slug: 'demo-restaurante',
      plan: 'free',
      fechaExpiracion: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      estadoLicencia: 'activo',
    },
  });

  const admin = await prisma.usuario.upsert({
    where: { id: 1 },
    update: {},
    create: {
      restauranteId: restaurante.id,
      nombre: 'Admin',
      pin: hashedPin,
      email: 'admin@karuapp.com',
      rol: 'administrador',
      activo: true,
    },
  });

  console.log(`Seed created: ${restaurante.nombre}, admin: ${admin.nombre} (PIN: 1234)`);

  const cajas = ['Principal', 'Interior', 'Exterior', 'Patio', 'VIP'];
  for (let i = 0; i < cajas.length; i++) {
    await prisma.mesa.upsert({
      where: { restauranteId_numero: { restauranteId: restaurante.id, numero: i + 1 } },
      update: {},
      create: {
        restauranteId: restaurante.id,
        numero: i + 1,
        nombre: `Mesa ${i + 1}`,
        capacidad: i < 2 ? 2 : 4,
        area: ['principal', 'interior', 'exterior', 'patio', 'principal'][i] || 'principal',
      },
    });
  }

  const cat = await prisma.categoria.upsert({
    where: { id: 1 },
    update: {},
    create: { restauranteId: restaurante.id, nombre: 'Comidas', icono: 'restaurant', orden: 1 },
  });

  await prisma.producto.upsert({
    where: { id: 1 },
    update: {},
    create: {
      restauranteId: restaurante.id,
      nombre: 'Hamburguesa Clásica',
      precio: 25000,
      categoriaId: cat.id,
      iva: 10,
    },
  });

  await prisma.producto.upsert({
    where: { id: 2 },
    update: {},
    create: {
      restauranteId: restaurante.id,
      nombre: 'Pizza Margarita',
      precio: 45000,
      categoriaId: cat.id,
      iva: 10,
    },
  });

  await prisma.metodoPago.upsert({
    where: { restauranteId_nombre: { restauranteId: restaurante.id, nombre: 'efectivo' } },
    update: {},
    create: { restauranteId: restaurante.id, nombre: 'efectivo', etiqueta: 'Efectivo', icono: 'cash', color: '#4CAF50', orden: 1 },
  });

  await prisma.metodoPago.upsert({
    where: { restauranteId_nombre: { restauranteId: restaurante.id, nombre: 'tarjeta' } },
    update: {},
    create: { restauranteId: restaurante.id, nombre: 'tarjeta', etiqueta: 'Tarjeta', icono: 'credit_card', color: '#2196F3', orden: 2 },
  });

  await prisma.metodoPago.upsert({
    where: { restauranteId_nombre: { restauranteId: restaurante.id, nombre: 'qr' } },
    update: {},
    create: { restauranteId: restaurante.id, nombre: 'qr', etiqueta: 'QR', icono: 'qr_code', color: '#9C27B0', orden: 3 },
  });

  await prisma.metodoPago.upsert({
    where: { restauranteId_nombre: { restauranteId: restaurante.id, nombre: 'transferencia' } },
    update: {},
    create: { restauranteId: restaurante.id, nombre: 'transferencia', etiqueta: 'Transferencia', icono: 'account_balance', color: '#FF9800', orden: 4 },
  });

  await prisma.configuracion.upsert({
    where: { id: 1 },
    update: {},
    create: {
      restauranteId: restaurante.id,
      nombreEmpresa: 'Demo Restaurante',
      ruc: '44444444-7',
      direccion: 'Av. Principal 123',
      telefono: '021 123 456',
      tasaIva: 10,
      tamanioPapel: '58mm',
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
