#!/usr/bin/env -S deno --allow-net --allow-read
import { Client } from 'https://deno.land/x/postgres/mod.ts'
import { parse } from 'https://deno.land/std/flags/mod.ts'
import $ from 'https://cdn.jsdelivr.net/gh/rokoucha/transform-ts@master/mod.ts'
import getLogger from 'https://gist.githubusercontent.com/rokoucha/b2db8f7348b0a4cbefea9011dedd0633/raw/CustomizedConsoleLogger.ts'
import Migrate from './migrate.ts'

async function main() {
  const argsTransformer = $.obj({
    _: $.array($.string),
    database: $.string,
    down: $.optional($.string),
    hostname: $.string,
    id: $.optional($.number),
    log: $.optional($.string),
    password: $.string,
    path: $.optional($.string),
    port: $.number,
    table: $.optional($.string),
    up: $.optional($.string),
    username: $.string,
  })

  const ARGS = argsTransformer.transformOrThrow(parse(Deno.args))
  const SELF = ARGS._.shift()
  const SUBCOMMAND = ARGS._.shift()

  const logger = await getLogger(ARGS.log)

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
  --database   Database name
  --hostname   Hostname
  --password   Password
  --port       Port
  --table      Table name
  --username   Username
Subcommands:
  help       Prints this help
  migrate    Migrate database
  rollback   Rollback database
  status     Prints migration status
Options:
  --down   File name of down SQL
  --id:    Target id
  --log:   Logging level (DEBUG or INFO)
  --path   Path to migration files
  --up:    File name of up SQL`)
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
