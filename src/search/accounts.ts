/**
 * @fileoverview Classes, interfaces, etc. that describe TRACE
 * and third-party accounts.
 */

import { DbCache, DbResponse, getDb, IDbStorable, PouchDbId, throwIfIdMismatch, toId, UTF_MAX } from 'db';
import {
  AccountSchema,
  ClaimedAccountSchema,
  deserializeSite,
  AutoSearchAccountSchema,
  FailedAccountSchema,
  ManualAccountSchema,
  RejectedAccountSchema,
  UnregisteredAccountSchema,
} from 'db/schema';
import { Site } from 'sites';
import SparkMD5 from 'spark-md5';

/**
 * Account associated with a third-party `Site`.
 */
export abstract class ThirdPartyAccount implements IDbStorable {
  public static accountCache = new DbCache<ThirdPartyAccount>();
  public static resultCache = new DbCache<ThirdPartyAccount>();
  public static get accounts() {
    return ThirdPartyAccount.accountCache.items;
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.items;
  }

  /**
   * Factory method for creating an account using the appropriate subclass.
   */
  public static async factory(data: AccountSchema): Promise<ThirdPartyAccount> {
    if (data.type === AccountType.DISCOVERED) {
      return await AutoSearchAccount.deserialize(data as AutoSearchAccountSchema);
    } else if (data.type === AccountType.CLAIMED) {
      return await ClaimedAccount.deserialize(data as ClaimedAccountSchema);
    } else if (data.type === AccountType.REJECTED) {
      return await RejectedAccount.deserialize(data as RejectedAccountSchema);
    } else if (data.type === AccountType.MANUAL) {
      return await ManualAccount.deserialize(data as ManualAccountSchema);
    } else if (data.type === AccountType.UNREGISTERED) {
      return await UnregisteredAccount.deserialize(data as UnregisteredAccountSchema);
    } else if (data.type === AccountType.FAILED) {
      return await FailedAccount.deserialize(data as FailedAccountSchema);
    } else {
      throw new Error(`Cannot deserialize unhandled account type '${data.type}'`);
    }
  }

  /**
   * Load all `Accounts`s from the database into
   * the `ThirdPartyAccount.accountCache`.
   *
   * Returns an array of the requested accounts. All loaded accounts
   * (including ones not loaded by this request) can be accessed
   * via `ThirdPartyAccount.accountCache`.
   */
  public static async loadAll(idPrefix?: string) {
    const db = await getDb();
    const response = await db.allDocs<AccountSchema>({
      include_docs: true,
      startkey: toId(['account'], idPrefix),
      endkey: toId(['account', UTF_MAX], idPrefix),
    });

    const results = [];
    for (const row of response.rows) {
      const doc = row.doc;

      if (doc === undefined) {
        console.error('Received undefined document! Did you pass include_docs: true?');
        continue;
      }

      // TODO: See if there is a way to restrict the query better
      // Query will also match any new objects whose key is an extension of ours
      // We don't really need this yet since we don't have any objects that do this,
      // but still be safe and skip these by checking a field that only accounts should have
      if (doc.userName === undefined) {
        continue;
      }

      const existingAccount = ThirdPartyAccount.accountCache.get(doc._id);
      const existingResult = ThirdPartyAccount.resultCache.get(doc._id);
      if (existingAccount) {
        results.push(existingAccount);
      } else if (existingResult) {
        results.push(existingResult);
      } else {
        try {
          const account = await ThirdPartyAccount.deserialize(doc);
          results.push(account);
        } catch (e) {
          console.debug(doc);
          console.debug(e);
          console.warn(`Skipping account '${doc._id}'.\nFailed to deserialize:\n${e}`);
          continue;
        }
      }
    }

    return results;
  }

