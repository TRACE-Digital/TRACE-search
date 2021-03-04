import PouchDB from 'pouchdb';
import { VERSION } from 'meta';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from './settings';

const VERSION_REGEXP = new RegExp('^[A-Za-z0-9.-]+$');

/**
 * Apply database migrations to `db`.
 *
 * @param db
 */
export async function doMigrations(db: PouchDB.Database) {
  console.group('Starting migrations...');

  // Prevent some basic errors in comparing versions
  if (!VERSION_REGEXP.test(VERSION)) {
    throw new Error(`Version '${VERSION}' contained invalid characters!`);
  }

  // Default version
  let currentVersion = '0.0.0';
  try {
    currentVersion = (await db.get<typeof DEFAULT_SETTINGS>(SETTINGS_KEY)).version;
    console.log(currentVersion);
  } catch (e) {
    console.assert(e.name === 'not_found', 'Unknown error retrieving current version!');
  }

  while (currentVersion < VERSION) {
    const migration = migrations[currentVersion];

    if (migration === undefined) {
      console.groupEnd();
      throw new Error(`No migration path from ${currentVersion} to ${VERSION}.`);
    }

    console.group(`Migrating from ${currentVersion} to ${migration.nextVersion}...`);

    for (const op of migration.operations) {
      try {
        console.groupCollapsed(`Running '${op.name}'...`);
        await op.run(db);
        console.log('Done');
        console.groupEnd();
      } catch (e) {
        // TODO: Revert?
        console.groupEnd();
        console.groupEnd();
        console.groupEnd();
        console.error(`Migration operation failed!: ${e}`);
        throw e;
      }
    }

    currentVersion = migration.nextVersion;

    console.log(`Migrated to ${currentVersion}`);
    console.groupEnd();
  }
  console.log('Migrations complete');
  console.groupEnd();
}

interface MigrationDefinitions {
  [currentVersion: string]: {
    readonly nextVersion: string;
    readonly operations: MigrationOperation[];
  };
}

interface MigrationOperation {
  readonly name: string;
  readonly revert: (db: PouchDB.Database) => any;
  readonly run: (db: PouchDB.Database) => any;
}

/**
 * Recommendations for migration definitions:
 * - Let errors bubble up to the `doMigrations` function
 * - Make a named function if the anonymous one is too crowded or complex
 * - Use `bulkDocs()` if you need to update a lot of documents
 * - Don't `put()` documents that don't need updates; it'll just make unneeded revisions
 */
const migrations: MigrationDefinitions = {
  '0.0.0': {
    nextVersion: '0.0.1',
    operations: [
      {
        name: 'initialize_settings',
        run: async (db: PouchDB.Database) => {
          await db.put(DEFAULT_SETTINGS);
        },
        revert: async (db: PouchDB.Database) => {
          await db.remove(await db.get(SETTINGS_KEY));
        },
      },
    ],
  },
};
