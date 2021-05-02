import { VERSION } from 'meta';
import { ClaimedAccount, ManualAccount, ThirdPartyAccount } from 'search';
import { AccountSchema } from './schema';

/**
 * Serialize and export all dashboard accounts and
 * searches to JSON.
 *
 * This format can be re-imported to TRACE sometime in the future.
 */
export const exportToJson = async () => {
  const data = await getData();

  const serializedAccounts: AccountSchema[] = [];
  const newData = { ...data } as any;
  newData.accounts = serializedAccounts;

  for (const account of data.accounts) {
    newData.accounts.push(account.serialize());
  }

  return JSON.stringify(newData, null, 2);
};

/**
 * Export all dashboard accounts and searches
 * to a more verbose JSON that is more human readable.
 *
 * TODO: This might not even work because some of the
 * objects are recursive.
 */
export const exportToReadableJson = async () => {
  return JSON.stringify(await getData(), null, 2);
};

/**
 * Export all accounts to CSV.
 */
export const exportToCsv = async () => {
  const data = await getData();

  const lines = [];
  lines.push(['Type', 'Site Name', 'User Name', 'URL', 'Date Created']);

  for (const account of data.accounts) {
    let columns = [account.type, account.site.name, account.userName, account.url, account.createdAt];
    columns = columns.map(entry => JSON.stringify(entry));
    lines.push(columns);
  }

  const csv = lines.map(line => line.join(',')).join('\r\n');
  return csv;
};

const getData = async () => {
  await ClaimedAccount.loadAll();
  await ManualAccount.loadAll();

  let accounts: ThirdPartyAccount[] = [];
  accounts = accounts.concat(Object.values(ClaimedAccount.accounts)).concat(Object.values(ManualAccount.accounts));
  accounts.sort((a, b) => a.site.name.localeCompare(b.site.name));

  return {
    version: VERSION,
    dateExported: new Date().toJSON(),
    accounts,
  };
};