  /**
   * Factory method for deserializing an account of any type.
   *
   * Also contains deserialization steps shared by all `ThirdPartyAccount`s.
   *
   * Derived classes MUST override this and call it with `instance` defined.
   * Failure to do so will result in an infinite loop of:
   *
   * ```
   * derived.deserialize() -> super.deserialize() -> factory() ->
   * derived.deserialize() -> super.deserialize() -> factory() -> ...
   * ```
   */
  public static async deserialize(data: AccountSchema, instance?: ThirdPartyAccount) {
    /**
     * Hack to handle deserialization of accounts that have an `idPrefix`.
     * This really only breaks if another ID field (i.e. `userName`) contains
     * the entire `instance.id`.
     *
     * This is actually possible since userName is supplied by the user, but we'll let
     * it ride for now. This is really more of a guard for us as developers.
     *
     * If we create `fromId()` to deconstruct an ID, we can improve this.
     *
     * Example:
     *  data._id: searchResult/account/example.com/user1
     *  instance._id: account/example.com/user1
     *
     * Broken example:
     *  data._id: searchResult/account/definitely-not-example.com/account/example.com/user1
     *  instance._id: account/example.com/user1
     */
    if (instance && data._id.endsWith(instance.id)) {
      instance.id = data._id;
    }
    throwIfIdMismatch(data, instance);

    // IMPORTANT: if a derived class doesn't override deserialize() or calls this
    // without creating an instance, we'll recurse infinitely
    instance = instance || (await ThirdPartyAccount.factory(data));

    instance.id = data._id;
    instance.rev = data._rev;
    instance.type = data.type;
    instance.createdAt = new Date(data.createdAt);
    instance.userName = data.userName;
    instance.site = deserializeSite(data);

    if (instance.id.startsWith('search')) {
      ThirdPartyAccount.resultCache.add(instance);
    } else {
      ThirdPartyAccount.accountCache.add(instance);
    }

    return instance;
  }

  public id: PouchDbId;
  public rev: string = '';

  abstract type: AccountType;
  public createdAt: Date = new Date();

  public site: Site;
  public userName: string;
  public get url() {
    // TODO: This is simple replacement for the Python format strings
    // Need to make sure this works for everything
    return this.site.url.replace('{}', this.userName);
  }

  constructor(site: Site, userName: string, idPrefix?: string) {
    this.site = site;
    this.userName = userName;

    const hash = SparkMD5.hash(toId([this.site.name, this.userName]));
    this.id = toId(['account', hash], idPrefix);
  }

