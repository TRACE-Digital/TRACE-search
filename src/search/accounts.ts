/**
 * @fileoverview Classes, interfaces, etc. that describe TRACE
 * and third-party accounts.
 */

import { DbResponse, getDb, IDbStorable, PouchDbId, throwIfIdMismatch, toId } from 'db';
import {
  AccountSchema,
  ClaimedAccountSchema,
  deserializeSite,
  DiscoveredAccountSchema,
  ManualAccountSchema,
  RejectedAccountSchema,
  UnregisteredAccountSchema,
} from 'db/schema';
import { Site } from 'sites';

/** Collection of accounts that have already been pulled out of the database. */
export const accounts: { [key: string]: ThirdPartyAccount } = {};

export enum AccountType {
  DISCOVERED = 'Discovered',
  CLAIMED = 'Claimed',
  REJECTED = 'Rejected',
  MANUAL = 'Manual',
  UNREGISTERED = 'Unregistered',
}

/**
 * Rating from 0-10 with 10 being highly confident.
 */
export type ConfidenceRating = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Account associated with a third-party `Site`.
 */
export abstract class ThirdPartyAccount implements IDbStorable {
  /**
   * Factory method for creating an account using the appropriate subclass.
   */
  public static async factory(data: AccountSchema): Promise<ThirdPartyAccount> {
    if (data.type === AccountType.DISCOVERED) {
      return await DiscoveredAccount.deserialize(data as DiscoveredAccountSchema);
    } else if (data.type === AccountType.CLAIMED) {
      return await ClaimedAccount.deserialize(data as ClaimedAccountSchema);
    } else if (data.type === AccountType.REJECTED) {
      return await RejectedAccount.deserialize(data as RejectedAccountSchema);
    } else if (data.type === AccountType.MANUAL) {
      return await ManualAccount.deserialize(data as ManualAccountSchema);
    } else if (data.type === AccountType.UNREGISTERED) {
      return await UnregisteredAccount.deserialize(data as UnregisteredAccountSchema);
    } else {
      throw new Error(`Cannot deserialize unhandled account type '${data.type}'`);
    }
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

    accounts[instance.id] = instance;

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

    this.id = toId(['account', this.site.name, this.userName], idPrefix);
  }

  /**
   * Save/update this account in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
    console.debug(`Saving account ${this.id}...`);

    const db = await getDb();
    const result = await db.put(this.serialize());

    if (result.ok) {
      this.rev = result.rev;
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
export class DiscoveredAccount extends ThirdPartyAccount {
  public static async deserialize(data: DiscoveredAccountSchema, existingInstance?: DiscoveredAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new DiscoveredAccount(site, data.userName);

    super.deserialize(data, instance);

    instance.confidence = data.confidence;
    instance.matchedFirstNames = data.matchedFirstNames;
    instance.matchedLastNames = data.matchedLastNames;

    return instance;
  }

  public type = AccountType.DISCOVERED;

  public confidence: ConfidenceRating = 5;
  public matchedFirstNames: string[] = [];
  public matchedLastNames: string[] = [];

  /**
   * Return a claimed version of this account.
   */
  public claim(): ClaimedAccount {
    // TODO: Figure out how to mark that this DiscoveredAccount has been claimed
    // without messing up future serialization
    // this.type = AccountType.CLAIMED;
    return new ClaimedAccount(this.site, this.userName);
  }

  /**
   * Return a rejected version of this account.
   */
  public reject(): RejectedAccount {
    // TODO: Figure out how to mark that this DiscoveredAccount has been claimed
    // without messing up future serialization
    // this.type = AccountType.REJECTED;
    return new RejectedAccount(this.site, this.userName);
  }

  public serialize(): DiscoveredAccountSchema {
    const base = super.serialize() as DiscoveredAccountSchema;
    base.confidence = this.confidence;
    base.matchedFirstNames = this.matchedFirstNames;
    base.matchedLastNames = this.matchedLastNames;
    return base;
  }
}

/**
 * Account that has been claimed by the user after `Search`.
 */
export class ClaimedAccount extends DiscoveredAccount {
  public static async deserialize(data: ClaimedAccountSchema, existingInstance?: ClaimedAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new ClaimedAccount(site, data.userName);

    super.deserialize(data, instance);

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
export class RejectedAccount extends DiscoveredAccount {
  public static async deserialize(data: RejectedAccountSchema, existingInstance?: RejectedAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new RejectedAccount(site, data.userName);

    super.deserialize(data, instance);

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
 * Account manually defined and added by the user.
 *
 * This does not come from `Search`.
 */
export class ManualAccount extends ThirdPartyAccount {
  public static async deserialize(data: ManualAccountSchema, existingInstance?: ManualAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new ManualAccount(site, data.userName);

    super.deserialize(data, instance);

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
    return base;
  }
}

/**
 * Account that returned a negative result from `Search`.
 *
 * This implies the user name hasn't been registered on the site.
 */
export class UnregisteredAccount extends ThirdPartyAccount {
  public static async deserialize(data: UnregisteredAccountSchema, existingInstance?: UnregisteredAccount) {
    const site = deserializeSite(data);
    const instance = existingInstance || new UnregisteredAccount(site, data.userName);

    super.deserialize(data, instance);

    return instance;
  }

  public type = AccountType.UNREGISTERED;

  public serialize(): UnregisteredAccountSchema {
    const base = super.serialize() as UnregisteredAccountSchema;
    return base;
  }
}
