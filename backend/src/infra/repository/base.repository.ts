import { Entity } from '../../entities/types';
import { Store } from "../database/store";
import { ValidationError, validate } from "class-validator";
import { randomUUID } from 'node:crypto';
import "reflect-metadata";

export class Repository<T extends Entity> {
  #store: Store;
  #entityColumns: any[];
  protected BeforInsert: ((entity: T) => void) | null = null;

  constructor(private entity: any) {
    this.#store = Store.Instance;
    this.#entityColumns = Reflect.getOwnMetadata('EntityColumn', this.entity);
  }

  private processDecorators(entity: T): void {
    let propertyKey: string;
    let metadata: any;
    metadata = Reflect.getMetadata('CheckConstraintFK', entity.constructor);
    if (metadata) {
      for (let checkFK of metadata) {
        const columnName = checkFK['columnName'];
        const fkTable = checkFK['fkTable'];
        const fkColumnName = checkFK['fkColumnName'];
        const data = this.#store.getData(fkTable);
        if (data.filter(v => { return v[fkColumnName] === entity[columnName] }).length <= 0)
          throw new Error(`Chave não encontrada ${columnName} ${entity[columnName]}`);
      }
    }

    this.#entityColumns.map(e => {
      if (e.propertyType && entity.constructor.name != e.propertyType.name) {
        const eEntityColumns = Reflect.getOwnMetadata('EntityColumn', e.propertyType);
        if (eEntityColumns) {
          const arrayOfEntity: any[] = [];
          if (Array.isArray(entity[e.propertyKey])) {
            for (let _entity of entity[e.propertyKey]) {
              arrayOfEntity.push(_entity);
            }
          } else {
            arrayOfEntity.push(entity[e.propertyKey]);
          }

          for (let itemEntity of arrayOfEntity) {
            const ec = new e.propertyType;
            for(let k of eEntityColumns) {
              ec[k.propertyKey] = itemEntity[k.propertyKey] || null;
            }
            this.processDecorators(ec);
            if (!Array.isArray(entity[e.propertyKey]))
              entity[e.propertyKey] = ec;
          }

        }
      }

      metadata = Reflect.getMetadata('AutoGeneratedID', entity.constructor, e.propertyKey);
      if (metadata) {
        entity[e.propertyKey] = randomUUID();
      }

      metadata = Reflect.getMetadata('IsUnique', entity.constructor, e.propertyKey);
      if (metadata) {
        const data = this.#store.getData(entity.constructor.name) || [];
        if (data.length > 0 && data.filter(v => { return v[e.propertyKey] === entity[e.propertyKey] }).length > 0)
          throw new Error(`Erro de violação de registro único: já existe um registro com ${e.propertyKey} ${entity[e.propertyKey]}`);
      }
    });
  }

  private async validateSchema(entity: T): Promise<boolean> {
    let errorMessage: string = '';
    const entities: T[] = [];
    const erros: ValidationError[] = [];
    this.#entityColumns.map(async e => {
      if (e.propertyType && entity.constructor.name != e.propertyType.name) {
        const eEntityColumns = Reflect.getOwnMetadata('EntityColumn', e.propertyType);
        if (eEntityColumns)
          entities.push(entity[e.propertyKey]);
      }
    });
    entities.push(entity);
    for (let e of entities) {
      const validationErrors = await validate(e);
      erros.push(...validationErrors);
    }
    erros.map(v => errorMessage += Object.values(v.constraints)[0] + '\n');
    if (errorMessage != '') {
        throw new Error('Inclusão de dados não passou pela validação:\n' + errorMessage);
        return false;
    } else
      return true;
  }

  async insert(dto: Object): Promise<T> {
    const entity = new this.entity;
    this.#entityColumns.map(c => {
      if (c.propertyType === Date)
        entity[c.propertyKey] = new Date(dto[c.propertyKey])
      else
        entity[c.propertyKey] = dto[c.propertyKey];
    });

    if (this.BeforInsert)
      this.BeforInsert(entity);

    this.processDecorators(entity);
    if (await this.validateSchema(entity)) {
      this.#store.saveData(entity.constructor.name, entity);
      return entity;
    } else
      return null
  }

  getAll(): T[] {
    const data: any[] = this.#store.getData((new this.entity).constructor.name);
    return data;
  }

  findeOne(id: any): T {
    const data: T[] = this.#store.getData((new this.entity).constructor.name);
    const retorno = data.filter((e) => e['id'] === id);
    return retorno[0];
  }
}
