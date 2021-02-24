/**
 * @fileoverview Classes, interfaces, etc. that describe TRACE
 * and third-party accounts.
 */

import { DbStorable } from 'db';
import { Site } from 'sites';

export enum AccountType {
  DISCOVERED = 'Discovered',
  CLAIMED = 'Claimed',
  REJECTED = 'Rejected',
  MANUAL = 'Manual',
  UNREGISTERED = 'Unregistered'
};

/**
 * Rating from 0-10 with 10 being highly confident.
 */
export type ConfidenceRating = 0|1|2|3|4|5|6|7|8|9|10;

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
export abstract class ThirdPartyAccount implements DbStorable {
  public readonly id: string[] = [];

  abstract type: AccountType;

  public readonly site: Site;
  public readonly userName: string;
  public readonly url: string;

  constructor(site: Site, userName: string) {
    this.site = site;
    this.userName = userName;

    this.id = ['account', this.site.name, this.userName];

    // TODO: Simple replacement for the Python format strings
    // Need to make sure this works for everything
    this.url = this.site.url.replace('{}', this.userName);
  }
}

/**
 * An account discovered during `Search`.
 *
 * Has not been claimed or rejected yet.
 */
export class DiscoveredAccount extends ThirdPartyAccount {
  public type = AccountType.DISCOVERED;
  public discoveredOn: Date = new Date();

  public confidence: ConfidenceRating = 5;
  public matchedFirstNames: string[] = [];
  public matchedLastNames: string[] = [];

  /**
   * Convert this account into a `ClaimedAccount`.
   */
  public claim(): ClaimedAccount {
    this.type = AccountType.CLAIMED;

    const modified = this as any;
    modified.claimedOn = new Date();
    return modified as ClaimedAccount;
  }

  /**
   * Reject and convert this account into a `RejectedAccount`.
   */
  public reject(): RejectedAccount {
    this.type = AccountType.REJECTED;

    const modified = this as any;
    modified.rejectedOn = new Date();
    return modified as RejectedAccount;
  }
}

/**
 * Account that has been claimed by the user after `Search`.
 */
export class ClaimedAccount extends DiscoveredAccount {
  public type = AccountType.CLAIMED;
  public claimedOn: Date = new Date();
}

/**
 * Account that has been rejected by the user after `Search`.
 */
export class RejectedAccount extends DiscoveredAccount {
  public type = AccountType.REJECTED;
  public rejectedOn: Date = new Date();
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
}

/**
 * Account that returned a negative result from `Search`.
 *
 * This implies the user name hasn't been registered on the site.
 */
export class UnregisteredAccount extends ThirdPartyAccount {
  public type = AccountType.UNREGISTERED;
}
