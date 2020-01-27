import { Client } from 'https://deno.land/x/postgres/mod.ts'
import { Logger } from 'https://deno.land/std/log/logger.ts'
import { join } from 'https://deno.land/std/path/mod.ts'

export interface Migration {
  defined: boolean
  down: string
  id: number
  migrated: boolean
  name: string
  up: string
}

export interface MigrateParams {
  client: Client
  down?: string
  logger?: Logger
  path?: string
  table?: string
  up?: string
}

export default class Migrate {
  private client: Client
  private down: string
  private logger?: Logger
  private path: string
  private table: string
  private up: string

  constructor(params: MigrateParams) {
    this.client = params.client
    this.down = params.down ?? 'down.sql'
    this.logger = params.logger
    this.path = this.getPath(params.path ?? './migrations')
    this.table = params.table ?? 'migrations'
    this.up = params.up ?? 'up.sql'
  }

  private getPath(path: string): string {
    return path.startsWith('/') ? path : join(Deno.cwd(), path)
  }

  public async initlaize(): Promise<void> {
    await this.client.connect()
    this.logger?.info('Connected to database')

    const tables = await this.client.query(
      'SELECT * FROM information_schema.tables WHERE table_name = $1;',
      this.table,
    )

    if (tables.rows.length < 1) {
      this.logger?.info(
        `Creating table "${this.table}" for migration management.`,
      )

      await this.client.query(
        `CREATE TABLE ${this.table} ( "id" serial, "migration" character varying(255) NOT NULL );`,
      )
    }
  }

  public async exit() {
    await this.client.end()
  }

  public async getMigrations(): Promise<Migration[]> {
    const migrations: Migration[] = new Array()

    const migrated = await this.client.query(
      `SELECT "id", "migration" FROM ${this.table};`,
    )
    migrated.rows.forEach(([id, migration]: [number, string]) => {
      migrations.push({
        defined: false,
        down: '',
        id,
        migrated: true,
        name: migration,
        up: '',
      })
    })

    const defined = await Deno.readDir(this.path)
    await Promise.all(
      defined.map(async migration => {
        const sqlList = (
          await Deno.readDir(`${this.path}/${migration.name}`)
        ).map(fileinfo => fileinfo.name)

        const upSql = sqlList.includes(this.up)
          ? `${this.path}/${migration.name}/${this.up}`
          : ''
        const downSql = sqlList.includes(this.down)
          ? `${this.path}/${migration.name}/${this.down}`
          : ''

        const migratedIndex = migrations.findIndex(
          m => m.name === migration.name,
        )
        if (migratedIndex !== -1) {
          migrations[migratedIndex].defined = true
          migrations[migratedIndex].down = downSql
          migrations[migratedIndex].up = upSql
        } else {
          migrations.push({
            defined: true,
            down: downSql,
            id: 0,
            migrated: false,
            name: migration.name,
            up: upSql,
          })
        }
      }),
    )

    return migrations.sort((a: Migration, b: Migration) => {
      return a.name < b.name ? -1 : 1
    })
  }

  public async migrate(id?: number): Promise<void> {
    const migrations = await this.getMigrations()
    const targetMigrations = migrations
      .slice(0, id ?? migrations.length)
      .filter((m: Migration): boolean => m.defined)
      .filter((m: Migration): boolean => !m.migrated)

    for (const migration of targetMigrations) {
      this.logger?.info(`Migrating "${migration.name}"`)

      const queryFile = await Deno.readFile(migration.up)
      const query = new TextDecoder('utf-8').decode(queryFile)

      this.logger?.debug(`Execute query: ${query}`)
      await this.client.query(query)

      this.logger?.debug(`Insert migration info for ${migration.name}`)
      await this.client.query(
        `INSERT INTO ${this.table} ("migration") VALUES ($1);`,
        migration.name,
      )
    }
  }

  public async rollback(id?: number): Promise<void> {
    const migrations = await this.getMigrations()
    const targetMigrations = migrations
      .slice(id ?? 0)
      .filter((m: Migration): boolean => m.defined)
      .filter((m: Migration): boolean => m.migrated)
      .sort((a: Migration, b: Migration) => {
        return a.id > b.id ? -1 : 1
      })

    for (const migration of targetMigrations) {
      this.logger?.info(`Rollbacking "${migration.name}"`)

      const queryFile = await Deno.readFile(migration.down)
      const query = new TextDecoder('utf-8').decode(queryFile)

      this.logger?.debug(`Execute query: ${query}`)
      await this.client.query(query)

      this.logger?.debug(`Insert migration info for ${migration.name}`)
      await this.client.query(
        `DELETE FROM ${this.table} WHERE migration = $1;`,
        migration.name,
      )
    }
  }
}
