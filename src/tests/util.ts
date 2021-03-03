import { getDb, IDbStorable } from 'db';

export async function dumpAllDocs(includeDocs = false) {
  const db = await getDb();

  const result = await db.allDocs({
    include_docs: includeDocs,
  });

  console.log(result);

  return result;
}

export function checkSaveResponse(response: PouchDB.Core.Response, item: IDbStorable) {
  expect(response).toBeDefined();
  expect(response.ok).toBeTruthy();
  expect(response.id).toEqual(item.id);

  expect(item.rev).toEqual(response.rev);
}
