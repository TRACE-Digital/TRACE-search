import { AccountSchema, DbResponse, getDb, IDbStorable, PouchDbId, ProfilePageColorSchema, ProfilePageSchema, throwIfIdMismatch, toId, UTF_MAX } from "db";
import { accounts, ThirdPartyAccount } from "search";

export const DEFAULT_COLOR_SCHEME: ProfilePageColorSchema = {
  titleColor: "#FFFFFF",
  backgroundColor: "#1E1D2A",
  siteColor: "#26283A",
  iconColor: "Default"
};

// TODO: Turn this into a normal cache
/** Collection of profile pages that have already been pulled out of the database. */
export const pages: { [key: string]: ProfilePage } = {};

/**
 * Parameters needed to reconstruct the editing state on the profile editor.
 */
export class ProfilePage implements IDbStorable {
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

      // TODO: Use cache after merge
      const existing = pages[doc._id];
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
    instance.createdAt = new Date(data.createdAt);
    instance.lastEditedAt = new Date(data.lastEditedAt);
    instance.colorScheme = data.colorScheme;

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

        // TODO: Rewrite to use caches after merge
        if (result.id in accounts) {
          instance.accounts.push(accounts[result.id]);
        } else {
          try {
            const account = await ThirdPartyAccount.deserialize(doc.ok);
            instance.accounts.push(account);
          } catch (e) {
            console.debug(result);
            console.warn(`Skipping account '${result.id}'. Failed to deserialize: ${e}`);
            continue;
          }
        }
      }
    }

    // TODO: Rewrite using caches after merge
    pages[instance.id] = instance;

    return instance;
  }


  public id: PouchDbId;
  public rev: string = '';

  public title: string;
  public createdAt: Date = new Date();
  public lastEditedAt: Date = new Date();

  public colorScheme: ProfilePageColorSchema;

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
      pages[this.id] = this;
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

    // TODO: Add after merge
    // DbCache.remove(this.id);
    delete pages[this.id];

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
      createdAt: this.createdAt.toJSON(),
      lastEditedAt: this.lastEditedAt.toJSON(),
      colorScheme: this.colorScheme,
      accountIds: this.accounts.map(account => account.id),
    };
  }
}