  /**
   * Save/update this account in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    console.debug(`Saving ${this.type.toLowerCase()} account ${this.id}...`);

    const db = await getDb();
    const result = await db.put(this.serialize());

    if (result.ok) {
      this.rev = result.rev;

      if (this.id.startsWith('search')) {
        ThirdPartyAccount.resultCache.add(this);
      } else {
        ThirdPartyAccount.accountCache.add(this);
      }

      return result;
    }

    console.error(result);
    throw new Error('Failed to save account!');
  }

  public serialize(): AccountSchema {
    return {
      _id: this.id,
      _rev: this.rev,
      type: this.type,
      createdAt: this.createdAt.toJSON(),
      siteName: this.site.name,
      userName: this.userName,
    };
  }
}

/**
 * An account discovered during `Search`.
 *
 * Has not been claimed or rejected yet.
 */
export class AutoSearchAccount extends ThirdPartyAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof AutoSearchAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof AutoSearchAccount);;
  }

  public static async deserialize(data: AutoSearchAccountSchema, existingInstance?: AutoSearchAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new AutoSearchAccount(site, data.userName);

    await super.deserialize(data, instance);

    // instance.confidence = data.confidence;
    instance.matchedFirstNames = data.matchedFirstNames;
    instance.matchedLastNames = data.matchedLastNames;
    instance.actionTaken = data.actionTaken;

    return instance;
  }

  public type = AccountType.DISCOVERED;

  public matchedUserName: boolean = true;
  public matchedFirstNames: string[] = [];
  public matchedLastNames: string[] = [];
  public actionTaken = AutoSearchAccountAction.NONE;

  public get confidence(): ConfidenceRating {
    // Actually matched against the username adds a weight of 3
    // This won't be true for FailedAccounts or UnregisteredAccounts
    // These account types should have a confidence of 0
    // A user might still decide to accept or reject the account based on their own knowledge though
    const userNameWeight = this.matchedUserName ? 3 : 0;

    // Found first names adds a weight of 1
    // Found last names adds a weight of 2
    // Max value of 10
    return Math.min(
      userNameWeight +
      this.matchedFirstNames.length +
      this.matchedLastNames.length * 2
    , 10) as ConfidenceRating;
  }

  /**
   * Return a claimed version of this account.
   *
   * TODO: This is a little unstable
   */
  public async claim(): Promise<ClaimedAccount> {
    if (this.actionTaken === AutoSearchAccountAction.CLAIMED) {
      throw new Error(`'${this.id}' has already been claimed!`);
    }

    const account = new ClaimedAccount(this.site, this.userName);

    // TODO: Is this the desired behavior?
    // If there's already an account with this id in the database,
    // assume we're trying to update that account
    const existing = ThirdPartyAccount.accountCache.get(account.id);
    if (existing) {
      account.rev = existing.rev;
    }

    // TODO: This is a little dangerous since we have to manually
    // copy any ClaimedAccount properties and we lose the typing
    const schema = this.serialize() as ClaimedAccountSchema;
    schema.claimedAt = new Date().toJSON();

    // Reset anything that'll be invalid on the new account
    schema._id = account.id;
    schema._rev = account.rev;
    schema.type = account.type;

    // Copy over the base account's properties
    await ClaimedAccount.deserialize(schema, account);

    this.actionTaken = AutoSearchAccountAction.CLAIMED;
    await this.save();
    await account.save();

    return account;
  }

  /**
   * Return a rejected version of this account.
   *
   * TODO: This is a little unstable
   */
  public async reject(): Promise<RejectedAccount> {
    if (this.actionTaken === AutoSearchAccountAction.REJECTED) {
      throw new Error(`'${this.id}' has already been rejected!`);
    }

    const account = new RejectedAccount(this.site, this.userName);

    // TODO: Is this the desired behavior?
    // If there's already an account with this id in the database,
    // assume we're trying to update that account
    const existing = ThirdPartyAccount.accountCache.get(account.id);
    if (existing) {
      account.rev = existing.rev;
    }

    // TODO: This is a little dangerous since we have to manually
    // copy any RejectedAccount properties and we lose the typing
    const schema = this.serialize() as RejectedAccountSchema;
    schema.rejectedAt = new Date().toJSON();

    // Reset anything that'll be invalid on the new account
    schema._id = account.id;
    schema._rev = account.rev;
    schema.type = account.type;

    // Copy over the base account's properties
    await RejectedAccount.deserialize(schema, account);

    this.actionTaken = AutoSearchAccountAction.REJECTED;
    await this.save();
    await account.save();

    return account;
  }

  public serialize(): AutoSearchAccountSchema {
    const base = super.serialize() as AutoSearchAccountSchema;
    // base.confidence = this.confidence;
    base.matchedFirstNames = this.matchedFirstNames;
    base.matchedLastNames = this.matchedLastNames;
    base.actionTaken = this.actionTaken;
    return base;
  }
}

/**
 * Account that has been claimed by the user after `Search`.
 */
export class ClaimedAccount extends AutoSearchAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof ClaimedAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof ClaimedAccount);;
  }

  public static async deserialize(data: ClaimedAccountSchema, existingInstance?: ClaimedAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new ClaimedAccount(site, data.userName);

    await super.deserialize(data, instance);

    instance.claimedAt = new Date(data.claimedAt);

    return instance;
  }

  public type = AccountType.CLAIMED;
  public claimedAt: Date = new Date();

  public serialize(): ClaimedAccountSchema {
    const base = super.serialize() as ClaimedAccountSchema;
    base.claimedAt = this.claimedAt.toJSON();
    return base;
  }
}

/**
 * Account that has been rejected by the user after `Search`.
 */
