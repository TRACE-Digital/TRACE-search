import {
  AccountSchema,
  DbCache,
  DbResponse,
  getDb,
  IDbStorable,
  PouchDbId,
  ProfilePageColorSchema,
  ProfilePageSchema,
  throwIfIdMismatch,
  toId,
  UTF_MAX,
} from 'db';
import { ThirdPartyAccount } from 'search';

export const DEFAULT_COLOR_SCHEME: ProfilePageColorSchema = {
  titleColor: '#FFFFFF',
  backgroundColor: '#1E1D2A',
  siteColor: '#26283A',
  iconColor: 'Default',
};

/**
 * Parameters needed to reconstruct the editing state on the profile editor.
 */
export class ProfilePage implements IDbStorable {
  public static cache = new DbCache<ProfilePage>();
  public get pages() {
    return ProfilePage.cache.items;
  }
  private static idForDefaultName = 0;

  /**
   * Load all `ProfilePage`s from the database into
   * the `searchDefinitions` map.
   *
   * Returns an array of the requested definitions. All loaded definitions
   * (including ones not loaded by this request) can be accessed
   * via `searchDefinitions`.
   */
  public static async loadAll(idPrefix?: string) {
    const db = await getDb();
    const response = await db.allDocs<ProfilePageSchema>({
      include_docs: true,
      startkey: toId(['profile'], idPrefix),
      endkey: toId(['profile', UTF_MAX], idPrefix),
    });
    console.debug(response);

    const results = [];
    for (const row of response.rows) {
      const doc = row.doc;

      if (doc === undefined) {
        console.error('Received undefined document! Did you pass include_docs: true?');
        continue;
      }

      // TODO: See if there is a way to restrict the query better
      // Query will also match searches since their key is an extension of ours
      // Skip these by checking a field that only ProfilePageSchema will have
      if (doc.colorScheme === undefined) {
        continue;
      }

      const existing = ProfilePage.cache.get(doc._id);
      if (existing) {
        results.push(existing);
      } else {
        try {
          const page = await ProfilePage.deserialize(doc);
          results.push(page);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping profile page '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
    }

    return results;
  }

  public static async deserialize(data: ProfilePageSchema, existingInstance?: ProfilePage) {
    throwIfIdMismatch(data, existingInstance);

    const instance = existingInstance || new ProfilePage(data.title);

    instance.id = data._id;
    instance.rev = data._rev;
    instance.title = data.title;
    instance.published = data.published;
    instance.createdAt = new Date(data.createdAt);
    instance.lastEditedAt = new Date(data.lastEditedAt);
    instance.colorScheme = data.colorScheme;
    instance.urls = data.urls;

    // bulkGet never returns if we pass [] for docs???
    if (data.accountIds.length > 0) {
      const db = await getDb();
      const response = await db.bulkGet<AccountSchema>({
        docs: data.accountIds.map(id => ({ id })),
      });
      console.debug(response);

      // Clear the history so we don't have to worry about duplicates
      instance.accounts.length = 0;

      for (const result of response.results) {
        // Assume we only got back a single revision
        const doc = result.docs[0];

        if ('error' in doc) {
          console.warn(`Skipping search '${result.id}': ${doc.error}`);
          continue;
        }

        const existing = ThirdPartyAccount.accountCache.get(result.id);
        if (existing) {
          instance.accounts.push(existing);
        } else {
          try {
            // doc.ok seems to lie about its type
            // When logged, it's a Promise
            let actualDoc = doc.ok;
            if (doc.ok instanceof Promise) {
              actualDoc = await doc.ok;
            }

            const account = await ThirdPartyAccount.deserialize(actualDoc);
            console.debug(account);
            instance.accounts.push(account);
          } catch (e) {
            // Debugging for mysterious doc.ok type
            console.debug(result);
            console.debug(doc.ok);
            console.debug(await doc.ok);
            console.warn(`Skipping account '${result.id}'. Failed to deserialize: ${e}`);
            continue;
          }
        }
      }
    }

    ProfilePage.cache.add(instance);

    return instance;
  }

  public id: PouchDbId;
  public rev: string = '';

  public title: string;
  public published: boolean = false;
  public createdAt: Date = new Date();
  public lastEditedAt: Date = new Date();

  public colorScheme: ProfilePageColorSchema;
  public urls: string[] = [];

  // public accountIds: Set<string> = new Set();
  public accounts: ThirdPartyAccount[] = [];

  constructor(title?: string) {
    this.title = title || `Profile Page #${++ProfilePage.idForDefaultName}`;
    this.colorScheme = { ...DEFAULT_COLOR_SCHEME };

    // TODO: Switch to hash after merge
    this.id = toId(['profile', this.createdAt.toJSON(), this.title]);
  }

  /**
   * Save/update this search definition in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    console.debug(`Saving profile page ${this.id}...`);

    const db = await getDb();
    const result = await db.put(this.serialize());

    if (result.ok) {
      this.rev = result.rev;
      ProfilePage.cache.add(this);
      return result;
    }

    console.error(result);
    throw new Error('Failed to save profile page!');
  }

  /**
   * Remove the profile page.
   */
  public async remove(): Promise<void> {
    console.debug(`Removing profile page ${this.id}...`);

    const db = await getDb();
    let result;
    try {
      result = await db.remove(this.serialize());
    } catch (e) {
      console.warn(`Could not remove ${this.id}: ${e}`);
      return;
    }

    DbCache.remove(this.id);

    if (!result.ok) {
      console.error(`Could not delete ${this.id}!`);
      console.error(result);
    }

    this.rev = result.rev;
  }

  public serialize(): ProfilePageSchema {
    return {
      _id: this.id,
      _rev: this.rev,
      title: this.title,
      published: this.published,
      createdAt: this.createdAt.toJSON(),
      lastEditedAt: this.lastEditedAt.toJSON(),
      colorScheme: this.colorScheme,
      urls: this.urls,
      accountIds: this.accounts.map(account => account.id),
    };
  }
}

/**
 * **DEPRECATED**
 * @deprecated Use `ProfilePage.cache` instead.
 *
 *  Collection of profile pages that have already been pulled out of the database.
 */
export const pages: { [key: string]: ProfilePage } = ProfilePage.cache.items;
