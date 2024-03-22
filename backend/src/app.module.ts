import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AutorModule } from './resources/autor/autor.module';
import { CategoriaModule } from './resources/categoria/categoria.module';
import { LivroModule } from './resources/livro/livro.module';
import { UsuarioModule } from './resources/usuario/usuario.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AutorModule,
    CategoriaModule,
    LivroModule,
    UsuarioModule,
  ],
})
export class AppModule {}
