#!/usr/bin/env -S deno --allow-env --allow-net --allow-read
import { Client } from 'https://deno.land/x/postgres@v0.3.6/mod.ts'
import { parse } from 'https://deno.land/std@v0.31.0/flags/mod.ts'
import $ from 'https://cdn.jsdelivr.net/gh/rokoucha/transform-ts@master/mod.ts'
import getLogger from 'https://gist.githubusercontent.com/rokoucha/b2db8f7348b0a4cbefea9011dedd0633/raw/CustomizedConsoleLogger.ts'
import Migrate from './migrate.ts'
import { $numericString } from './transformers.ts'

async function main() {
  const ENV = $.obj({
    DB_DATABASE: $.optional($.string),
    DB_HOST: $.optional($.string),
    DB_PASSWORD: $.optional($.string),
    DB_PORT: $.optional($numericString),
    DB_USERNAME: $.optional($.string),
  }).transformOrThrow(Deno.env())

  const ARGS = parse(Deno.args)
  if (ENV.DB_DATABASE) ARGS.database = ENV.DB_DATABASE
  if (ENV.DB_HOST) ARGS.host = ENV.DB_HOST
  if (ENV.DB_PASSWORD) ARGS.password = ENV.DB_PASSWORD
  if (ENV.DB_PORT) ARGS.port = ENV.DB_PORT
  if (ENV.DB_USERNAME) ARGS.username = ENV.DB_USERNAME

  const PARAMS = $.obj({
    _: $.array($.string),
    database: $.string,
    down: $.optional($.string),
    host: $.string,
    id: $.optional($.number),
    log: $.optional($.string),
    password: $.string,
    path: $.optional($.string),
    port: $.number,
    table: $.optional($.string),
    up: $.optional($.string),
    username: $.string,
  }).transformOrThrow(ARGS)

  const SELF = 'denomig.ts'
  const SUBCOMMAND = PARAMS._.shift()

  const logger = await getLogger(PARAMS.log)

  const client = new Client({
    database: ARGS.database,
    host: ARGS.hostname,
    password: ARGS.password,
    port: String(ARGS.port),
    user: ARGS.username,
  })

  const migrate = new Migrate({
    client,
    logger,
    table: ARGS.table,
    path: ARGS.path,
    up: ARGS.up,
    down: ARGS.down,
  })

  switch (SUBCOMMAND) {
    case 'status':
      await migrate.initlaize()
      const migrations = await migrate.getMigrations()
      console.table(
        migrations.map(m => {
          return {
            id: m.id,
            name: m.name,
            defined: m.defined,
            migrated: m.migrated,
          }
        }),
      )
      break

    case 'migrate':
      await migrate.initlaize()
      await migrate.migrate(ARGS.id)
      break

    case 'rollback':
      await migrate.initlaize()
      await migrate.rollback(ARGS.id)
      break

    case 'help':
      console.log(`Simplest database migration tool for deno-postgres

usage: ${SELF} <CONNECTION_INFO> <SUBCOMMAND> [OPTIONS]

Connection info:
  --database or env.DB_DATABASE   Database name
  --host     or env.DB_HOST       Server address
  --password or env.DB_PASSWORD   Password
  --port     or env.DB_PORT       Port
  --username or env.DB_USERNAME   Username
Subcommands:
  help       Prints this help
  migrate    Migrate database
  rollback   Rollback database
  status     Prints migration status
Options:
  --down    File name of down SQL
  --id:     Target id
  --log:    Logging level (DEBUG or INFO)
  --path    Path to migration files
  --table   Migration management table name
  --up:     File name of up SQL`)
      Deno.exit(0)
      break
    default:
      logger.error(
        `'${SUBCOMMAND}' is not valid subcommand. See '${SELF} --help'`,
      )
      Deno.exit(1)
      break
  }

  migrate.exit()
}

main()