export class RejectedAccount extends AutoSearchAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof RejectedAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof RejectedAccount);;
  }

  public static async deserialize(data: RejectedAccountSchema, existingInstance?: RejectedAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new RejectedAccount(site, data.userName);

    await super.deserialize(data, instance);

    instance.rejectedAt = new Date(data.rejectedAt);

    return instance;
  }

  public type = AccountType.REJECTED;
  public rejectedAt: Date = new Date();

  public serialize(): RejectedAccountSchema {
    const base = super.serialize() as RejectedAccountSchema;
    base.rejectedAt = this.rejectedAt.toJSON();
    return base;
  }
}

/**
 * Account that returned a negative result from `Search`.
 *
 * This implies the user name hasn't been registered on the site.
 */
export class UnregisteredAccount extends AutoSearchAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof UnregisteredAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof UnregisteredAccount);;
  }

  public static async deserialize(data: UnregisteredAccountSchema, existingInstance?: UnregisteredAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new UnregisteredAccount(site, data.userName);

    await super.deserialize(data, instance);

    return instance;
  }

  public type = AccountType.UNREGISTERED;
  public matchedUserName = false;

  public serialize(): UnregisteredAccountSchema {
    const base = super.serialize() as UnregisteredAccountSchema;
    return base;
  }
}

export class FailedAccount extends AutoSearchAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof FailedAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof FailedAccount);;
  }

  public static async deserialize(data: FailedAccountSchema, existingInstance?: FailedAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new FailedAccount(site, data.userName);

    await super.deserialize(data, instance);

    instance.reason = data.reason;

    return instance;
  }

  public type = AccountType.FAILED;
  public matchedUserName = false;
  public reason: string = 'Unknown error!';

  public serialize(): FailedAccountSchema {
    const base = super.serialize() as FailedAccountSchema;
    base.reason = this.reason;
    return base;
  }
}

/**
 * Account manually defined and added by the user.
 *
 * This does not come from `Search`.
 */
 export class ManualAccount extends ThirdPartyAccount {
  public static get accounts() {
    return ThirdPartyAccount.accountCache.filter((account) => account instanceof ManualAccount);
  }
  public static get results() {
    return ThirdPartyAccount.resultCache.filter((account) => account instanceof ManualAccount);;
  }

  public static async deserialize(data: ManualAccountSchema, existingInstance?: ManualAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new ManualAccount(site, data.userName);

    await super.deserialize(data, instance);

    instance.lastEditedAt = new Date(data.lastEditedAt);

    return instance;
  }

  public type = AccountType.MANUAL;
  public lastEditedAt: Date = new Date();

  /**
   * Don't know what this will do yet.
   */
  public edit() {
    throw new Error('Not implemented!');
  }

  public serialize(): ManualAccountSchema {
    const base = super.serialize() as ManualAccountSchema;
    base.lastEditedAt = this.lastEditedAt.toJSON();
    base.site = this.site;
    return base;
  }
}

/**
 * **DEPRECATED**
 *
 * @deprecated Use `ThirdPartyAccount.accountCache` instead.
 *
 * Collection of accounts that have already been pulled out of the database.
 */
export const accounts: { [key: string]: ThirdPartyAccount } = ThirdPartyAccount.accountCache.items;
/**
 * **DEPRECATED**
 *
 * @deprecated Use `ThirdPartyAccount.resultCache` instead.
 *
 * Collection of search results that have already been pulled out of the database.
 */
export const searchResults: { [key: string]: ThirdPartyAccount } = ThirdPartyAccount.resultCache.items;

/**
 * Rating from 0-10 with 10 being highly confident.
 */
export type ConfidenceRating = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export enum AccountType {
  DISCOVERED = 'Discovered',
  CLAIMED = 'Claimed',
  REJECTED = 'Rejected',
  MANUAL = 'Manual',
  UNREGISTERED = 'Unregistered',
  FAILED = 'Failed',
}

/**
 * Decision that a user made on a `AutoSearchAccount`.
 *
 * This is stored with the original `AutoSearchAccount` so
 * that we can tell what happened when we view history.
 */
export enum AutoSearchAccountAction {
  NONE = 'None',
  CLAIMED = 'Claimed',
  REJECTED = 'Rejected',
}
