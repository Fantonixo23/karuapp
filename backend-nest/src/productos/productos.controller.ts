import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseInterceptors, UploadedFile, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductosService } from './productos.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

// Se crea de forma perezosa: si SUPABASE_URL/SERVICE_KEY no estan configuradas,
// el backend igual arranca y solo falla la subida de imagenes (no todo el server).
let supabaseClient: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabaseClient) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key) {
      throw new InternalServerErrorException(
        'Supabase Storage no configurado (falta SUPABASE_URL o SUPABASE_SERVICE_KEY)',
      );
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

@Controller('api')
export class ProductosController {
  constructor(private service: ProductosService) {}

  @Get('categorias')
  async listarCategorias(@CurrentUser('restauranteId') rid: number) {
    const categorias = await this.service.listarCategorias(rid);
    return { success: true, categorias };
  }

  @Post('categorias/crear')
  @Roles('administrador')
  async crearCategoria(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const categoria = await this.service.crearCategoria(rid, body);
    return { success: true, categoria };
  }

  @Delete('categorias/:id/eliminar')
  @Roles('administrador')
  async eliminarCategoria(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminarCategoria(rid, +id);
  }

  @Put('categorias/:id/editar')
  @Roles('administrador')
  async editarCategoria(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const categoria = await this.service.actualizarCategoria(rid, +id, body);
    if (!categoria) return { success: false, error: 'Categoría no encontrada' };
    return { success: true, categoria };
  }

  @Get('productos')
  async listarProductos(
    @CurrentUser('restauranteId') rid: number,
    @Query('categoria_id') categoriaId?: string,
  ) {
    const productos = await this.service.listarProductos(rid, categoriaId ? +categoriaId : undefined);
    return { success: true, productos };
  }

  @Post('productos/crear')
  @Roles('administrador')
  async crearProducto(@CurrentUser('restauranteId') rid: number, @Body() body: any) {
    const producto = await this.service.crearProducto(rid, body);
    return { success: true, producto };
  }

  @Post('productos/:id/editar')
  @Roles('administrador')
  async editarProducto(
    @CurrentUser('restauranteId') rid: number,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const producto = await this.service.actualizarProducto(rid, +id, body);
    return { success: true, producto };
  }

  @Post('productos/subir-imagen')
  @Roles('administrador')
  @UseInterceptors(
    FileInterceptor('imagen', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const permitido = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
        cb(permitido ? null : new BadRequestException('Tipo de archivo no permitido (solo jpg, png, webp, gif)'), permitido);
      },
    }),
  )
  async subirImagen(
    @CurrentUser('restauranteId') rid: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) return { success: false, error: 'No se recibió ninguna imagen' };
    const supabase = getSupabase();
    const ext = extname(file.originalname) || '.jpg';
    const fileName = `tenant/${rid}/productos/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    const { data, error } = await supabase.storage
      .from('productos')
      .upload(fileName, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) return { success: false, error: error.message };
    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(fileName);
    return { success: true, url: publicUrl };
  }

  @Post('productos/:id/toggle')
  @Roles('administrador')
  async toggleProducto(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    const producto = await this.service.toggleDisponible(rid, +id);
    return { success: true, producto };
  }

  @Delete('productos/:id/eliminar')
  @Roles('administrador')
  async eliminarProducto(@CurrentUser('restauranteId') rid: number, @Param('id') id: string) {
    return this.service.eliminarProducto(rid, +id);
  }
}
