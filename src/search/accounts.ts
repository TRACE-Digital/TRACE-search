/**
 * @fileoverview Classes, interfaces, etc. that describe TRACE
 * and third-party accounts.
 */

import { DbResponse, getDb, IDbStorable, PouchDbId, toId } from 'db';
import {
  AccountSchema,
  ClaimedAccountSchema,
  DiscoveredAccountSchema,
  ManualAccountSchema,
  RejectedAccountSchema,
} from 'db/schema';
import { Site } from 'sites';

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
 * TODO: Figure out these constructors
 *
 * They make sense now, but I don't know if they'll work with
 * de-serialization from the database.
 *
 * Default constructor with a `deserialize()` method might be better.
 */

/**
 * Account associated with a third-party `Site`.
 */
export abstract class ThirdPartyAccount implements IDbStorable {
  public readonly id: PouchDbId;
  public rev: string = '';

  abstract type: AccountType;
  public createdAt: Date = new Date();

  public readonly site: Site;
  public readonly userName: string;
  public readonly url: string;

  constructor(site: Site, userName: string, idPrefix: string[] = []) {
    this.site = site;
    this.userName = userName;

    this.id = toId(idPrefix.slice().concat(['account', this.site.name, this.userName]));

    // TODO: Simple replacement for the Python format strings
    // Need to make sure this works for everything
    this.url = this.site.url.replace('{}', this.userName);
  }

  /**
   * Save/update this account in the database.
   *
   * Don't call this unless you've made changes!
   * Each call will create a revision and take up space.
   */
  public async save(): Promise<DbResponse> {
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
  public type = AccountType.DISCOVERED;

  public confidence: ConfidenceRating = 5;
  public matchedFirstNames: string[] = [];
  public matchedLastNames: string[] = [];

  /**
   * Convert this account into a `ClaimedAccount`.
   */
  public claim(): ClaimedAccount {
    this.type = AccountType.CLAIMED;

    const modified = this as any;
    modified.claimedAt = new Date();
    return modified as ClaimedAccount;
  }

  /**
   * Reject and convert this account into a `RejectedAccount`.
   *
   * TODO: This doesn't really convert the type in Typescript's eyes yet
   */
  public reject(): RejectedAccount {
    this.type = AccountType.REJECTED;

    const modified = this as any;
    modified.rejectedAt = new Date();
    return modified as RejectedAccount;
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
  public type = AccountType.UNREGISTERED;
}
